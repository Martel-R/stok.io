'use client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_PRODUCTS, MOCK_SALES } from '@/lib/mock-data';
import { BarChart, DollarSign, Package, Users } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import {addDays, format} from 'date-fns';

const totalRevenue = MOCK_SALES.reduce((acc, sale) => acc + sale.total, 0);
const totalSales = MOCK_SALES.length;
const totalProducts = MOCK_PRODUCTS.length;
const totalStock = MOCK_PRODUCTS.reduce((acc, p) => acc + p.stock, 0);

const salesDataLast7Days = Array.from({length: 7}).map((_, i) => {
    const date = addDays(new Date(), -i);
    const salesOnDay = MOCK_SALES.filter(s => format(s.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
    return {
        name: format(date, 'MMM d'),
        Sales: salesOnDay.reduce((acc, s) => acc + s.total, 0),
    }
}).reverse();

export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <div className="flex flex-col gap-8">
            <h1 className="text-3xl font-bold">Welcome back, {user?.name}!</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sales</CardTitle>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{totalSales.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">+180.1% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProducts}</div>
                        <p className="text-xs text-muted-foreground">in {MOCK_PRODUCTS.map(p => p.category).filter((v,i,a)=>a.indexOf(v)===i).length} categories</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStock.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">across all products</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Sales Overview (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <RechartsBarChart data={salesDataLast7Days}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="Sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="col-span-4 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            {MOCK_SALES.slice(0, 5).map(sale => (
                                <div key={sale.id} className="flex items-center">
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium leading-none">{sale.productName}</p>
                                        <p className="text-sm text-muted-foreground">by {sale.cashier}</p>
                                    </div>
                                    <div className="font-medium">+${sale.total.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
