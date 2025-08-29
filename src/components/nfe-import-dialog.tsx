// src/components/nfe-import-dialog.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Loader2 } from 'lucide-react';
import type { Product, Expense, StockEntry } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, writeBatch, doc, getDocs, query, where, addDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { parseISO } from 'date-fns';

interface NfeProduct {
    code: string;
    name: string;
    quantity: number;
    unitPrice: number;
    expirationDate?: Date;
}

interface NfeData {
    supplierName: string;
    supplierCnpj: string;
    totalValue: number;
    products: NfeProduct[];
}

export function NfeImportDialog({ products }: { products: Product[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [fileName, setFileName] = useState('');
    const [parsedData, setParsedData] = useState<NfeData | null>(null);
    const { toast } = useToast();
    const { user, currentBranch } = useAuth();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'text/xml') {
            toast({ title: 'Formato inválido', description: 'Por favor, envie um arquivo .xml', variant: 'destructive' });
            return;
        }

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseNfeXml(text);
        };
        reader.readAsText(file);
    };

    const parseNfeXml = (xmlText: string) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        const getTagValue = (parent: Element, tagName: string) => parent.getElementsByTagName(tagName)[0]?.textContent || '';
        
        try {
            const emit = xmlDoc.getElementsByTagName('emit')[0];
            const ide = xmlDoc.getElementsByTagName('ide')[0];
            const total = xmlDoc.getElementsByTagName('ICMSTot')[0];
            const detItems = Array.from(xmlDoc.getElementsByTagName('det'));

            const nfeProducts: NfeProduct[] = detItems.map(item => {
                const prod = item.getElementsByTagName('prod')[0];
                const expirationDateStr = getTagValue(prod, 'dVal');
                return {
                    code: getTagValue(prod, 'cProd'),
                    name: getTagValue(prod, 'xProd'),
                    quantity: parseFloat(getTagValue(prod, 'qCom')),
                    unitPrice: parseFloat(getTagValue(prod, 'vUnCom')),
                    expirationDate: expirationDateStr ? parseISO(expirationDateStr) : undefined,
                };
            });
            
            const data: NfeData = {
                supplierName: getTagValue(emit, 'xNome'),
                supplierCnpj: getTagValue(emit, 'CNPJ'),
                totalValue: parseFloat(getTagValue(total, 'vNF')),
                products: nfeProducts,
            };

            setParsedData(data);
        } catch(error) {
            toast({title: "Erro ao ler XML", description: "O arquivo XML parece ser inválido ou não está no formato de NF-e esperado.", variant: "destructive"});
            setParsedData(null);
        }
    };
    
    const handleConfirmImport = async () => {
        if (!parsedData || !user || !currentBranch) return;
        setIsLoading(true);

        const batch = writeBatch(db);
        const productsRef = collection(db, 'products');

        try {
            for (const nfeProd of parsedData.products) {
                let productDocId: string;
                let isPerishable = !!nfeProd.expirationDate;

                // NF-e 'code' corresponds to Product 'barcode' for uniqueness within the branch
                const q = query(productsRef, where("branchId", "==", currentBranch.id), where("barcode", "==", nfeProd.code));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    // Create new product
                    const newProductRef = doc(productsRef);
                    productDocId = newProductRef.id;
                    const newProduct: Omit<Product, 'id'> = {
                        name: nfeProd.name,
                        barcode: nfeProd.code, // Use barcode for the product code from NF-e
                        category: 'Importado NF-e',
                        price: nfeProd.unitPrice * 1.5, // Default 50% margin
                        purchasePrice: nfeProd.unitPrice,
                        marginValue: 50,
                        marginType: 'percentage',
                        imageUrl: 'https://placehold.co/400x400.png',
                        lowStockThreshold: 10,
                        isSalable: true,
                        isPerishable: isPerishable,
                        branchId: currentBranch.id,
                        organizationId: user.organizationId,
                    };
                    batch.set(newProductRef, newProduct);
                } else {
                    // Product exists, update it if necessary
                    const existingDoc = querySnapshot.docs[0];
                    productDocId = existingDoc.id;
                    if(isPerishable && !existingDoc.data().isPerishable) {
                        batch.update(existingDoc.ref, { isPerishable: true });
                    }
                }

                // Add stock entry
                const stockEntryRef = doc(collection(db, 'stockEntries'));
                const stockEntry: Omit<StockEntry, 'id'> = {
                    productId: productDocId,
                    productName: nfeProd.name,
                    quantity: nfeProd.quantity,
                    type: 'entry',
                    date: new Date(),
                    userId: user.id,
                    userName: user.name,
                    branchId: currentBranch.id,
                    organizationId: user.organizationId,
                    notes: `Importado da NF-e - Fornecedor: ${parsedData.supplierName}`,
                    ...(nfeProd.expirationDate && { expirationDate: nfeProd.expirationDate }),
                };
                batch.set(stockEntryRef, stockEntry);
            }
            
            // Add expense
            const expenseRef = doc(collection(db, 'expenses'));
            const expense: Omit<Expense, 'id'> = {
                description: `Compra de Fornecedor - NF-e ${fileName}`,
                amount: parsedData.totalValue,
                category: 'Fornecedores',
                date: new Date(),
                supplierName: parsedData.supplierName,
                userId: user.id,
                userName: user.name,
                branchId: currentBranch.id,
                organizationId: user.organizationId,
            };
            batch.set(expenseRef, expense);

            await batch.commit();
            toast({ title: 'Importação Concluída!', description: `${parsedData.products.length} produtos e 1 despesa foram adicionados.` });
            setIsOpen(false);
            setParsedData(null);
            setFileName('');
        } catch (error) {
            console.error(error);
            toast({ title: "Erro na importação", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline"><Upload className="mr-2" /> Importar NF-e (XML)</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
                 <DialogHeader>
                    <DialogTitle>Importar Nota Fiscal Eletrônica (NF-e)</DialogTitle>
                    <DialogDescription>
                        Envie o arquivo XML da sua nota fiscal para cadastrar produtos, adicionar estoque e registrar a despesa automaticamente.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label htmlFor="xml-file">Arquivo XML da NF-e</Label>
                        <Input id="xml-file" type="file" accept=".xml,text/xml" onChange={handleFileChange} />
                        {fileName && <p className="text-sm text-muted-foreground">Arquivo: {fileName}</p>}
                    </div>

                    {parsedData && (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle className="text-base">Resumo da Nota</CardTitle></CardHeader>
                                <CardContent>
                                    <p><strong>Fornecedor:</strong> {parsedData.supplierName} ({parsedData.supplierCnpj})</p>
                                    <p><strong>Valor Total:</strong> R$ {parsedData.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                </CardContent>
                            </Card>
                            <h3 className="font-semibold">Produtos a serem importados</h3>
                             <ScrollArea className="h-60 w-full rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Qtd.</TableHead>
                                            <TableHead>Preço Custo</TableHead>
                                            <TableHead>Validade</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.products.map(p => (
                                            <TableRow key={p.code}>
                                                <TableCell>{p.name}</TableCell>
                                                <TableCell className="text-right">{p.quantity}</TableCell>
                                                <TableCell className="text-right">R$ {p.unitPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell className="text-right">{p.expirationDate ? p.expirationDate.toLocaleDateString('pt-BR') : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}
                 </div>
                 <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmImport} disabled={!parsedData || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar e Importar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
