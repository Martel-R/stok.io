
'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';

function AddStockForm({ product, onDone }: { product: Product; onDone: () => void }) {
    const [quantity, setQuantity] = useState(1);
    const { user } = useAuth();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (quantity <= 0 || !user) {
            toast({ title: "Valor inválido", description: "A quantidade deve ser maior que zero.", variant: "destructive" });
            return;
        }

        const productRef = doc(db, 'products', product.id);
        const stockEntryRef = collection(db, 'stockEntries');

        try {
            await runTransaction(db, async (transaction) => {
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) {
                    throw "Produto não encontrado!";
                }

                const currentStock = productDoc.data().stock;
                const newStock = currentStock + quantity;

                transaction.update(productRef, { stock: newStock });

                const newStockEntry: Omit<StockEntry, 'id'> = {
                    productId: product.id,
                    productName: product.name,
                    quantityAdded: quantity,
                    previousStock: currentStock,
                    newStock: newStock,
                    date: serverTimestamp(),
                    userId: user.id,
                    userName: user.name,
                    branchId: product.branchId,
                }
                transaction.set(doc(stockEntryRef), newStockEntry);
            });

            toast({ title: "Estoque atualizado!", description: `${quantity} unidades de ${product.name} adicionadas.` });
            onDone();
        } catch (error) {
            console.error("Erro ao adicionar estoque:", error);
            toast({ title: "Erro na transação", description: "Não foi possível atualizar o estoque.", variant: "destructive" });
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <p>Adicionando estoque para: <span className="font-semibold">{product.name}</span></p>
                <p>Estoque atual: <span className="font-semibold">{product.stock}</span></p>
                <div>
                    <Label htmlFor="quantity">Quantidade a Adicionar</Label>
                    <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                        required
                    />
                </div>
            </div>
            <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
            </DialogFooter>
        </form>
    );
}

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const { currentBranch, loading: authLoading } = useAuth();
    const [lowStockThreshold, setLowStockThreshold] = useState(50);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        const storedThreshold = localStorage.getItem('lowStockThreshold');
        if (storedThreshold) {
            setLowStockThreshold(parseInt(storedThreshold, 10));
        }
    }, []);

    useEffect(() => {
        if (authLoading || !currentBranch) {
            setLoading(true);
            return;
        }

        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));

        const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(productsData.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentBranch, authLoading]);

    const getStockStatus = (stock: number) => {
        if (stock === 0) return <Badge variant="destructive">Sem Estoque</Badge>;
        if (stock <= lowStockThreshold) return <Badge variant="secondary" className="bg-yellow-400 text-yellow-900">Estoque Baixo</Badge>;
        return <Badge variant="secondary" className="bg-green-400 text-green-900">Em Estoque</Badge>;
    };

    const handleAddStockClick = (product: Product) => {
        setSelectedProduct(product);
        setIsFormOpen(true);
    };

    if (!currentBranch && !authLoading) {
        return (
            <Card className="m-auto">
                <CardHeader>
                    <CardTitle>Nenhuma Filial Selecionada</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Por favor, selecione uma filial no topo da página para ver o relatório de estoque.</p>
                    <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Configurações</Link>.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Gestão de Estoque</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Níveis de Estoque por Produto</CardTitle>
                    <CardDescription>Adicione novas quantidades de produtos ao seu inventário.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Estoque Atual</TableHead>
                                <TableHead className="text-center">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-9 w-32 mx-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : products.length > 0 ? (
                                products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell>{product.category}</TableCell>
                                        <TableCell>{getStockStatus(product.stock)}</TableCell>
                                        <TableCell className="text-right font-semibold">{product.stock}</TableCell>
                                        <TableCell className="text-center">
                                            <Button size="sm" onClick={() => handleAddStockClick(product)}>
                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                Adicionar Estoque
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Nenhum produto encontrado. Adicione produtos na página de <Link href="/dashboard/products" className="underline">Produtos</Link>.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            {selectedProduct && (
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Estoque</DialogTitle>
                        </DialogHeader>
                        <AddStockForm product={selectedProduct} onDone={() => setIsFormOpen(false)} />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
