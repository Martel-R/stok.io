

'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Printer, FileDown } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Sale, Product, Branch, StockEntry } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// --- Report Actions ---
interface ReportActionsProps {
  reportId: string;
  title: string;
  data: any[];
  headers: string[];
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}
function ReportActions({ onExportCSV, onExportExcel, onExportPDF }: ReportActionsProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-2" /> Imprimir
      </Button>
      <Button variant="outline" size="sm" onClick={onExportCSV}>
        <FileDown className="mr-2" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={onExportExcel}>
        <FileDown className="mr-2" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onExportPDF}>
        <FileDown className="mr-2" /> PDF
      </Button>
    </div>
  );
}

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

    const headers = ["Filial", "Receita Total", "Nº de Vendas", "Ticket Médio"];
    const dataForExport = performanceData.map(p => [
        p.name,
        `R$ ${p.totalRevenue.toFixed(2)}`,
        p.salesCount,
        `R$ ${p.averageTicket.toFixed(2)}`
    ]);

    const exportToCSV = () => {
        const csvContent = [headers.join(','), ...dataForExport.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'desempenho_vendas.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataForExport]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Desempenho');
        XLSX.writeFile(wb, 'desempenho_vendas.xlsx');
    };
    
    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("Desempenho de Vendas por Filial", 14, 16);
        autoTable(doc, {
            head: [headers],
            body: dataForExport,
            startY: 20
        });
        doc.save('desempenho_vendas.pdf');
    };

    return (
        <Card id="sales-performance-report">
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle>Desempenho de Vendas por Filial</CardTitle>
                    <CardDescription>Compare a receita, o número de vendas e o ticket médio entre as filiais.</CardDescription>
                </div>
                <ReportActions onExportCSV={exportToCSV} onExportExcel={exportToExcel} onExportPDF={exportToPDF} reportId="sales-performance" title="Desempenho de Vendas" data={performanceData} headers={headers} />
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

function BestSellingProductsReport({ branches, products, stockEntries }: { branches: Branch[], products: Product[], stockEntries: StockEntry[] }) {
    const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');

    const bestSellers = (() => {
         const productsSold = stockEntries
            .filter(s => s.branchId === selectedBranchId && s.type === 'sale')
            .reduce((acc, saleEntry) => {
                acc[saleEntry.productId] = (acc[saleEntry.productId] || 0) + Math.abs(saleEntry.quantity);
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(productsSold)
            .map(([productId, quantitySold]) => {
                const product = products.find(p => p.id === productId);
                if (!product) return null;
                return {
                    id: productId,
                    name: product.name,
                    category: product.category,
                    quantitySold,
                };
            })
            .filter((p): p is ProductSalesInfo => p !== null)
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .slice(0, 10);
    })();
    
    const headers = ["Produto", "Categoria", "Quantidade Vendida"];
    const dataForExport = bestSellers.map(p => [p.name, p.category, p.quantitySold]);

    const exportToCSV = () => {
        const csvContent = [headers.join(','), ...dataForExport.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'produtos_mais_vendidos.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataForExport]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Mais Vendidos');
        XLSX.writeFile(wb, 'produtos_mais_vendidos.xlsx');
    };
    
    const exportToPDF = () => {
        const doc = new jsPDF();
        const branchName = branches.find(b => b.id === selectedBranchId)?.name || '';
        doc.text(`Produtos Mais Vendidos - ${branchName}`, 14, 16);
        autoTable(doc, {
            head: [headers],
            body: dataForExport,
            startY: 20
        });
        doc.save('produtos_mais_vendidos.pdf');
    };

    return (
        <Card id="best-selling-report">
            <CardHeader>
                <div className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle>Produtos Mais Vendidos</CardTitle>
                        <CardDescription>Identifique os produtos com maior volume de vendas em uma filial específica.</CardDescription>
                    </div>
                     <ReportActions onExportCSV={exportToCSV} onExportExcel={exportToExcel} onExportPDF={exportToPDF} reportId="best-selling" title="Mais Vendidos" data={bestSellers} headers={headers} />
                </div>
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
    branchName: string;
}

function LowStockReport({ branches, products, stockEntries }: { branches: Branch[], products: Product[], stockEntries: StockEntry[] }) {
    
    const allLowStockProducts: LowStockProduct[] = [];
    const productsWithStock = products.map(product => {
        const stock = stockEntries
            .filter(e => e.productId === product.id)
            .reduce((sum, e) => sum + e.quantity, 0);
        return { ...product, stock };
    });
    
    branches.forEach(branch => {
        const lowStockProducts = productsWithStock
            .filter(p => p.branchId === branch.id && p.stock <= p.lowStockThreshold)
            .map(p => ({
                id: p.id,
                name: p.name,
                stock: p.stock,
                threshold: p.lowStockThreshold,
                branchName: branch.name,
            }));
        allLowStockProducts.push(...lowStockProducts);
    });

    const headers = ["Filial", "Produto", "Estoque Atual", "Limite"];
    const dataForExport = allLowStockProducts.map(p => [p.branchName, p.name, p.stock, p.threshold]);
    
    const exportToCSV = () => {
        const csvContent = [headers.join(','), ...dataForExport.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'estoque_baixo.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataForExport]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estoque Baixo');
        XLSX.writeFile(wb, 'estoque_baixo.xlsx');
    };
    
    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("Análise de Estoque Baixo", 14, 16);
        autoTable(doc, {
            head: [headers],
            body: dataForExport,
            startY: 20
        });
        doc.save('estoque_baixo.pdf');
    };


    return (
        <Card id="low-stock-report">
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle>Análise de Estoque Baixo</CardTitle>
                    <CardDescription>Liste todos os produtos que atingiram o limite de estoque baixo em cada filial.</CardDescription>
                </div>
                <ReportActions onExportCSV={exportToCSV} onExportExcel={exportToExcel} onExportPDF={exportToPDF} reportId="low-stock" title="Estoque Baixo" data={allLowStockProducts} headers={headers} />
            </CardHeader>
            <CardContent className="space-y-4">
                {branches.map(branch => {
                    const lowStockProducts = productsWithStock.filter(p => p.branchId === branch.id && p.stock <= p.lowStockThreshold);
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
                                            <TableCell className="text-right">{p.lowStockThreshold}</TableCell>
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
    const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);

    useEffect(() => {
        if (!user?.organizationId || user.role !== 'admin') {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all data scoped to the organization
                const salesQuery = query(collection(db, 'sales'), where('organizationId', '==', user.organizationId));
                const productsQuery = query(collection(db, 'products'), where('organizationId', '==', user.organizationId));
                const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', user.organizationId));
                const stockEntriesQuery = query(collection(db, 'stockEntries'), where('organizationId', '==', user.organizationId));


                const [salesSnapshot, productsSnapshot, branchesSnapshot, stockEntriesSnapshot] = await Promise.all([
                    getDocs(salesQuery),
                    getDocs(productsQuery),
                    getDocs(branchesQuery),
                    getDocs(stockEntriesQuery),
                ]);
                
                const salesData = salesSnapshot.docs.map(doc => {
                    const data = doc.data();
                    const date = data.date instanceof Timestamp ? data.date.toDate() : new Date();
                    return { ...data, id: doc.id, date } as Sale;
                });
                
                setSales(salesData);
                setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                setBranches(branchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
                setStockEntries(stockEntriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockEntry)));


            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
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
        <div className="space-y-6 printable-area">
            <div>
                <h1 className="text-3xl font-bold">Relatórios Gerenciais</h1>
                <p className="text-muted-foreground">Analise o desempenho geral do seu negócio com dados consolidados.</p>
            </div>
            
            <div className="space-y-4">
                <SalesPerformanceReport branches={branches} sales={sales} />
                <BestSellingProductsReport branches={branches} products={products} stockEntries={stockEntries} />
                <LowStockReport branches={branches} products={products} stockEntries={stockEntries} />
            </div>

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                     .flex.gap-2, .pt-2 {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}

