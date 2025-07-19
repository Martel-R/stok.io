
'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, Sale } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { fromUnixTime, format, startOfDay } from 'date-fns';

interface DailyStockInfo {
    date: string;
    productId: string;
    productName: string;
    category: string;
    initialStock: number;
    sales: number;
    finalStock: number;
}


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

        const unsubscribeProducts = onSnapshot(productsQuery, (productsSnapshot) => {
            const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            
            const unsubscribeSales = onSnapshot(salesQuery, (salesSnapshot) => {
                const salesData = salesSnapshot.docs.map(doc => {
                     const data = doc.data();
                     const date = data.date instanceof Date ? data.date : fromUnixTime(data.date.seconds);
                     return { ...data, id: doc.id, date } as Sale
                });

                const processedData = processDailyStock(productsData, salesData);
                setDailyStock(processedData);
                setLoading(false);
            });

            return () => unsubscribeSales();
        });

        return () => unsubscribeProducts();
    }, [currentBranch, authLoading]);

    const processDailyStock = (products: Product[], sales: Sale[]): DailyStockInfo[] => {
        if (products.length === 0) return [];
        
        const salesByProductAndDay: { [key: string]: number } = {};
        sales.forEach(sale => {
            const dateKey = format(startOfDay(sale.date), 'yyyy-MM-dd');
            const productKey = `${sale.productName}-${dateKey}`;
            salesByProductAndDay[productKey] = (salesByProductAndDay[productKey] || 0) + sale.quantity;
        });
        
        const allDays = Array.from(new Set(sales.map(s => format(startOfDay(s.date), 'yyyy-MM-dd')))).sort((a,b) => b.localeCompare(a));
        if (allDays.length === 0) { // If no sales, show today's stock
            allDays.push(format(new Date(), 'yyyy-MM-dd'));
        }

        const dailyStockInfo: DailyStockInfo[] = [];

        allDays.forEach(day => {
            products.forEach(product => {
                const productKey = `${product.name}-${day}`;
                const salesOnDay = salesByProductAndDay[productKey] || 0;
                
                // For this version, initial and final stock are based on current stock,
                // as we don't have historical stock data yet.
                const finalStock = product.stock;
                const initialStock = finalStock + salesOnDay;

                dailyStockInfo.push({
                    date: day,
                    productId: product.id,
                    productName: product.name,
                    category: product.category,
                    initialStock: initialStock,
                    sales: salesOnDay,
                    finalStock: finalStock
                });
            });
        });

        return dailyStockInfo;
    };
    

    const getStockStatus = (stock: number) => {
        const lowStockThreshold = currentBranch?.lowStockThreshold ?? 10; // Default to 10 if not set
        if (stock === 0) return <Badge variant="destructive">Sem Estoque</Badge>;
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
                                <TableHead>Categoria</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Qtd. Inicial</TableHead>
                                <TableHead className="text-right">Vendas</TableHead>
                                <TableHead className="text-right">Qtd. Final</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : dailyStock.length > 0 ? (
                                dailyStock.map((item, index) => (
                                    <TableRow key={`${item.date}-${item.productId}`}>
                                        <TableCell className="font-medium">{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell>{getStockStatus(item.finalStock)}</TableCell>
                                        <TableCell className="text-right">{item.initialStock}</TableCell>
                                        <TableCell className="text-right text-red-500">-{item.sales}</TableCell>
                                        <TableCell className="text-right font-semibold">{item.finalStock}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        Nenhum dado de movimentação encontrado. Faça vendas na Frente de Caixa para começar.
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

    