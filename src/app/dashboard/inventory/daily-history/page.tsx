
'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, StockEntryType } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfDay, endOfDay, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isSameDay, isSameWeek, isSameMonth, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, Printer, Trash2, Edit2, Check, X, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const convertDate = (dateField: any): Date => {
    if (dateField instanceof Timestamp) return dateField.toDate();
    if (dateField && typeof (dateField as any).seconds === 'number') return new Date((dateField as any).seconds * 1000);
    if (typeof dateField === 'string') return parseISO(dateField);
    return new Date(); // Fallback
};

type Granularity = 'day' | 'week' | 'month';

interface PeriodData {
    initial: number;
    entries: number;
    exits: number;
    final: number;
    details: StockEntry[];
}

interface ProductPivot {
    id: string;
    name: string;
    periods: Record<string, PeriodData>;
}

export default function DailyHistoryPage() {
    const [allStockEntries, setAllStockEntries] = useState<StockEntry[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, currentBranch, authLoading } = useAuth();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [granularity, setGranularity] = useState<Granularity>('day');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const to = new Date();
        const from = subDays(to, 7);
        return { from, to };
    });
    
    const [editingEntry, setEditingEntry] = useState<StockEntry | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [editNotes, setEditNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (authLoading || !currentBranch || !user?.organizationId) {
            setLoading(true);
            return;
        }

        // Buscar produtos primeiro para ter a lista completa
        const productsQuery = query(collection(db, 'products'), where('organizationId', '==', user.organizationId));
        const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
            const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))
                .filter(p => !p.isDeleted && (p.branchIds?.includes(currentBranch.id) || p.branchId === currentBranch.id));
            setProducts(allProducts);
        });

        // Buscar TODAS as movimentações para calcular o estoque inicial corretamente
        const stockEntriesQuery = query(
            collection(db, 'stockEntries'), 
            where('branchId', '==', currentBranch.id),
            orderBy('date', 'asc')
        );

        const unsubscribeEntries = onSnapshot(stockEntriesQuery, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({ 
                ...doc.data(), 
                id: doc.id, 
                date: convertDate(doc.data().date) 
            } as StockEntry));
            setAllStockEntries(entriesData);
            setLoading(false);
        });

        return () => {
            unsubscribeProducts();
            unsubscribeEntries();
        };
    }, [currentBranch, authLoading, user?.organizationId]);

    const periods = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        
        const start = startOfDay(dateRange.from);
        const end = endOfDay(dateRange.to);

        switch (granularity) {
            case 'day':
                return eachDayOfInterval({ start, end });
            case 'week':
                return eachWeekOfInterval({ start, end }, { locale: ptBR });
            case 'month':
                return eachMonthOfInterval({ start, end });
            default:
                return [];
        }
    }, [dateRange, granularity]);

    const pivotData = useMemo(() => {
        if (loading || !products.length) return [];

        const filteredProducts = products.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const data: ProductPivot[] = filteredProducts.map(product => {
            const productEntries = allStockEntries.filter(e => e.productId === product.id);
            const periodMap: Record<string, PeriodData> = {};

            // Calculando estoque corrente para cada período
            let runningStock = 0;
            const sortedEntries = [...productEntries].sort((a,b) => a.date.getTime() - b.date.getTime());
            
            // Para cada período, precisamos saber o estoque antes dele começar
            periods.forEach(periodDate => {
                const periodStart = granularity === 'day' ? startOfDay(periodDate) : 
                                  granularity === 'week' ? startOfWeek(periodDate, { locale: ptBR }) : 
                                  startOfMonth(periodDate);
                const periodEnd = granularity === 'day' ? endOfDay(periodDate) : 
                                granularity === 'week' ? endOfWeek(periodDate, { locale: ptBR }) : 
                                endOfMonth(periodDate);
                
                const key = periodStart.toISOString();

                // Calcular estoque inicial (soma de tudo antes do periodStart)
                const initialStock = sortedEntries
                    .filter(e => e.date < periodStart)
                    .reduce((sum, e) => sum + e.quantity, 0);

                const periodEntries = sortedEntries.filter(e => e.date >= periodStart && e.date <= periodEnd);
                
                const inQty = periodEntries.filter(e => e.quantity > 0).reduce((sum, e) => sum + e.quantity, 0);
                const outQty = Math.abs(periodEntries.filter(e => e.quantity < 0).reduce((sum, e) => sum + e.quantity, 0));
                
                periodMap[key] = {
                    initial: initialStock,
                    entries: inQty,
                    exits: outQty,
                    final: initialStock + inQty - outQty,
                    details: periodEntries
                };
            });

            return {
                id: product.id,
                name: product.name,
                periods: periodMap
            };
        });

        return data.sort((a,b) => a.name.localeCompare(b.name));
    }, [products, allStockEntries, periods, granularity, searchQuery, loading]);

    const getPeriodLabel = (date: Date) => {
        switch (granularity) {
            case 'day':
                return format(date, "dd/MM");
            case 'week':
                return `Sem ${format(date, "ww")}`;
            case 'month':
                return format(date, "MMM/yy", { locale: ptBR });
        }
    };

    const handleEdit = (entry: StockEntry) => {
        setEditingEntry(entry);
        setEditValue(entry.quantity);
        setEditNotes(entry.notes || "");
    };

    const handleSaveEdit = async () => {
        if (!editingEntry) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'stockEntries', editingEntry.id), {
                quantity: editValue,
                notes: editNotes,
                updatedAt: new Date(),
                updatedBy: user?.id
            });
            toast({ title: "Movimentação atualizada" });
            setEditingEntry(null);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao atualizar", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir esta movimentação?")) return;
        try {
            await deleteDoc(doc(db, 'stockEntries', id));
            toast({ title: "Movimentação excluída" });
            setEditingEntry(null);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao excluir", variant: "destructive" });
        }
    };

    if (!currentBranch && !authLoading) return <div className="p-8 text-center">Selecione uma filial.</div>;

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-120px)]">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 no-print shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">Planilha de Movimentação</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                        <TabsList size="sm">
                            <TabsTrigger value="day">Dia</TabsTrigger>
                            <TabsTrigger value="week">Semana</TabsTrigger>
                            <TabsTrigger value="month">Mês</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Button>
                </div>
            </div>

            <Card className="no-print shrink-0">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Filtrar produto..."
                                className="w-full pl-8 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full sm:w-[260px] justify-start text-left font-normal h-9">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>
                                        ) : (format(dateRange.from, "dd/MM/yy"))
                                    ) : (<span>Selecione o período</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardContent>
            </Card>

            <div className="flex-1 min-h-0 relative">
                <Card className="h-full flex flex-col overflow-hidden">
                    <CardContent className="p-0 h-full flex flex-col">
                        <ScrollArea className="flex-1">
                            <div className="min-w-full inline-block align-middle">
                                <Table className="border-collapse">
                                    <TableHeader className="sticky top-0 bg-background z-20 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-[200px] bg-background border sticky left-0 z-30">Produto</TableHead>
                                            {periods.map(period => (
                                                <TableHead key={period.toISOString()} colSpan={4} className="text-center border bg-muted/30">
                                                    {getPeriodLabel(period)}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                        <TableRow>
                                            <TableHead className="w-[200px] bg-background border sticky left-0 z-30"></TableHead>
                                            {periods.map(period => (
                                                <React.Fragment key={`sub-${period.toISOString()}`}>
                                                    <TableHead className="text-[10px] w-12 border px-1 text-center">Inicial</TableHead>
                                                    <TableHead className="text-[10px] w-12 border px-1 text-center text-green-600">Ent</TableHead>
                                                    <TableHead className="text-[10px] w-12 border px-1 text-center text-red-600">Saí</TableHead>
                                                    <TableHead className="text-[10px] w-12 border px-1 text-center font-bold">Final</TableHead>
                                                </React.Fragment>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 10 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="sticky left-0 bg-background border"><Skeleton className="h-4 w-32" /></TableCell>
                                                    {periods.map(p => (
                                                        <React.Fragment key={p.toISOString()}>
                                                            <TableCell className="border"><Skeleton className="h-4 w-8" /></TableCell>
                                                            <TableCell className="border"><Skeleton className="h-4 w-8" /></TableCell>
                                                            <TableCell className="border"><Skeleton className="h-4 w-8" /></TableCell>
                                                            <TableCell className="border"><Skeleton className="h-4 w-8" /></TableCell>
                                                        </React.Fragment>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : pivotData.map(prod => (
                                            <TableRow key={prod.id} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="font-medium sticky left-0 bg-background border z-10 truncate max-w-[200px]" title={prod.name}>
                                                    {prod.name}
                                                </TableCell>
                                                {periods.map(period => {
                                                    const key = (granularity === 'day' ? startOfDay(period) : 
                                                                granularity === 'week' ? startOfWeek(period, { locale: ptBR }) : 
                                                                startOfMonth(period)).toISOString();
                                                    const pData = prod.periods[key];
                                                    return (
                                                        <React.Fragment key={`${prod.id}-${key}`}>
                                                            <TableCell className="text-center border px-1 text-xs text-muted-foreground">{pData?.initial ?? 0}</TableCell>
                                                            <TableCell 
                                                                className="text-center border px-1 text-xs text-green-600 cursor-pointer hover:bg-green-50"
                                                                onClick={() => pData?.details.filter(e => e.quantity > 0).length > 0 && setEditingEntry(pData.details.find(e => e.quantity > 0) || null)}
                                                            >
                                                                {pData?.entries > 0 ? `+${pData.entries}` : '-'}
                                                            </TableCell>
                                                            <TableCell 
                                                                className="text-center border px-1 text-xs text-red-600 cursor-pointer hover:bg-red-50"
                                                                onClick={() => pData?.details.filter(e => e.quantity < 0).length > 0 && setEditingEntry(pData.details.find(e => e.quantity < 0) || null)}
                                                            >
                                                                {pData?.exits > 0 ? `-${pData.exits}` : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-center border px-1 text-xs font-bold">{pData?.final ?? 0}</TableCell>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Modal de Edição Detalhada */}
            <Popover open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
                <PopoverContent className="w-80 p-4" align="center">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium">Editar Movimentação</h4>
                            <Button variant="ghost" size="icon" onClick={() => setEditingEntry(null)}><X className="h-4 w-4"/></Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {editingEntry?.productName} - {editingEntry && format(editingEntry.date, "dd/MM/yy HH:mm")}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm">Quantidade</label>
                            <Input 
                                type="number" 
                                value={editValue} 
                                onChange={e => setEditValue(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm">Observações</label>
                            <Input 
                                value={editNotes} 
                                onChange={e => setEditNotes(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-between gap-2">
                            <Button variant="destructive" size="sm" onClick={() => editingEntry && handleDelete(editingEntry.id)}>
                                <Trash2 className="h-4 w-4 mr-1"/> Excluir
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditingEntry(null)}>Cancelar</Button>
                                <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 mr-1"/>} Salvar
                                </Button>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 5mm;
                    }
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
                    .no-print {
                        display: none !important;
                    }
                    .table {
                        font-size: 8px !important;
                    }
                    .card {
                        border: none !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </div>
    );
}

import React from 'react';
