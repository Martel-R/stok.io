
'use client';
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Printer, FileDown, Calendar as CalendarIcon, Filter, TrendingUp, AlertTriangle, FileBarChart, Book, Activity, Package } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Sale, Branch, User, PaymentDetail, Product, StockEntry, PaymentCondition, Combo, Kit } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";


// --- General Report Component ---
function GeneralReport() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [paymentConditions, setPaymentConditions] = useState<PaymentCondition[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [combos, setCombos] = useState<Combo[]>([]);
    const [kits, setKits] = useState<Kit[]>([]);

    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        to: new Date(),
    });

    useEffect(() => {
        if (!user?.organizationId) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const orgId = user.organizationId;
                const queries = {
                    sales: getDocs(query(collection(db, 'sales'), where('organizationId', '==', orgId))),
                    branches: getDocs(query(collection(db, 'branches'), where('organizationId', '==', orgId))),
                    paymentConditions: getDocs(query(collection(db, 'paymentConditions'), where('organizationId', '==', orgId))),
                    products: getDocs(query(collection(db, 'products'), where('organizationId', '==', orgId))),
                    combos: getDocs(query(collection(db, 'combos'), where('organizationId', '==', orgId))),
                    kits: getDocs(query(collection(db, 'kits'), where('organizationId', '==', orgId))),
                };
                const [salesSnap, branchesSnap, conditionsSnap, productsSnap, combosSnap, kitsSnap] = await Promise.all(Object.values(queries));

                const branchesData = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                setSales(salesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, date: doc.data().date.toDate() } as Sale)));
                setBranches(branchesData);
                setPaymentConditions(conditionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentCondition)));
                setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                setCombos(combosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Combo)));
                setKits(kitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kit)));
                
                setSelectedBranchIds(branchesData.map(b => b.id));
            } catch (error) {
                console.error("Error fetching general report data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            if (sale.status === 'cancelled') return false;
            const saleDate = sale.date;
            const isAfterStart = dateRange?.from ? saleDate >= startOfDay(dateRange.from) : true;
            const isBeforeEnd = dateRange?.to ? saleDate <= endOfDay(dateRange.to) : true;
            return isAfterStart && isBeforeEnd && (selectedBranchIds.length === 0 || selectedBranchIds.includes(sale.branchId));
        }).sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [sales, dateRange, selectedBranchIds]);

    const financialData = useMemo(() => {
        const summary: { [key: string]: any } = {
            salesCount: filteredSales.length,
            grossRevenue: 0,
            netRevenue: 0,
            payments: {}
        };
        
        filteredSales.forEach(sale => {
            summary.grossRevenue += sale.total;
            let saleFee = 0;
            sale.payments?.forEach(p => {
                const condition = paymentConditions.find(c => c.id === p.conditionId);
                const fee = condition ? (condition.feeType === 'percentage' ? p.amount * (condition.fee / 100) : condition.fee) : 0;
                saleFee += fee;
                
                const typeName = condition?.name || 'Desconhecido';
                if (!summary.payments[typeName]) summary.payments[typeName] = { gross: 0, net: 0 };
                summary.payments[typeName].gross += p.amount;
                summary.payments[typeName].net += (p.amount - fee);
            });
            summary.netRevenue += (sale.total - saleFee);
        });

        return summary;
    }, [filteredSales, paymentConditions]);
    
    const productsSold = useMemo(() => {
        const productMap = new Map<string, { id: string; name: string, quantity: number, originalValue: number, finalValue: number }>();
        
        const processProduct = (productId: string, name: string, quantity: number, originalValue: number, finalValue: number) => {
            const existing = productMap.get(name) || { id: productId, name, quantity: 0, originalValue: 0, finalValue: 0 };
            existing.quantity += quantity;
            existing.originalValue += originalValue;
            existing.finalValue += finalValue;
            productMap.set(name, existing);
        };

        filteredSales.forEach(sale => {
            (sale.items || []).forEach((item: any) => {
                 if (item.type === 'product') {
                     const product = products.find(p => p.id === item.id);
                     if (product) {
                        const value = item.quantity * product.price;
                        processProduct(item.id, item.name, item.quantity, value, value);
                     }
                 } else if (item.type === 'kit') {
                     const originalKitPrice = (item.chosenProducts || []).reduce((sum: number, p: any) => sum + (p.price || 0), 0);
                     let discountRatio = 1;
                     if (originalKitPrice > 0 && typeof item.total === 'number' && !isNaN(item.total)) {
                         discountRatio = item.total / originalKitPrice;
                     }
                     if (isNaN(discountRatio)) discountRatio = 1;
                     
                     (item.chosenProducts || []).forEach((p: any) => {
                         const product = products.find(prod => prod.id === p.id);
                         if (product) {
                             const originalValue = item.quantity * product.price;
                             const finalValue = originalValue * discountRatio;
                             processProduct(p.id, p.name, item.quantity, originalValue, finalValue);
                         }
                     });
                 } else if (item.type === 'combo') {
                    let discountRatio = 1;
                    if (item.originalPrice > 0 && typeof item.finalPrice === 'number' && !isNaN(item.finalPrice)) {
                        discountRatio = item.finalPrice / item.originalPrice;
                    }
                     if (isNaN(discountRatio)) discountRatio = 1;
                    
                    (item.products || []).forEach((p: any) => {
                         const product = products.find(prod => prod.id === p.productId);
                         if (product) {
                            const originalValue = item.quantity * p.quantity * product.price;
                            const finalValue = originalValue * discountRatio;
                            processProduct(p.productId, p.productName, p.quantity * item.quantity, originalValue, finalValue);
                         }
                     })
                 }
            });
        });
        
        return Array.from(productMap.values()).sort((a,b) => b.quantity - a.quantity);
    }, [filteredSales, products, combos, kits]);

     const productTotals = useMemo(() => {
        return productsSold.reduce((acc, p) => {
            acc.quantity += p.quantity;
            acc.originalValue += p.originalValue;
            acc.finalValue += p.finalValue;
            return acc;
        }, { quantity: 0, originalValue: 0, finalValue: 0 });
    }, [productsSold]);

    if (loading) return <Skeleton className="h-[500px] w-full" />;
    
    const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                         <div className="flex flex-wrap gap-2">
                            <MultiSelectPopover title="Filiais" items={branches} selectedIds={selectedBranchIds} setSelectedIds={setSelectedBranchIds} />
                            <DateRangePicker date={dateRange} onSelect={setDateRange} />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resumo Financeiro</CardTitle>
                    <CardDescription>Visão geral das finanças no período selecionado.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader><CardTitle>Receitas</CardTitle></CardHeader>
                        <CardContent>
                            <p>Vendas: {financialData.salesCount}</p>
                            <p>Receita Bruta: {formatCurrency(financialData.grossRevenue)}</p>
                            <p className="font-semibold">Receita Líquida: {formatCurrency(financialData.netRevenue)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
                        <CardContent>
                            <p>Produtos Únicos: {productsSold.length}</p>
                            <p>Unidades Vendidas: {productTotals.quantity.toLocaleString('pt-BR')}</p>
                        </CardContent>
                    </Card>
                    <Card className="md:col-span-2">
                        <CardHeader><CardTitle>Detalhes por Pagamento</CardTitle></CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader><TableRow><TableHead>Método</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Líquido</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {Object.entries(financialData.payments).map(([name, values]: [string, any]) => (
                                        <TableRow key={name}>
                                            <TableCell>{name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(values.gross)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(values.net)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader><CardTitle>Produtos Vendidos</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-right">Quantidade</TableHead>
                                <TableHead className="text-right">Valor Bruto</TableHead>
                                <TableHead className="text-right text-destructive">Descontos</TableHead>
                                <TableHead className="text-right">Valor Final</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {productsSold.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell className="text-right">{p.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.originalValue)}</TableCell>
                                    <TableCell className="text-right text-destructive">-{formatCurrency(p.originalValue - p.finalValue)}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(p.finalValue)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right">{productTotals.quantity.toLocaleString('pt-BR')}</TableCell>
                                <TableCell className="text-right">{formatCurrency(productTotals.originalValue)}</TableCell>
                                <TableCell className="text-right text-destructive">-{formatCurrency(productTotals.originalValue - productTotals.finalValue)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(productTotals.finalValue)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>

             <Card>
                <CardHeader><CardTitle>Vendas Detalhadas</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Filial</TableHead>
                                <TableHead>Itens</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSales.map(sale => (
                                <TableRow key={sale.id}>
                                    <TableCell>{format(sale.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell>{branches.find(b => b.id === sale.branchId)?.name || 'N/A'}</TableCell>
                                    <TableCell>
                                        {sale.items.map((item: any, index: number) => (
                                            <div key={item.id + index}>
                                                <span className="font-semibold">{item.quantity}x {item.name}</span>
                                                {(item.type === 'kit' && item.chosenProducts) && (
                                                     <div className="pl-4 text-xs text-muted-foreground">
                                                        ({item.chosenProducts.map((p: any) => p.name).join(', ')})
                                                     </div>
                                                )}
                                                {(item.type === 'combo' && item.products) && (
                                                     <div className="pl-4 text-xs text-muted-foreground">
                                                        ({item.products.map((p: any) => `${p.quantity}x ${p.productName}`).join(', ')})
                                                     </div>
                                                )}
                                            </div>
                                        ))}
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(sale.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

// --- Sales Report Component ---
function SalesReport() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Filter states
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    const [selectedCashierIds, setSelectedCashierIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });

     useEffect(() => {
        if (!user?.organizationId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const orgId = user.organizationId;
                const salesQuery = query(collection(db, 'sales'), where('organizationId', '==', orgId));
                const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', orgId));
                const usersQuery = query(collection(db, 'users'), where('organizationId', '==', orgId));

                const [salesSnap, branchesSnap, usersSnap] = await Promise.all([
                    getDocs(salesQuery),
                    getDocs(branchesQuery),
                    getDocs(usersQuery),
                ]);

                const salesData = salesSnap.docs.map(doc => {
                    const data = doc.data();
                    const date = data.date instanceof Timestamp ? data.date.toDate() : new Date();
                    return { ...data, id: doc.id, date } as Sale;
                });
                
                const branchesData = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                
                setSales(salesData);
                setBranches(branchesData);
                setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
                
                setSelectedBranchIds(branchesData.map(b => b.id));

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const cashiers = useMemo(() => {
        const cashierNames = new Set(sales.map(s => s.cashier));
        return Array.from(cashierNames).map(name => ({ id: name, name }));
    }, [sales]);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            if (sale.status === 'cancelled') return false;
            
            const saleDate = sale.date;
            const isAfterStart = dateRange?.from ? saleDate >= startOfDay(dateRange.from) : true;
            const isBeforeEnd = dateRange?.to ? saleDate <= endOfDay(dateRange.to) : true;
            const inDateRange = isAfterStart && isBeforeEnd;

            const inBranch = selectedBranchIds.length === 0 || selectedBranchIds.includes(sale.branchId);
            const byCashier = selectedCashierIds.length === 0 || selectedCashierIds.includes(sale.cashier);

            return inDateRange && inBranch && byCashier;
        }).sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [sales, dateRange, selectedBranchIds, selectedCashierIds]);
    
    const totalFilteredRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

    const formatPayments = (payments: PaymentDetail[]) => {
        if (!payments) return 'N/A';
        return payments.map(p => {
            const installments = p.installments > 1 ? ` (${p.installments}x)` : '';
            return `${p.conditionName}${installments}: R$ ${p.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }).join('; ');
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("Relatório de Vendas", 14, 16);
        autoTable(doc, {
            head: [['Data', 'Filial', 'Vendedor', 'Itens', 'Pagamentos', 'Total']],
            body: filteredSales.map(s => [
                format(s.date, 'dd/MM/yyyy HH:mm'),
                branches.find(b => b.id === s.branchId)?.name || 'N/A',
                s.cashier,
                s.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
                formatPayments(s.payments),
                `R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]),
            startY: 20
        });
        doc.save('relatorio_vendas.pdf');
    };

    const exportToExcel = () => {
        const data = filteredSales.map(s => ({
            'Data': format(s.date, 'dd/MM/yyyy HH:mm'),
            'Filial': branches.find(b => b.id === s.branchId)?.name || 'N/A',
            'Vendedor': s.cashier,
            'Itens': s.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
            'Pagamentos': formatPayments(s.payments),
            'Total': s.total
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
        XLSX.writeFile(wb, 'relatorio_vendas.xlsx');
    };

    if (loading) {
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <Card>
            <CardHeader className="no-print">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                     <div className="flex flex-wrap gap-2">
                        <MultiSelectPopover title="Filiais" items={branches} selectedIds={selectedBranchIds} setSelectedIds={setSelectedBranchIds} />
                        <MultiSelectPopover title="Vendedores" items={cashiers} selectedIds={selectedCashierIds} setSelectedIds={setSelectedCashierIds} />
                        <DateRangePicker date={dateRange} onSelect={setDateRange} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="mr-2" /> Imprimir
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportToPDF}>
                        <FileDown className="mr-2" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportToExcel}>
                        <FileDown className="mr-2" /> Excel
                      </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4 font-semibold no-print">
                   Exibindo {filteredSales.length} de {sales.length} vendas. Total Filtrado: R$ {totalFilteredRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="printable-area">
                    <div className="print-header hidden print:block mb-4">
                        <h2 className="text-xl font-bold">Relatório de Vendas</h2>
                        <p className="text-sm">Período: {dateRange?.from && format(dateRange.from, 'dd/MM/yy')} - {dateRange?.to && format(dateRange.to, 'dd/MM/yy')}</p>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Filial</TableHead>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Itens</TableHead>
                                <TableHead>Pagamentos</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSales.map(sale => (
                                <TableRow key={sale.id}>
                                    <TableCell>{format(sale.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell>{branches.find(b => b.id === sale.branchId)?.name || 'N/A'}</TableCell>
                                    <TableCell>{sale.cashier}</TableCell>
                                    <TableCell>
                                        {sale.items.map((item: any, index: number) => (
                                            <div key={item.id + index}>
                                                <span className="font-semibold">{item.quantity}x {item.name}</span>
                                                {(item.type === 'kit' && item.chosenProducts) && (
                                                     <div className="pl-4 text-xs text-muted-foreground">
                                                        ({item.chosenProducts.map((p: any) => p.name).join(', ')})
                                                     </div>
                                                )}
                                            </div>
                                        ))}
                                    </TableCell>
                                    <TableCell>
                                        {sale.payments?.map(p => (
                                            <div key={p.conditionId} className="text-xs">
                                                {p.conditionName} ({p.installments}x): <span className="font-medium">R$ {p.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                            </div>
                                        ))}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">R$ {sale.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     {filteredSales.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum resultado encontrado para os filtros selecionados.</p>}
                </div>
            </CardContent>
        </Card>
    );
}

// --- Top Selling Products Report ---
function TopSellingProductsReport() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });

    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const orgId = user.organizationId;
                const salesQuery = query(collection(db, 'sales'), where('organizationId', '==', orgId));
                const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', orgId));

                const [salesSnap, branchesSnap] = await Promise.all([
                    getDocs(salesQuery),
                    getDocs(branchesQuery),
                ]);

                const salesData = salesSnap.docs.map(doc => {
                    const data = doc.data();
                    const date = data.date instanceof Timestamp ? data.date.toDate() : new Date();
                    return { ...data, id: doc.id, date } as Sale;
                });
                const branchesData = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                
                setSales(salesData);
                setBranches(branchesData);
                setSelectedBranchIds(branchesData.map(b => b.id));

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const topProducts = useMemo(() => {
        const filteredSales = sales.filter(sale => {
            if (sale.status === 'cancelled') return false;
            
            const saleDate = sale.date;
            const isAfterStart = dateRange?.from ? saleDate >= startOfDay(dateRange.from) : true;
            const isBeforeEnd = dateRange?.to ? saleDate <= endOfDay(dateRange.to) : true;
            const inDateRange = isAfterStart && isBeforeEnd;
            const inBranch = selectedBranchIds.length === 0 || selectedBranchIds.includes(sale.branchId);
            return inDateRange && inBranch;
        });

        const productSales = new Map<string, { name: string; salesContext: string[] }>();

        filteredSales.forEach(sale => {
            sale.items.forEach((item: any) => {
                 if (item.type === 'product') {
                    const existing = productSales.get(item.id) || { name: item.name, salesContext: [] };
                    existing.salesContext.push('Individual');
                    productSales.set(item.id, existing);
                } else if (item.type === 'combo' && item.products) {
                    item.products.forEach((p: any) => {
                         const existing = productSales.get(p.productId) || { name: p.productName, salesContext: [] };
                         existing.salesContext.push(`Combo: ${item.name}`);
                         productSales.set(p.productId, existing);
                    });
                } else if (item.type === 'kit' && item.chosenProducts) {
                    item.chosenProducts.forEach((p: any) => {
                         const existing = productSales.get(p.id) || { name: p.name, salesContext: [] };
                         existing.salesContext.push(`Kit: ${item.name}`);
                         productSales.set(p.id, existing);
                    });
                }
            });
        });
        
        return Array.from(productSales.entries()).map(([id, data]) => ({ id, ...data }));

    }, [sales, dateRange, selectedBranchIds]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("Relatório de Produtos Vendidos", 14, 16);
        autoTable(doc, {
            head: [['Produto', 'Contexto da Venda']],
            body: topProducts.map(p => [
                p.name,
                p.salesContext.join(', ')
            ]),
            startY: 20
        });
        doc.save('relatorio_produtos_vendidos.pdf');
    };

    const exportToExcel = () => {
        const data = topProducts.map(p => ({
            'Produto': p.name,
            'Contexto da Venda': p.salesContext.join(', ')
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Produtos Vendidos');
        XLSX.writeFile(wb, 'relatorio_produtos_vendidos.xlsx');
    };

    if (loading) return <Skeleton className="h-96 w-full" />;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        <MultiSelectPopover title="Filiais" items={branches} selectedIds={selectedBranchIds} setSelectedIds={setSelectedBranchIds} />
                        <DateRangePicker date={dateRange} onSelect={setDateRange} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportToPDF}><FileDown className="mr-2" /> PDF</Button>
                      <Button variant="outline" size="sm" onClick={exportToExcel}><FileDown className="mr-2" /> Excel</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Contexto da Venda</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topProducts.map(product => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {product.salesContext.slice(0, 5).map((ctx, i) => <Badge key={i} variant="secondary">{ctx}</Badge>)}
                                        {product.salesContext.length > 5 && <Badge variant="outline">...</Badge>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {topProducts.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum produto vendido no período selecionado.</p>}
            </CardContent>
        </Card>
    );
}

// --- Low Stock Report ---
function LowStockReport() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [allStockEntries, setAllStockEntries] = useState<StockEntry[]>([]);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    
    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const orgId = user.organizationId;
                const productsQuery = query(collection(db, 'products'), where('organizationId', '==', orgId));
                const stockEntriesQuery = query(collection(db, 'stockEntries'), where('organizationId', '==', orgId));
                const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', orgId));

                const [productsSnap, stockEntriesSnap, branchesSnap] = await Promise.all([
                    getDocs(productsQuery),
                    getDocs(stockEntriesQuery),
                    getDocs(branchesQuery)
                ]);

                setAllProducts(productsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Product));
                setAllStockEntries(stockEntriesSnap.docs.map(d => d.data() as StockEntry));
                const branchesData = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                setAllBranches(branchesData);
                setSelectedBranchIds(branchesData.map(b => b.id));

            } catch (error) {
                console.error("Error fetching low stock data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const lowStockData = useMemo(() => {
        const productMap = new Map<string, {
            name: string;
            lowStockThreshold: number;
            totalStock: number;
            branchStock: { [key: string]: number };
        }>();

        // 1. Calculate stock for each product in each branch
        const stockByProductAndBranch = new Map<string, number>(); // key: `${productId}_${branchId}`
        for (const entry of allStockEntries) {
            const key = `${entry.productId}_${entry.branchId}`;
            const currentStock = stockByProductAndBranch.get(key) || 0;
            stockByProductAndBranch.set(key, currentStock + (Number(entry.quantity) || 0));
        }

        // 2. Group by product name across all branches
        for (const product of allProducts) {
            if (!productMap.has(product.name)) {
                productMap.set(product.name, {
                    name: product.name,
                    lowStockThreshold: product.lowStockThreshold, // Note: this assumes threshold is consistent
                    totalStock: 0,
                    branchStock: {},
                });
            }

            const stock = stockByProductAndBranch.get(`${product.id}_${product.branchId}`) || 0;
            const productData = productMap.get(product.name)!;
            
            productData.totalStock += stock;
            productData.branchStock[product.branchId] = stock;
        }

        // 3. Filter for low stock and sort
        return Array.from(productMap.values())
            .filter(p => p.totalStock <= p.lowStockThreshold)
            .sort((a, b) => (a.totalStock - a.lowStockThreshold) - (b.totalStock - b.lowStockThreshold));

    }, [allProducts, allStockEntries]);

    const filteredBranches = useMemo(() => {
        return allBranches.filter(b => selectedBranchIds.includes(b.id));
    }, [allBranches, selectedBranchIds]);
    
    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("Relatório de Estoque Baixo", 14, 16);
        let head = [['Produto', 'Est. Mínimo', 'Est. Total']];
        filteredBranches.forEach(b => head[0].push(b.name));

        const body = lowStockData.map(p => {
            let row = [
                p.name,
                p.lowStockThreshold.toString(),
                p.totalStock.toString(),
            ];
            filteredBranches.forEach(b => {
                 row.push((p.branchStock[b.id] ?? 0).toString());
            });
            return row;
        });

        autoTable(doc, { head, body, startY: 20 });
        doc.save('relatorio_estoque_baixo.pdf');
    };

    const exportToExcel = () => {
        const data = lowStockData.map(p => {
            const row: { [key: string]: any } = {
                'Produto': p.name,
                'Estoque Mínimo': p.lowStockThreshold,
                'Estoque Total': p.totalStock,
            };
            filteredBranches.forEach(b => {
                row[b.name] = p.branchStock[b.id] ?? 0;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estoque Baixo');
        XLSX.writeFile(wb, 'relatorio_estoque_baixo.xlsx');
    };

    if (loading) return <Skeleton className="h-96 w-full" />;

    return (
        <Card>
            <CardHeader>
                 <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        <MultiSelectPopover title="Filiais" items={allBranches} selectedIds={selectedBranchIds} setSelectedIds={setSelectedBranchIds} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportToPDF}><FileDown className="mr-2" /> PDF</Button>
                      <Button variant="outline" size="sm" onClick={exportToExcel}><FileDown className="mr-2" /> Excel</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Est. Mínimo</TableHead>
                            <TableHead className="text-right">Est. Total</TableHead>
                            {filteredBranches.map(branch => (
                                <TableHead key={branch.id} className="text-right">{branch.name}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lowStockData.map(product => (
                            <TableRow key={product.name} className={product.totalStock <= 0 ? "text-destructive font-bold" : "text-yellow-600"}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell className="text-right">{product.lowStockThreshold}</TableCell>
                                <TableCell className="text-right font-semibold">{product.totalStock}</TableCell>
                                {filteredBranches.map(branch => (
                                    <TableCell key={branch.id} className="text-right">
                                        {product.branchStock[branch.id] ?? 0}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {lowStockData.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum produto com estoque baixo.</p>}
            </CardContent>
        </Card>
    )
}

// --- Financial Summary Report ---
function FinancialSummaryReport() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [paymentConditions, setPaymentConditions] = useState<PaymentCondition[]>([]);

    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });

    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const orgId = user.organizationId;
                const salesQuery = query(collection(db, 'sales'), where('organizationId', '==', orgId));
                const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', orgId));
                const conditionsQuery = query(collection(db, 'paymentConditions'), where('organizationId', '==', orgId));

                const [salesSnap, branchesSnap, conditionsSnap] = await Promise.all([
                    getDocs(salesQuery),
                    getDocs(branchesQuery),
                    getDocs(conditionsQuery),
                ]);

                setSales(salesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, date: doc.data().date.toDate() } as Sale)));
                setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
                setPaymentConditions(conditionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentCondition)));
            } catch (error) {
                console.error("Error fetching financial data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const financialData = useMemo(() => {
        const filteredSales = sales.filter(sale => {
            if (sale.status === 'cancelled') return false;
            
            const saleDate = sale.date;
            const isAfterStart = dateRange?.from ? saleDate >= startOfDay(dateRange.from) : true;
            const isBeforeEnd = dateRange?.to ? saleDate <= endOfDay(dateRange.to) : true;
            return isAfterStart && isBeforeEnd;
        });

        const summary = branches.map(branch => {
            const branchSales = filteredSales.filter(s => s.branchId === branch.id);
            const grossRevenue = branchSales.reduce((sum, s) => sum + s.total, 0);
            const salesCount = branchSales.length;

            const paymentsSummary: { [key: string]: { gross: number, net: number } } = {};
            let totalFees = 0;

            branchSales.forEach(sale => {
                sale.payments.forEach(payment => {
                    const condition = paymentConditions.find(c => c.id === payment.conditionId);
                    const fee = condition ? (condition.feeType === 'percentage' ? payment.amount * (condition.fee / 100) : condition.fee) : 0;
                    totalFees += fee;
                    
                    const typeName = condition?.name || 'Desconhecido';
                    if (!paymentsSummary[typeName]) paymentsSummary[typeName] = { gross: 0, net: 0 };
                    paymentsSummary[typeName].gross += payment.amount;
                    paymentsSummary[typeName].net += (payment.amount - fee);
                });
            });

            return {
                branchId: branch.id,
                branchName: branch.name,
                salesCount,
                grossRevenue,
                netRevenue: grossRevenue - totalFees,
                payments: paymentsSummary
            };
        });

        return summary;
    }, [sales, branches, paymentConditions, dateRange]);

    const uniquePaymentTypes = useMemo(() => {
        const types = new Set<string>();
        financialData.forEach(d => Object.keys(d.payments).forEach(p => types.add(p)));
        return Array.from(types).sort();
    }, [financialData]);

    const totals = useMemo(() => {
        const initialTotals = {
            salesCount: 0,
            grossRevenue: 0,
            netRevenue: 0,
            payments: {} as { [key: string]: { gross: number; net: number } },
        };

        uniquePaymentTypes.forEach(type => {
            initialTotals.payments[type] = { gross: 0, net: 0 };
        });

        return financialData.reduce((acc, branchData) => {
            acc.salesCount += branchData.salesCount;
            acc.grossRevenue += branchData.grossRevenue;
            acc.netRevenue += branchData.netRevenue;
            
            uniquePaymentTypes.forEach(type => {
                const payment = branchData.payments[type] || { gross: 0, net: 0 };
                if (!acc.payments[type]) acc.payments[type] = { gross: 0, net: 0 };
                acc.payments[type].gross += payment.gross;
                acc.payments[type].net += payment.net;
            });

            return acc;
        }, initialTotals);
    }, [financialData, uniquePaymentTypes]);


    const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const exportToPDF = () => {
         const doc = new jsPDF({ orientation: "landscape" });
        doc.text("Relatório de Resumo Financeiro", 14, 16);
        
        let head = [['Filial', 'Vendas', 'Total Bruto', 'Total Líquido']];
        uniquePaymentTypes.forEach(p => {
            head[0].push(`${p} (Bruto)`);
            head[0].push(`${p} (Líquido)`);
        });

        const body = financialData.map(d => {
             let row = [
                d.branchName,
                d.salesCount.toString(),
                formatCurrency(d.grossRevenue),
                formatCurrency(d.netRevenue),
            ];
             uniquePaymentTypes.forEach(p => {
                const payment = d.payments[p] || { gross: 0, net: 0 };
                row.push(formatCurrency(payment.gross));
                row.push(formatCurrency(payment.net));
            });
            return row;
        });

        autoTable(doc, { head, body, startY: 20 });
        doc.save('relatorio_financeiro.pdf');
    };

     const exportToExcel = () => {
        const data = financialData.map(d => {
            const row: { [key: string]: any } = {
                'Filial': d.branchName,
                'Vendas': d.salesCount,
                'Total Bruto': d.grossRevenue,
                'Total Líquido': d.netRevenue
            };
             uniquePaymentTypes.forEach(p => {
                const payment = d.payments[p] || { gross: 0, net: 0 };
                row[`${p} (Bruto)`] = payment.gross;
                row[`${p} (Líquido)`] = payment.net;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Resumo Financeiro');
        XLSX.writeFile(wb, 'relatorio_financeiro.xlsx');
    };

    if (loading) return <Skeleton className="h-96 w-full" />;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        <DateRangePicker date={dateRange} onSelect={setDateRange} />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportToPDF}><FileDown className="mr-2" /> PDF</Button>
                        <Button variant="outline" size="sm" onClick={exportToExcel}><FileDown className="mr-2" /> Excel</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Filial</TableHead>
                            <TableHead className="text-right">Vendas</TableHead>
                            <TableHead className="text-right">Total Bruto</TableHead>
                            <TableHead className="text-right">Total Líquido</TableHead>
                            {uniquePaymentTypes.map(p => (
                                <React.Fragment key={p}>
                                    <TableHead className="text-right">{p} (Bruto)</TableHead>
                                    <TableHead className="text-right">{p} (Líquido)</TableHead>
                                </React.Fragment>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {financialData.map(d => (
                             <TableRow key={d.branchId}>
                                <TableCell className="font-medium">{d.branchName}</TableCell>
                                <TableCell className="text-right">{d.salesCount}</TableCell>
                                <TableCell className="text-right">{formatCurrency(d.grossRevenue)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(d.netRevenue)}</TableCell>
                                {uniquePaymentTypes.map(p => {
                                    const payment = d.payments[p] || { gross: 0, net: 0 };
                                    return (
                                        <React.Fragment key={p}>
                                            <TableCell className="text-right">{formatCurrency(payment.gross)}</TableCell>
                                            <TableCell className="text-right text-green-600">{formatCurrency(payment.net)}</TableCell>
                                        </React.Fragment>
                                    )
                                })}
                             </TableRow>
                         ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{totals.salesCount}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totals.grossRevenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totals.netRevenue)}</TableCell>
                             {uniquePaymentTypes.map(p => {
                                const payment = totals.payments[p] || { gross: 0, net: 0 };
                                return (
                                    <React.Fragment key={`total-${p}`}>
                                        <TableCell className="text-right">{formatCurrency(payment.gross)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(payment.net)}</TableCell>
                                    </React.Fragment>
                                )
                            })}
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- ABC Curve Report ---
function ABCCurveReport() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });

    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const orgId = user.organizationId;
                const salesQuery = query(collection(db, 'sales'), where('organizationId', '==', orgId));
                const productsQuery = query(collection(db, 'products'), where('organizationId', '==', orgId));
                const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', orgId));
                const [salesSnap, productsSnap, branchesSnap] = await Promise.all([
                    getDocs(salesQuery),
                    getDocs(productsQuery),
                    getDocs(branchesQuery),
                ]);

                const salesData = salesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, date: doc.data().date.toDate() } as Sale));
                const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
                const branchesData = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                
                setSales(salesData);
                setProducts(productsData);
                setBranches(branchesData);
                setSelectedBranchIds(branchesData.map(b => b.id));
            } catch (error) {
                console.error("Error fetching ABC report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const { abcData, chartData, totalRevenue } = useMemo(() => {
        const filteredSales = sales.filter(sale => {
            const saleDate = sale.date;
            const isAfterStart = dateRange?.from ? saleDate >= startOfDay(dateRange.from) : true;
            const isBeforeEnd = dateRange?.to ? saleDate <= endOfDay(dateRange.to) : true;
            const inBranch = selectedBranchIds.length === 0 || selectedBranchIds.includes(sale.branchId);
            return sale.status !== 'cancelled' && isAfterStart && isBeforeEnd && inBranch;
        });

        const productRevenue = new Map<string, { name: string, total: number }>();

        filteredSales.forEach(sale => {
            sale.items.forEach((item: any) => {
                if (!item || isNaN(item.quantity)) return;

                if (item.type === 'product') {
                    const product = products.find(p => p.id === item.id);
                    if (product && !isNaN(product.price)) {
                        const current = productRevenue.get(item.name) || { name: item.name, total: 0 };
                        current.total += item.quantity * product.price;
                        productRevenue.set(item.name, current);
                    }
                } else if (item.type === 'combo' && item.products && !isNaN(item.originalPrice) && !isNaN(item.finalPrice)) {
                    let ratio = (item.originalPrice > 0 && !isNaN(item.finalPrice)) ? item.finalPrice / item.originalPrice : 1;
                    if(isNaN(ratio)) ratio = 1;
                    item.products.forEach((p: any) => {
                        const productInfo = products.find(prod => prod.id === p.productId);
                        if(productInfo && !isNaN(productInfo.price) && !isNaN(p.quantity)) {
                           const current = productRevenue.get(p.productName) || { name: p.productName, total: 0 };
                           current.total += p.quantity * item.quantity * productInfo.price * ratio;
                           productRevenue.set(p.productName, current);
                        }
                    });
                } else if (item.type === 'kit' && item.chosenProducts && !isNaN(item.total)) {
                     const originalPrice = item.chosenProducts.reduce((sum: number, p: any) => sum + (p.price || 0), 0);
                     let ratio = (originalPrice > 0 && !isNaN(item.total)) ? item.total / originalPrice : 1;
                     if(isNaN(ratio)) ratio = 1;
                     item.chosenProducts.forEach((p: any) => {
                         if (!isNaN(p.price)) {
                             const current = productRevenue.get(p.name) || { name: p.name, total: 0 };
                             current.total += item.quantity * p.price * ratio;
                             productRevenue.set(p.name, current);
                         }
                     });
                }
            });
        });

        const sortedProducts = Array.from(productRevenue.values()).sort((a, b) => b.total - a.total);
        const totalRevenueValue = sortedProducts.reduce((acc, p) => acc + p.total, 0);
        if (totalRevenueValue === 0) return { abcData: [], chartData: [], totalRevenue: 0 };

        let cumulativePercentage = 0;
        const finalAbcData = sortedProducts.map(p => {
            const percentage = (p.total / totalRevenueValue) * 100;
            cumulativePercentage += percentage;
            let curve: 'A' | 'B' | 'C';
            if (cumulativePercentage <= 80) {
                curve = 'A';
            } else if (cumulativePercentage <= 95) {
                curve = 'B';
            } else {
                curve = 'C';
            }
            return { ...p, percentage, cumulativePercentage, curve };
        });

        const finalChartData = [
            { curve: 'A', "Quantidade de Itens": finalAbcData.filter(p => p.curve === 'A').length, "Faturamento (%)": finalAbcData.filter(p => p.curve === 'A').reduce((acc, p) => acc + p.percentage, 0) },
            { curve: 'B', "Quantidade de Itens": finalAbcData.filter(p => p.curve === 'B').length, "Faturamento (%)": finalAbcData.filter(p => p.curve === 'B').reduce((acc, p) => acc + p.percentage, 0) },
            { curve: 'C', "Quantidade de Itens": finalAbcData.filter(p => p.curve === 'C').length, "Faturamento (%)": finalAbcData.filter(p => p.curve === 'C').reduce((acc, p) => acc + p.percentage, 0) },
        ]

        return { abcData: finalAbcData, chartData: finalChartData, totalRevenue: totalRevenueValue };
    }, [sales, products, dateRange, selectedBranchIds]);

    if (loading) return <Skeleton className="h-96 w-full" />;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Análise de Curva ABC de Produtos</CardTitle>
                <CardDescription>
                    Este relatório classifica seus produtos em categorias A, B e C com base em sua contribuição para o faturamento total.
                    <br/>
                    <b>Curva A:</b> Itens mais importantes (80% do faturamento).
                    <b> Curva B:</b> Itens de importância moderada (15% do faturamento).
                    <b> Curva C:</b> Itens de menor importância (5% do faturamento).
                </CardDescription>
                 <div className="flex flex-col md:flex-row justify-between gap-4 pt-4">
                    <div className="flex flex-wrap gap-2">
                        <MultiSelectPopover title="Filiais" items={branches} selectedIds={selectedBranchIds} setSelectedIds={setSelectedBranchIds} />
                        <DateRangePicker date={dateRange} onSelect={setDateRange} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {abcData.length > 0 && (
                     <div className="h-[250px] mb-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="curve" />
                                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'Qtd. Itens', angle: -90, position: 'insideLeft' }}/>
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Faturamento (%)', angle: -90, position: 'insideRight' }} unit="%"/>
                                <Tooltip formatter={(value, name) => name === 'Faturamento (%)' ? `${(value as number).toFixed(2)}%` : value} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="Quantidade de Itens" fill="#8884d8" />
                                <Bar yAxisId="right" dataKey="Faturamento (%)" fill="#82ca9d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Faturamento</TableHead>
                            <TableHead className="text-right">% do Total</TableHead>
                            <TableHead className="text-right">% Acumulada</TableHead>
                            <TableHead className="text-center">Curva</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {abcData.length > 0 ? (
                            abcData.map(item => (
                                <TableRow key={item.name}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="text-right">R$ {item.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                    <TableCell className="text-right">{item.percentage.toFixed(2)}%</TableCell>
                                    <TableCell className="text-right">{item.cumulativePercentage.toFixed(2)}%</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={item.curve === 'A' ? 'destructive' : item.curve === 'B' ? 'secondary' : 'outline'}>
                                            {item.curve}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">Nenhuma venda encontrada para o período selecionado.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


// --- Main Page Component ---
export default function ReportsPage() {
    const { user, loading } = useAuth();
    const [reportType, setReportType] = useState('general');

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-80 w-full" />
            </div>
        );
    }

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Relatórios</h1>
                <p className="text-muted-foreground">Filtre e analise os dados de toda a organização.</p>
            </div>
            
            <div className="w-full max-w-sm">
                <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione um relatório..." />
                    </SelectTrigger>
                    <SelectContent>
                         <SelectItem value="general">
                            <span className="flex items-center"><Book className="mr-2 h-4 w-4"/>Relatório Geral</span>
                        </SelectItem>
                        <SelectItem value="sales">
                            <span className="flex items-center"><FileDown className="mr-2 h-4 w-4"/>Relatório de Vendas</span>
                        </SelectItem>
                         <SelectItem value="financial-summary">
                            <span className="flex items-center"><FileBarChart className="mr-2 h-4 w-4"/>Resumo Financeiro</span>
                        </SelectItem>
                         <SelectItem value="abc-curve">
                            <span className="flex items-center"><Activity className="mr-2 h-4 w-4"/>Análise de Curva ABC</span>
                        </SelectItem>
                        <SelectItem value="top-selling">
                             <span className="flex items-center"><TrendingUp className="mr-2 h-4 w-4"/>Produtos Mais Vendidos</span>
                        </SelectItem>
                        <SelectItem value="low-stock">
                            <span className="flex items-center"><AlertTriangle className="mr-2 h-4 w-4"/>Estoque Baixo</span>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            {reportType === 'general' && <GeneralReport />}
            {reportType === 'sales' && <SalesReport />}
            {reportType === 'financial-summary' && <FinancialSummaryReport />}
            {reportType === 'abc-curve' && <ABCCurveReport />}
            {reportType === 'top-selling' && <TopSellingProductsReport />}
            {reportType === 'low-stock' && <LowStockReport />}


            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print, .no-print * { display: none !important; }
                }
            `}</style>
        </div>
    );
}

// --- Helper Components ---
function MultiSelectPopover({ title, items, selectedIds, setSelectedIds }: { title: string, items: {id: string, name: string}[], selectedIds: string[], setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>}) {
    const handleSelectAll = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(items.map(item => item.id));
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline">
                    <Filter className="mr-2" />
                    {title} ({selectedIds.length === items.length ? 'Todos' : selectedIds.length})
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
                <Command>
                    <CommandInput placeholder={`Buscar ${title.toLowerCase()}...`} />
                    <CommandList>
                        <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem onSelect={handleSelectAll}>
                                <Checkbox className="mr-2" checked={selectedIds.length === items.length} />
                                Selecionar Todos
                            </CommandItem>
                            {items.map(item => (
                                <CommandItem key={item.id} onSelect={() => {
                                    setSelectedIds(prev => 
                                        prev.includes(item.id) 
                                        ? prev.filter(id => id !== item.id) 
                                        : [...prev, item.id]
                                    )
                                }}>
                                    <Checkbox className="mr-2" checked={selectedIds.includes(item.id)} />
                                    {item.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function DateRangePicker({ date, onSelect, className }: { date: DateRange | undefined, onSelect: (date: DateRange | undefined) => void, className?: string}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y", { locale: ptBR })} -{" "}
                  {format(date.to, "LLL dd, y", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "LLL dd, y", { locale: ptBR })
              )
            ) : (
              <span>Escolha um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onSelect}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
