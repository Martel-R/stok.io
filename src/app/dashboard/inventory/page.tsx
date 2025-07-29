
'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, StockEntryType, Branch } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRightLeft, MinusCircle, Package, History } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StockMovementForm } from '@/components/stock-movement-form';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const convertDate = (dateField: any): Date => {
    if (dateField instanceof Timestamp) return dateField.toDate();
    if (dateField && typeof dateField.seconds === 'number') return new Date(dateField.seconds * 1000);
    if (typeof dateField === 'string') return parseISO(dateField);
    return new Date(); // Fallback
};

interface DailyStockSummary {
    date: string;
    productId: string;
    productName: string;
    initialStock: number;
    entries: number;
    exits: number;
    finalStock: number;
    details: StockEntry[];
}

export default function InventoryPage() {
    const [allStockEntries, setAllStockEntries] = useState<StockEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, currentBranch, branches, loading: authLoading } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formType, setFormType] = useState<'entry' | 'adjustment' | 'transfer'>('entry');
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<DailyStockSummary | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (authLoading || !currentBranch) {
            setLoading(true);
            return;
        }

        const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));
        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));

        const unsubscribeEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
            const entriesData = entriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: convertDate(doc.data().date) } as StockEntry));
            setAllStockEntries(entriesData);
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

    const productsWithStock = useMemo(() => {
        return products.map(product => {
            const stock = allStockEntries
                .filter(e => e.productId === product.id)
                .reduce((sum, e) => sum + e.quantity, 0);
            return { ...product, stock };
        });
    }, [products, allStockEntries]);

    const dailyStockHistory = useMemo(() => {
        const sortedEntries = [...allStockEntries].sort((a,b) => a.date.getTime() - b.date.getTime());

        const groupedByDayAndProduct: Record<string, Record<string, StockEntry[]>> = {};

        sortedEntries.forEach(entry => {
            const day = format(entry.date, 'yyyy-MM-dd');
            if (!groupedByDayAndProduct[day]) groupedByDayAndProduct[day] = {};
            if (!groupedByDayAndProduct[day][entry.productId]) groupedByDayAndProduct[day][entry.productId] = [];
            groupedByDayAndProduct[day][entry.productId].push(entry);
        });

        const sortedDays = Object.keys(groupedByDayAndProduct).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
        const stockByProduct: Record<string, number> = {};
        const fullHistory: DailyStockSummary[] = [];

        for(const day of sortedDays) {
            const dayEntries = groupedByDayAndProduct[day];
            for (const productId in dayEntries) {
                const productEntries = dayEntries[productId];
                const productName = productEntries[0].productName;

                const entries = productEntries.filter(e => e.quantity > 0).reduce((sum, e) => sum + e.quantity, 0);
                const exits = productEntries.filter(e => e.quantity < 0).reduce((sum, e) => sum + e.quantity, 0);

                const initialStock = stockByProduct[productId] || 0;
                const finalStock = initialStock + entries + exits;
                
                fullHistory.push({
                    date: day,
                    productId,
                    productName,
                    initialStock,
                    entries,
                    exits: Math.abs(exits),
                    finalStock,
                    details: productEntries
                });
                stockByProduct[productId] = finalStock;
            }
        }

        return fullHistory.reverse();
    }, [allStockEntries]);

    const handleOpenForm = (type: 'entry' | 'adjustment' | 'transfer') => {
        setFormType(type);
        setIsFormOpen(true);
    };

    const getBadgeForType = (type: StockEntryType) => {
        switch (type) {
            case 'entry': return <Badge variant="secondary" className="bg-green-100 text-green-800">Entrada</Badge>;
            case 'adjustment': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Saída</Badge>;
            case 'sale': return <Badge variant="outline">Venda</Badge>;
            case 'transfer': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Transferência</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    }
    
    if (!currentBranch && !authLoading) {
        return (
            <Card className="m-auto">
                <CardHeader><CardTitle>Nenhuma Filial Selecionada</CardTitle></CardHeader>
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
                <h1 className="text-3xl font-bold">Gestão de Estoque</h1>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleOpenForm('entry')}><PlusCircle className="mr-2" />Entrada</Button>
                        <Button variant="outline" onClick={() => handleOpenForm('adjustment')}><MinusCircle className="mr-2" />Saída</Button>
                        <Button variant="outline" onClick={() => handleOpenForm('transfer')} disabled={branches.length <= 1}><ArrowRightLeft className="mr-2" />Transferir</Button>
                    </div>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {formType === 'entry' && 'Entrada de Estoque'}
                                {formType === 'adjustment' && 'Saída de Estoque'}
                                {formType === 'transfer' && 'Transferência de Estoque'}
                            </DialogTitle>
                             <DialogDescription>
                                {formType === 'transfer' ? "Selecione o produto, quantidade e filial de destino." : "Selecione o produto e a quantidade para registrar a movimentação."}
                            </DialogDescription>
                        </DialogHeader>
                        <StockMovementForm 
                            type={formType}
                            products={products}
                            branches={branches.filter(b => b.id !== currentBranch?.id)}
                            onDone={() => setIsFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="current">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="current"><Package className="mr-2"/> Estoque Atual</TabsTrigger>
                    <TabsTrigger value="history"><History className="mr-2"/> Histórico de Movimentações</TabsTrigger>
                </TabsList>
                <TabsContent value="current" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Estoque Atual</CardTitle>
                            <CardDescription>Visão geral das quantidades de cada produto na filial.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead className="text-right">Quantidade</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : productsWithStock.length > 0 ? (
                                        productsWithStock.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell>{item.category}</TableCell>
                                                <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">Nenhum produto encontrado.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="history" className="mt-4">
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
                                        <TableHead className="text-right">Est. Inicial</TableHead>
                                        <TableHead className="text-right text-green-600">Entradas</TableHead>
                                        <TableHead className="text-right text-red-500">Saídas</TableHead>
                                        <TableHead className="text-right">Est. Final</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : dailyStockHistory.length > 0 ? (
                                        dailyStockHistory.map((item, index) => (
                                            <TableRow key={`${item.date}-${item.productId}`} onClick={() => setSelectedHistoryItem(item)} className="cursor-pointer">
                                                <TableCell className="font-medium">{format(parseISO(item.date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>{item.productName}</TableCell>
                                                <TableCell className="text-right">{item.initialStock}</TableCell>
                                                <TableCell className="text-right text-green-600">+{item.entries}</TableCell>
                                                <TableCell className="text-right text-red-500">-{item.exits}</TableCell>
                                                <TableCell className="text-right font-semibold">{item.finalStock}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">Nenhuma movimentação encontrada.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            
            <Dialog open={!!selectedHistoryItem} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalhes da Movimentação</DialogTitle>
                        <DialogDescription>
                            {selectedHistoryItem?.productName} - {selectedHistoryItem && format(parseISO(selectedHistoryItem.date), 'dd/MM/yyyy')}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Quantidade</TableHead>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead>Obs.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedHistoryItem?.details.map(detail => (
                                     <TableRow key={detail.id}>
                                        <TableCell>{format(detail.date, 'HH:mm:ss')}</TableCell>
                                        <TableCell>{getBadgeForType(detail.type)}</TableCell>
                                        <TableCell className={`font-semibold ${detail.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {detail.quantity > 0 ? `+${detail.quantity}` : detail.quantity}
                                        </TableCell>
                                        <TableCell>{detail.userName}</TableCell>
                                        <TableCell>{detail.notes}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
