
// src/app/dashboard/inventory/nfe-processing/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, writeBatch, doc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import type { Product, StockEntry, Supplier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Save, Link as LinkIcon, PlusCircle, Wand2, Barcode } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { NfeData, NfeProduct } from '@/components/nfe-import-dialog';
import { Badge } from '@/components/ui/badge';

type ProcessingStatus = 'unmapped' | 'mapped' | 'new' | 'ignored';

interface ProcessedNfeProduct extends NfeProduct {
    processingStatus: ProcessingStatus;
    stokioProductId?: string;
    finalQuantity: number;
    finalPurchasePrice: number;
    finalSalePrice: number;
}

export default function NfeProcessingPage() {
    const router = useRouter();
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();

    const [nfeData, setNfeData] = useState<NfeData | null>(null);
    const [processedProducts, setProcessedProducts] = useState<ProcessedNfeProduct[]>([]);
    const [stokioProducts, setStokioProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        try {
            const data = sessionStorage.getItem('nfeData');
            if (!data) {
                toast({ title: 'Nenhum dado de NF-e encontrado.', variant: 'destructive' });
                router.push('/dashboard/inventory');
                return;
            }
            const parsedData: NfeData = JSON.parse(data, (key, value) => {
                if ((key === 'issueDate' || key === 'expirationDate') && value) {
                    return new Date(value);
                }
                return value;
            });
            setNfeData(parsedData);

            const initialProcessed: ProcessedNfeProduct[] = parsedData.products.map(p => {
                 const purchasePricePerUnit = p.totalPrice / p.quantity;
                 return {
                    ...p,
                    processingStatus: 'unmapped' as ProcessingStatus,
                    finalQuantity: p.quantity,
                    finalPurchasePrice: purchasePricePerUnit,
                    finalSalePrice: purchasePricePerUnit * 1.5, // Default 50% markup
                 }
            });
            setProcessedProducts(initialProcessed);

        } catch (error) {
            toast({ title: 'Erro ao processar dados da NF-e.', variant: 'destructive' });
            router.push('/dashboard/inventory');
        }
    }, [router, toast]);
    
    useEffect(() => {
        if (!currentBranch) return;
        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id), where("isDeleted", "!=", true));
        const unsub = onSnapshot(productsQuery, snap => {
            setStokioProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
            setIsLoading(false);
        });
        return () => unsub();
    }, [currentBranch]);

    const updateProductStatus = (index: number, status: ProcessingStatus, stokioProductId?: string) => {
        setProcessedProducts(prev => {
            const newProducts = [...prev];
            newProducts[index].processingStatus = status;
            newProducts[index].stokioProductId = stokioProductId;
            return newProducts;
        });
    };

    const updateProductValue = (index: number, field: keyof ProcessedNfeProduct, value: number) => {
        setProcessedProducts(prev => {
            const newProducts = [...prev];
            (newProducts[index] as any)[field] = value;

            // Recalculate purchase price if quantity changes
            if (field === 'finalQuantity') {
                const nfeProduct = newProducts[index];
                if (value > 0) {
                    newProducts[index].finalPurchasePrice = nfeProduct.totalPrice / value;
                }
            }

            return newProducts;
        });
    }

    const handleConfirm = async () => {
        if (!nfeData || !user || !currentBranch) return;

        const unmappedProducts = processedProducts.filter(p => p.processingStatus === 'unmapped');
        if (unmappedProducts.length > 0) {
            toast({title: 'Ação necessária', description: `Você precisa mapear ou ignorar ${unmappedProducts.length} produto(s) antes de continuar.`, variant: 'destructive' });
            return;
        }
        
        setIsSaving(true);
        const batch = writeBatch(db);

        try {
            // Supplier logic
            const suppliersRef = collection(db, 'suppliers');
            const q = query(suppliersRef, where("cnpj", "==", nfeData.supplierCnpj), where("organizationId", "==", user.organizationId));
            const supplierSnapshot = await getDocs(q);
            let supplierId = '';
            if (supplierSnapshot.empty) {
                const newSupplierRef = doc(suppliersRef);
                batch.set(newSupplierRef, {
                    name: nfeData.supplierName,
                    cnpj: nfeData.supplierCnpj,
                    ie: nfeData.supplierIe,
                    address: nfeData.supplierAddress,
                    organizationId: user.organizationId,
                    isDeleted: false,
                });
                supplierId = newSupplierRef.id;
            } else {
                supplierId = supplierSnapshot.docs[0].id;
            }

            for (const prod of processedProducts) {
                if (prod.processingStatus === 'ignored') continue;
                
                let productId = prod.stokioProductId;
                let productName = prod.name;

                if(prod.processingStatus === 'new') {
                    const newProductRef = doc(collection(db, 'products'));
                    productId = newProductRef.id;
                    const purchasePrice = prod.finalPurchasePrice || 0;
                    const salePrice = prod.finalSalePrice || 0;
                    const marginValue = purchasePrice > 0 ? ((salePrice - purchasePrice) / purchasePrice) * 100 : 0;

                    const newProductData: Omit<Product, 'id'> = {
                        name: prod.name,
                        category: 'Importado NF-e',
                        price: salePrice,
                        purchasePrice: purchasePrice,
                        lowStockThreshold: 10,
                        isSalable: true,
                        barcode: prod.code,
                        supplierId: supplierId,
                        supplierName: nfeData.supplierName,
                        ncm: prod.ncm,
                        cfop: prod.cfop,
                        unitOfMeasure: prod.unitOfMeasure,
                        branchId: currentBranch.id,
                        organizationId: user.organizationId,
                        isDeleted: false,
                        imageUrl: 'https://placehold.co/400x400.png',
                        marginType: 'percentage',
                        marginValue: marginValue,
                    };
                    batch.set(newProductRef, newProductData);
                } else if (prod.processingStatus === 'mapped' && productId) {
                     const existingProduct = stokioProducts.find(p => p.id === productId);
                     productName = existingProduct?.name || prod.name;
                     const productRef = doc(db, 'products', productId);
                     batch.update(productRef, { purchasePrice: prod.finalPurchasePrice });
                }

                if (!productId) continue;

                // Stock Entry
                const stockEntryRef = doc(collection(db, 'stockEntries'));
                const stockEntry: Omit<StockEntry, 'id'> = {
                    productId: productId,
                    productName: productName,
                    quantity: prod.finalQuantity,
                    type: 'entry',
                    date: nfeData.issueDate,
                    userId: user.id,
                    userName: user.name,
                    branchId: currentBranch.id,
                    organizationId: user.organizationId,
                    notes: `NF-e ${nfeData.nfeNumber}`,
                    ...(prod.expirationDate && { expirationDate: prod.expirationDate }),
                };
                batch.set(stockEntryRef, stockEntry);
            }
            
            // Create Expense
            const expenseRef = doc(collection(db, 'expenses'));
            const expenseData = {
                 description: `Compra - NF-e ${nfeData.nfeNumber}`,
                amount: nfeData.totalValue,
                category: 'Fornecedores',
                date: nfeData.issueDate,
                supplierId: supplierId,
                supplierName: nfeData.supplierName,
                nfeNumber: nfeData.nfeNumber,
                userId: user.id,
                userName: user.name,
                branchId: currentBranch.id,
                organizationId: user.organizationId,
                isDeleted: false,
            };
            batch.set(expenseRef, expenseData);
            
            await batch.commit();
            toast({title: 'Importação da NF-e concluída com sucesso!'});
            sessionStorage.removeItem('nfeData');
            router.push('/dashboard/inventory');

        } catch (error) {
            console.error("Error confirming NFe import:", error);
            toast({title: "Erro ao salvar dados da NF-e", variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <Button variant="outline" onClick={() => router.push('/dashboard/inventory')}><ArrowLeft className="mr-2"/> Voltar para o Inventário</Button>
            
            <Card>
                <CardHeader>
                    <CardTitle>Processamento de NF-e</CardTitle>
                    <CardDescription>Mapeie os produtos da nota fiscal para os produtos do seu sistema ou cadastre-os como novos.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <Loader2 className="mx-auto animate-spin" />}
                    {nfeData && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Fornecedor:</strong> {nfeData.supplierName}</div>
                            <div><strong>CNPJ:</strong> {nfeData.supplierCnpj}</div>
                            <div><strong>Nº Nota:</strong> {nfeData.nfeNumber}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Itens da Nota</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[25%]">Produto na NF-e</TableHead>
                                <TableHead className="w-[10%] text-center">Qtd.</TableHead>
                                <TableHead className="w-[35%]">Ação / Produto no Sistema</TableHead>
                                <TableHead className="w-[15%]">Custo Unit. (R$)</TableHead>
                                <TableHead className="w-[15%]">Venda Unit. (R$)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedProducts.map((p, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <p className="font-medium">{p.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Valor na Nota: R$ {p.totalPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Barcode className="h-3 w-3" /> {p.code} | NCM: {p.ncm}
                                        </p>
                                    </TableCell>
                                     <TableCell>
                                        <Input 
                                            type="number" 
                                            value={p.finalQuantity} 
                                            onChange={(e) => updateProductValue(index, 'finalQuantity', Number(e.target.value))}
                                            className="text-center"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <ProductMappingCell
                                            product={p}
                                            stokioProducts={stokioProducts}
                                            onUpdateStatus={(status, id) => updateProductStatus(index, status, id)}
                                        />
                                    </TableCell>
                                     <TableCell>
                                        <Input 
                                            type="number"
                                            step="0.01"
                                            value={p.finalPurchasePrice.toFixed(2)}
                                            onChange={(e) => updateProductValue(index, 'finalPurchasePrice', Number(e.target.value))}
                                            className="text-right"
                                            disabled={p.processingStatus !== 'new'}
                                        />
                                    </TableCell>
                                     <TableCell>
                                        <Input 
                                            type="number"
                                            step="0.01"
                                            value={p.finalSalePrice.toFixed(2)} 
                                            onChange={(e) => updateProductValue(index, 'finalSalePrice', Number(e.target.value))}
                                            className="text-right"
                                            disabled={p.processingStatus !== 'new'}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleConfirm} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 animate-spin"/>}
                    Confirmar e Dar Entrada no Estoque
                </Button>
            </div>
        </div>
    );
}


function ProductMappingCell({ product, stokioProducts, onUpdateStatus }: { product: ProcessedNfeProduct, stokioProducts: Product[], onUpdateStatus: (status: ProcessingStatus, id?: string) => void }) {
    const [open, setOpen] = useState(false);

    const handleSelectProduct = (stokioProduct: Product) => {
        onUpdateStatus('mapped', stokioProduct.id);
        setOpen(false);
    }
    
    const selectedStokioProduct = useMemo(() => {
        return stokioProducts.find(p => p.id === product.stokioProductId);
    }, [product.stokioProductId, stokioProducts]);


    if (product.processingStatus === 'new') {
        return <Button variant="outline" onClick={() => onUpdateStatus('unmapped')}>Desfazer</Button>;
    }
    
    if(product.processingStatus === 'mapped' && selectedStokioProduct) {
         return (
             <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">Mapeado</Badge>
                <span>{selectedStokioProduct.name}</span>
                <Button variant="ghost" size="sm" onClick={() => onUpdateStatus('unmapped')}>Alterar</Button>
             </div>
         );
    }

    return (
        <div className="flex gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[150px] justify-between">
                         <LinkIcon className="mr-2 h-4 w-4" /> Mapear
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                     <Command>
                        <CommandInput placeholder="Buscar produto..." />
                        <CommandList>
                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                            <CommandGroup>
                                {stokioProducts.map((p) => (
                                    <CommandItem key={p.id} onSelect={() => handleSelectProduct(p)}>
                                         <Check className={cn("mr-2 h-4 w-4", product.stokioProductId === p.id ? "opacity-100" : "opacity-0")}/>
                                         {p.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={() => onUpdateStatus('new')}><PlusCircle className="mr-2 h-4 w-4"/> Novo</Button>
        </div>
    );
}

