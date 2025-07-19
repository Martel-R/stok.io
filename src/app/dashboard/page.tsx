
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, DollarSign, Package, Users } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { addDays, format, fromUnixTime } from 'date-fns';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Sale } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

// Helper para converter Timestamps do Firebase
const convertSaleDates = (sale: any): Sale => ({
  ...sale,
  date: sale.date instanceof Timestamp ? sale.date.toDate() : (typeof sale.date === 'object' && sale.date.seconds ? fromUnixTime(sale.date.seconds) : new Date(sale.date)),
});

export default function DashboardPage() {
    const { user, currentBranch, loading: authLoading } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!currentBranch || authLoading) {
            setLoadingData(!authLoading);
            return;
        }

        setLoadingData(true);

        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
        const salesQuery = query(collection(db, 'sales'), where('branchId', '==', currentBranch.id));

        const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(productsData);
        });

        const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
            const salesData = snapshot.docs.map(doc => convertSaleDates({ id: doc.id, ...doc.data() } as Sale));
            setSales(salesData);
            setLoadingData(false);
        });

        return () => {
            unsubscribeProducts();
            unsubscribeSales();
        };
    }, [currentBranch, authLoading]);
    
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalSalesCount = sales.length;
    const totalProducts = products.length;
    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);

    const salesDataLast7Days = Array.from({length: 7}).map((_, i) => {
        const date = addDays(new Date(), -i);
        const salesOnDay = sales.filter(s => format(s.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
        return {
            name: format(date, 'd/MMM'),
            Vendas: salesOnDay.reduce((acc, s) => acc + s.total, 0),
        }
    }).reverse();

    const recentSales = sales.sort((a,b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

    if (loadingData) {
        return (
             <div className="flex flex-col gap-8">
                 <Skeleton className="h-9 w-1/2" />
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     {Array.from({length: 4}).map((_, i) => (
                         <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-5 w-24"/>
                                <Skeleton className="h-4 w-4"/>
                            </CardHeader>
                             <CardContent>
                                 <Skeleton className="h-7 w-32"/>
                                 <Skeleton className="h-4 w-40 mt-1"/>
                             </CardContent>
                         </Card>
                     ))}
                 </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                         <CardHeader><Skeleton className="h-7 w-48"/></CardHeader>
                         <CardContent><Skeleton className="h-[350px] w-full"/></CardContent>
                    </Card>
                    <Card className="col-span-4 lg:col-span-3">
                         <CardHeader><Skeleton className="h-7 w-32"/></CardHeader>
                         <CardContent className="space-y-4">
                              {Array.from({length: 5}).map((_, i) => (
                                 <div key={i} className="flex items-center">
                                      <div className="flex-1 space-y-1">
                                          <Skeleton className="h-5 w-3/4"/>
                                           <Skeleton className="h-4 w-1/2"/>
                                      </div>
                                      <Skeleton className="h-5 w-16"/>
                                 </div>
                              ))}
                         </CardContent>
                    </Card>
                 </div>
             </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <h1 className="text-3xl font-bold">Painel da Filial: {currentBranch?.name}</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendas</CardTitle>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{totalSalesCount.toLocaleString('pt-BR')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProducts}</div>
                        <p className="text-xs text-muted-foreground">em {products.map(p => p.category).filter((v,i,a)=>a.indexOf(v)===i).length} categorias</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStock.toLocaleString('pt-BR')}</div>
                        <p className="text-xs text-muted-foreground">em todos os produtos</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Visão Geral de Vendas (Últimos 7 Dias)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <RechartsBarChart data={salesDataLast7Days}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                    }}
                                    formatter={(value: number) => [`R$${value.toLocaleString('pt-BR')}`, "Vendas"]}
                                />
                                <Legend />
                                <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="col-span-4 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Vendas Recentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            {recentSales.length > 0 ? recentSales.map((sale) => (
                                <div key={sale.id} className="flex items-center">
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium leading-none">{sale.productName}</p>
                                        <p className="text-sm text-muted-foreground">por {sale.cashier}</p>
                                    </div>
                                    <div className="font-medium">+R${sale.total.toFixed(2).replace('.',',')}</div>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center">Nenhuma venda registrada nesta filial ainda.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
