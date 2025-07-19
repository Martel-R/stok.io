
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Sale, Product, Branch } from '@/lib/types';

// --- Sales Performance By Branch ---
interface BranchPerformance {
    id: string;
    name: string;
    totalRevenue: number;
    salesCount: number;
    averageTicket: number;
}

function SalesPerformanceReport({ branches, sales }: { branches: Branch[], sales: Sale[] }) {
    const performanceData: BranchPerformance[] = branches.map(branch => {
        const branchSales = sales.filter(s => s.branchId === branch.id);
        const totalRevenue = branchSales.reduce((acc, s) => acc + s.total, 0);
        const salesCount = branchSales.length;
        const averageTicket = salesCount > 0 ? totalRevenue / salesCount : 0;
        return {
            id: branch.id,
            name: branch.name,
            totalRevenue,
            salesCount,
            averageTicket
        };
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Desempenho de Vendas por Filial</CardTitle>
                <CardDescription>Compare a receita, o número de vendas e o ticket médio entre as filiais.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Filial</TableHead>
                            <TableHead className="text-right">Receita Total</TableHead>
                            <TableHead className="text-right">Nº de Vendas</TableHead>
                            <TableHead className="text-right">Ticket Médio</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {performanceData.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell className="text-right">R$ {p.totalRevenue.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{p.salesCount}</TableCell>
                                <TableCell className="text-right">R$ {p.averageTicket.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- Best Selling Products ---
interface ProductSalesInfo {
    id: string;
    name: string;
    category: string;
    quantitySold: number;
}

function BestSellingProductsReport({ branches, products, sales }: { branches: Branch[], products: Product[], sales: Sale[] }) {
    const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');

    const productsSold = sales
        .filter(s => s.branchId === selectedBranchId)
        .reduce((acc, sale) => {
            const product = products.find(p => p.name === sale.productName && p.branchId === selectedBranchId);
            if (product) {
                acc[product.id] = (acc[product.id] || 0) + sale.quantity;
            }
            return acc;
        }, {} as Record<string, number>);

    const bestSellers: ProductSalesInfo[] = Object.entries(productsSold)
        .map(([productId, quantitySold]) => {
            const product = products.find(p => p.id === productId)!;
            return {
                id: productId,
                name: product.name,
                category: product.category,
                quantitySold,
            };
        })
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 10); // Top 10

    return (
        <Card>
            <CardHeader>
                <CardTitle>Produtos Mais Vendidos</CardTitle>
                <CardDescription>Identifique os produtos com maior volume de vendas em uma filial específica.</CardDescription>
                <div className="pt-2">
                    <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Selecione uma filial" />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Quantidade Vendida</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bestSellers.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell>{p.category}</TableCell>
                                <TableCell className="text-right">{p.quantitySold}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

// --- Low Stock Analysis ---
interface LowStockProduct {
    id: string;
    name: string;
    stock: number;
    threshold: number;
}

function LowStockReport({ branches, products }: { branches: Branch[], products: Product[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Análise de Estoque Baixo</CardTitle>
                <CardDescription>Liste todos os produtos que atingiram o limite de estoque baixo em cada filial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {branches.map(branch => {
                    const lowStockProducts = products.filter(p => p.branchId === branch.id && p.stock <= branch.lowStockThreshold);
                    if (lowStockProducts.length === 0) return null;

                    return (
                        <div key={branch.id}>
                            <h3 className="font-semibold">{branch.name}</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Estoque Atual</TableHead>
                                        <TableHead className="text-right">Limite</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lowStockProducts.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell className="text-right">{p.stock}</TableCell>
                                            <TableCell className="text-right">{branch.lowStockThreshold}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}


export default function ReportsPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all data once for the reports
                const salesSnapshot = await getDocs(collection(db, 'sales'));
                const productsSnapshot = await getDocs(collection(db, 'products'));
                const branchesSnapshot = await getDocs(collection(db, 'branches'));
                
                const salesData = salesSnapshot.docs.map(doc => {
                    const data = doc.data();
                    const date = data.date instanceof Timestamp ? data.date.toDate() : new Date();
                    return { ...data, id: doc.id, date } as Sale;
                });
                
                setSales(salesData);
                setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                setBranches(branchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (user?.role === 'admin') {
            fetchData();
        }
    }, [user]);

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex h-full items-center justify-center">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2"><Lock /> Acesso Negado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Este recurso está disponível apenas para a função de Administrador.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (loading) {
        return (
            <div className="space-y-6">
                 <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Relatórios Gerenciais</h1>
                <p className="text-muted-foreground">Analise o desempenho geral do seu negócio com dados consolidados.</p>
            </div>
            
            <div className="space-y-4">
                <SalesPerformanceReport branches={branches} sales={sales} />
                <BestSellingProductsReport branches={branches} products={products} sales={sales} />
                <LowStockReport branches={branches} products={products} />
            </div>
        </div>
    );
}
