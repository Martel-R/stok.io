
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Printer, FileDown, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Sale, Branch, User, PaymentDetail } from '@/lib/types';
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


// --- Data Fetching and Main Component ---
export default function ReportsPage() {
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
        if (!user?.organizationId || user.role !== 'admin') {
            setLoading(false);
            return;
        }

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
                
                // By default, select all branches
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
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
        XLSX.writeFile(wb, 'relatorio_vendas.xlsx');
    };


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
                <Skeleton className="h-80 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Relatório de Vendas</h1>
                <p className="text-muted-foreground">Filtre e analise as vendas de toda a organização.</p>
            </div>
            
            <Card>
                <CardHeader>
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
                    <div className="mb-4 font-semibold">
                       Exibindo {filteredSales.length} de {sales.length} vendas. Total Filtrado: R$ {totalFilteredRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="printable-area">
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
                                            {sale.items.map((item: any) => (
                                                <div key={item.id}>{item.quantity}x {item.name}</div>
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

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
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
