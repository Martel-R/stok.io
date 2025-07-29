
'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp, writeBatch, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, StockEntryType, Branch } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRightLeft, MinusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StockMovementForm } from '@/components/stock-movement-form';
import { useToast } from '@/hooks/use-toast';


const convertDate = (dateField: any): Date => {
    if (dateField instanceof Timestamp) {
        return dateField.toDate();
    }
    if (dateField && typeof dateField.seconds === 'number') {
        return new Date(dateField.seconds * 1000);
    }
    return new Date(); // Fallback
};

export default function InventoryPage() {
    const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, currentBranch, branches, loading: authLoading } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formType, setFormType] = useState<'entry' | 'adjustment' | 'transfer'>('entry');
    const { toast } = useToast();

    useEffect(() => {
        if (authLoading || !currentBranch) {
            setLoading(true);
            return;
        }

        const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id), orderBy('date', 'desc'));
        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));

        const unsubscribeEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
            const entriesData = entriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: convertDate(doc.data().date) } as StockEntry));
            setStockEntries(entriesData);
            setLoading(false);
        });

        const unsubscribeProducts = onSnapshot(productsQuery, (productsSnapshot) => {
            const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(productsData);
        });

        return () => {
            unsubscribeEntries();
            unsubscribeProducts();
        };
    }, [currentBranch, authLoading]);

    const handleOpenForm = (type: 'entry' | 'adjustment' | 'transfer') => {
        setFormType(type);
        setIsFormOpen(true);
    };

    const getBadgeForType = (type: StockEntryType) => {
        switch (type) {
            case 'entry': return <Badge variant="secondary" className="bg-green-100 text-green-800">Entrada</Badge>;
            case 'adjustment': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Ajuste (Saída)</Badge>;
            case 'sale': return <Badge variant="outline">Venda</Badge>;
            case 'transfer': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Transferência</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    }
    
    if (!currentBranch && !authLoading) {
        return (
            <Card className="m-auto">
                <CardHeader>
                    <CardTitle>Nenhuma Filial Selecionada</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Por favor, selecione uma filial no topo da página para ver o relatório de movimentação.</p>
                    <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Ajustes</Link>.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4">
                <h1 className="text-3xl font-bold">Movimentação de Estoque</h1>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleOpenForm('entry')}><PlusCircle className="mr-2" />Nova Entrada</Button>
                        <Button variant="outline" onClick={() => handleOpenForm('adjustment')}><MinusCircle className="mr-2" />Novo Ajuste</Button>
                        <Button variant="outline" onClick={() => handleOpenForm('transfer')} disabled={branches.length <= 1}><ArrowRightLeft className="mr-2" />Transferir</Button>
                    </div>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {formType === 'entry' && 'Nova Entrada de Estoque'}
                                {formType === 'adjustment' && 'Novo Ajuste de Estoque (Saída)'}
                                {formType === 'transfer' && 'Transferência de Estoque entre Filiais'}
                            </DialogTitle>
                             <DialogDescription>
                                {formType === 'transfer' ? "Selecione o produto, quantidade e filial de destino." : "Selecione o produto e a quantidade para registrar a movimentação."}
                            </DialogDescription>
                        </DialogHeader>
                        <StockMovementForm 
                            type={formType}
                            products={products}
                            branches={branches.filter(b => b.id !== currentBranch.id)}
                            onDone={() => setIsFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Movimentações</CardTitle>
                    <CardDescription>Visão completa de todas as movimentações de estoque da filial.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Quantidade</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Observações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    </TableRow>
                                ))
                            ) : stockEntries.length > 0 ? (
                                stockEntries.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{format(item.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell>{getBadgeForType(item.type)}</TableCell>
                                        <TableCell className={`text-right font-semibold ${item.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {item.quantity > 0 ? `+${item.quantity}` : item.quantity}
                                        </TableCell>
                                        <TableCell>{item.userName}</TableCell>
                                        <TableCell>
                                            {item.type === 'transfer' ? `Filial: ${item.relatedBranchName}` : item.notes}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Nenhuma movimentação encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
