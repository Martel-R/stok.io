
'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, Sale } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { fromUnixTime, format, startOfDay, subDays } from 'date-fns';

interface DailyStockInfo {
    date: string;
    productName: string;
    category: string;
    entries: number;
    sales: number;
    finalStock: number;
}

const convertDate = (dateField: any): Date => {
    if (dateField instanceof Timestamp) {
        return dateField.toDate();
    }
    if (dateField && typeof dateField.seconds === 'number') {
        return fromUnixTime(dateField.seconds);
    }
    return new Date(); // Fallback
};

export default function InventoryPage() {
    const [dailyStock, setDailyStock] = useState<DailyStockInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, currentBranch, loading: authLoading } = useAuth();
    
    useEffect(() => {
        if (authLoading || !currentBranch) {
            setLoading(true);
            return;
        }

        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
        const salesQuery = query(collection(db, 'sales'), where('branchId', '==', currentBranch.id));
        const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));

        const unsubscribeProducts = onSnapshot(productsQuery, (productsSnapshot) => {
            const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            
            const unsubscribeSales = onSnapshot(salesQuery, (salesSnapshot) => {
                const salesData = salesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: convertDate(doc.data().date) } as Sale));
                
                const unsubscribeEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
                    const entriesData = entriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: convertDate(doc.data().date) } as StockEntry));

                    const processedData = processDailyStock(productsData, salesData, entriesData);
                    setDailyStock(processedData);
                    setLoading(false);
                });

                return () => unsubscribeEntries();
            });

            return () => unsubscribeSales();
        });

        return () => unsubscribeProducts();
    }, [currentBranch, authLoading]);

    const processDailyStock = (products: Product[], sales: Sale[], entries: StockEntry[]): DailyStockInfo[] => {
        if (products.length === 0) return [];
        
        const allDaysSet = new Set<string>();
        sales.forEach(s => allDaysSet.add(format(startOfDay(s.date), 'yyyy-MM-dd')));
        entries.forEach(e => allDaysSet.add(format(startOfDay(e.date), 'yyyy-MM-dd')));
        
        if (allDaysSet.size === 0) { // If no activity, show today
            allDaysSet.add(format(new Date(), 'yyyy-MM-dd'));
        }

        const allDays = Array.from(allDaysSet).sort((a,b) => b.localeCompare(a));
        const dailyStockInfo: DailyStockInfo[] = [];

        products.forEach(product => {
            allDays.forEach(day => {
                const dayDate = startOfDay(new Date(day));

                const salesOnDay = sales
                    .filter(s => s.productName === product.name && format(startOfDay(s.date), 'yyyy-MM-dd') === day)
                    .reduce((sum, s) => sum + s.quantity, 0);

                const entriesOnDay = entries
                    .filter(e => e.productId === product.id && format(startOfDay(e.date), 'yyyy-MM-dd') === day)
                    .reduce((sum, e) => sum + e.quantityAdded, 0);

                const finalStock = product.stock;

                dailyStockInfo.push({
                    date: day,
                    productName: product.name,
                    category: product.category,
                    entries: entriesOnDay,
                    sales: salesOnDay,
                    finalStock: finalStock
                });
            });
        });
        
        // Sort by date then by product name
        return dailyStockInfo.sort((a, b) => {
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            return a.productName.localeCompare(b.productName);
        });
    };
    

    const getStockStatus = (stock: number) => {
        const lowStockThreshold = currentBranch?.lowStockThreshold ?? 10;
        if (stock <= 0) return <Badge variant="destructive">Sem Estoque</Badge>;
        if (stock <= lowStockThreshold) return <Badge variant="secondary" className="bg-yellow-400 text-yellow-900">Estoque Baixo</Badge>;
        return <Badge variant="secondary" className="bg-green-400 text-green-900">Em Estoque</Badge>;
    };

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
            <h1 className="text-3xl font-bold">Relatório de Movimentação Diária</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Movimentação de Estoque</CardTitle>
                    <CardDescription>Visão diária da movimentação de produtos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Entradas</TableHead>
                                <TableHead className="text-right">Vendas</TableHead>
                                <TableHead className="text-right">Estoque Final</TableHead>
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
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : dailyStock.length > 0 ? (
                                dailyStock.map((item, index) => (
                                    (item.entries > 0 || item.sales > 0) &&
                                    <TableRow key={`${item.date}-${item.productName}`}>
                                        <TableCell className="font-medium">{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell>{getStockStatus(item.finalStock)}</TableCell>
                                        <TableCell className="text-right text-green-600">+{item.entries}</TableCell>
                                        <TableCell className="text-right text-red-500">-{item.sales}</TableCell>
                                        <TableCell className="text-right font-semibold">{item.finalStock}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Nenhum dado de movimentação encontrado. Adicione estoque ou faça vendas para começar.
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
