
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, StockEntryType } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfDay, endOfDay, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, Printer, Trash2, Edit2, Check, X, Loader2, Calendar as CalendarIcon, List } from 'lucide-react';
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
        const from = subDays(to, 6); // Últimos 7 dias por padrão
        return { from, to };
    });
    
    // Estados para o Modal de Detalhes/Edição
    const [viewDetails, setViewDetails] = useState<{productName: string, details: StockEntry[]} | null>(null);
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

        const productsQuery = query(collection(db, 'products'), where('organizationId', '==', user.organizationId));
        const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
            const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))
                .filter(p => !p.isDeleted && (p.branchIds?.includes(currentBranch.id) || p.branchId === currentBranch.id));
            setProducts(allProducts);
        });

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
            case 'day': return eachDayOfInterval({ start, end });
            case 'week': return eachWeekOfInterval({ start, end }, { locale: ptBR });
            case 'month': return eachMonthOfInterval({ start, end });
            default: return [];
        }
    }, [dateRange, granularity]);

    const pivotData = useMemo(() => {
        if (loading || !products.length) return [];

        const filteredProducts = products.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return filteredProducts.map(product => {
            const productEntries = allStockEntries.filter(e => e.productId === product.id);
            const periodMap: Record<string, PeriodData> = {};

            periods.forEach(periodDate => {
                const periodStart = granularity === 'day' ? startOfDay(periodDate) : 
                                  granularity === 'week' ? startOfWeek(periodDate, { locale: ptBR }) : 
                                  startOfMonth(periodDate);
                const periodEnd = granularity === 'day' ? endOfDay(periodDate) : 
                                granularity === 'week' ? endOfWeek(periodDate, { locale: ptBR }) : 
                                endOfMonth(periodDate);
                
                const key = periodStart.toISOString();

                // O Estoque Inicial é a soma de TUDO antes desse período
                const initialStock = productEntries
                    .filter(e => e.date < periodStart)
                    .reduce((sum, e) => sum + e.quantity, 0);

                const periodEntries = productEntries.filter(e => e.date >= periodStart && e.date <= periodEnd);
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

            return { id: product.id, name: product.name, periods: periodMap };
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [products, allStockEntries, periods, granularity, searchQuery, loading]);

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
            // Atualizar os detalhes visualizados
            if (viewDetails) {
                const updated = viewDetails.details.map(d => d.id === editingEntry.id ? {...d, quantity: editValue, notes: editNotes} : d);
                setViewDetails({...viewDetails, details: updated});
            }
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
            if (viewDetails) {
                const updated = viewDetails.details.filter(d => d.id !== id);
                setViewDetails({...viewDetails, details: updated});
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao excluir", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-4 flex flex-col h-[calc(100vh-120px)]">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 no-print shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Fluxo de Estoque</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                        <TabsList size="sm">
                            <TabsTrigger value="day">Diário</TabsTrigger>
                            <TabsTrigger value="week">Semanal</TabsTrigger>
                            <TabsTrigger value="month">Mensal</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Button>
                </div>
            </div>

            <Card className="no-print shrink-0 shadow-sm border-muted/60">
                <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Filtrar por nome do produto..."
                                className="w-full pl-8 h-9 text-sm"
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
                <Card className="h-full flex flex-col overflow-hidden shadow-none border-muted/60">
                    <CardContent className="p-0 h-full flex flex-col">
                        <ScrollArea className="flex-1 border rounded-md">
                            <div className="min-w-full inline-block align-middle">
                                <Table className="border-collapse text-[11px]">
                                    <TableHeader className="sticky top-0 bg-background z-20 shadow-sm">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[180px] bg-background border-r sticky left-0 z-30 font-bold text-foreground">Produto</TableHead>
                                            {periods.map(period => (
                                                <TableHead key={period.toISOString()} colSpan={4} className="text-center border-r bg-muted/40 font-bold text-foreground py-1">
                                                    {granularity === 'day' ? format(period, "dd/MM (EEE)", {locale: ptBR}) : 
                                                     granularity === 'week' ? `Semana ${format(period, "ww")}` : 
                                                     format(period, "MMMM/yyyy", {locale: ptBR})}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[180px] bg-background border-r sticky left-0 z-30"></TableHead>
                                            {periods.map(period => (
                                                <React.Fragment key={`sub-${period.toISOString()}`}>
                                                    <TableHead className="text-[9px] w-12 border-r px-1 text-center bg-muted/20">Início</TableHead>
                                                    <TableHead className="text-[9px] w-12 border-r px-1 text-center bg-green-50/50 text-green-700">Ent</TableHead>
                                                    <TableHead className="text-[9px] w-12 border-r px-1 text-center bg-red-50/50 text-red-700">Saí</TableHead>
                                                    <TableHead className="text-[9px] w-12 border-r px-1 text-center bg-blue-50/50 font-bold text-blue-800">Final</TableHead>
                                                </React.Fragment>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 15 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="sticky left-0 bg-background border-r"><Skeleton className="h-3 w-24" /></TableCell>
                                                    {periods.map(p => (
                                                        <React.Fragment key={p.toISOString()}>
                                                            <TableCell className="border-r"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                                            <TableCell className="border-r"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                                            <TableCell className="border-r"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                                            <TableCell className="border-r"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                                        </React.Fragment>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : pivotData.map(prod => (
                                            <TableRow key={prod.id} className="hover:bg-muted/30 group">
                                                <TableCell className="font-medium sticky left-0 bg-background border-r z-10 truncate max-w-[180px] group-hover:bg-muted/30" title={prod.name}>
                                                    {prod.name}
                                                </TableCell>
                                                {periods.map(period => {
                                                    const key = (granularity === 'day' ? startOfDay(period) : 
                                                                granularity === 'week' ? startOfWeek(period, { locale: ptBR }) : 
                                                                startOfMonth(period)).toISOString();
                                                    const pData = prod.periods[key];
                                                    return (
                                                        <React.Fragment key={`${prod.id}-${key}`}>
                                                            <TableCell className="text-center border-r px-1 text-muted-foreground bg-white/50">{pData?.initial ?? 0}</TableCell>
                                                            <TableCell 
                                                                className={cn("text-center border-r px-1 font-medium cursor-pointer transition-colors", pData?.entries > 0 ? "text-green-600 hover:bg-green-100" : "text-muted-foreground/30")}
                                                                onClick={() => pData?.details.some(e => e.quantity > 0) && setViewDetails({productName: prod.name, details: pData.details.filter(e => e.quantity > 0)})}
                                                            >
                                                                {pData?.entries > 0 ? `+${pData.entries}` : '0'}
                                                            </TableCell>
                                                            <TableCell 
                                                                className={cn("text-center border-r px-1 font-medium cursor-pointer transition-colors", pData?.exits > 0 ? "text-red-600 hover:bg-red-100" : "text-muted-foreground/30")}
                                                                onClick={() => pData?.details.some(e => e.quantity < 0) && setViewDetails({productName: prod.name, details: pData.details.filter(e => e.quantity < 0)})}
                                                            >
                                                                {pData?.exits > 0 ? `-${pData.exits}` : '0'}
                                                            </TableCell>
                                                            <TableCell className="text-center border-r px-1 font-bold text-blue-700 bg-blue-50/20">{pData?.final ?? 0}</TableCell>
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

            {/* Modal de Lista de Movimentações */}
            <Popover open={!!viewDetails} onOpenChange={(open) => !open && setViewDetails(null)}>
                <PopoverContent className="w-[450px] p-0 shadow-xl border-muted" align="center">
                    <div className="bg-muted/40 p-3 border-b flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Movimentações do Período</span>
                            <span className="text-sm font-semibold truncate max-w-[300px]">{viewDetails?.productName}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDetails(null)}><X className="h-4 w-4"/></Button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        <Table className="text-xs">
                            <TableHeader className="bg-muted/20">
                                <TableRow>
                                    <TableHead>Data/Hora</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                    <TableHead>Obs.</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewDetails?.details.map(entry => (
                                    <TableRow key={entry.id} className="hover:bg-muted/10">
                                        <TableCell className="whitespace-nowrap">{format(entry.date, "dd/MM HH:mm")}</TableCell>
                                        <TableCell className={cn("text-right font-bold", entry.quantity > 0 ? "text-green-600" : "text-red-600")}>
                                            {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                        </TableCell>
                                        <TableCell className="max-w-[150px] truncate" title={entry.notes}>{entry.notes || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                                    setEditingEntry(entry);
                                                    setEditValue(entry.quantity);
                                                    setEditNotes(entry.notes || "");
                                                }}>
                                                    <Edit2 className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(entry.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Modal de Edição */}
            <Popover open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
                <PopoverContent className="w-80 p-4 shadow-2xl border-primary/20" align="center" side="top">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="font-bold text-sm">Editar Registro</h4>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingEntry(null)}><X className="h-4 w-4"/></Button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Nova Quantidade</label>
                                <Input 
                                    type="number" 
                                    value={editValue} 
                                    className="h-8 text-sm"
                                    onChange={e => setEditValue(Number(e.target.value))}
                                />
                                <p className="text-[9px] text-muted-foreground">Positivo para entrada, negativo para saída.</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Observações</label>
                                <Input 
                                    value={editNotes} 
                                    className="h-8 text-sm"
                                    onChange={e => setEditNotes(e.target.value)}
                                    placeholder="Motivo da alteração..."
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingEntry(null)}>Cancelar</Button>
                            <Button size="sm" className="h-8 px-4" onClick={handleSaveEdit} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3 mr-1"/>} Salvar
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <style jsx global>{`
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                    .table { font-size: 8px !important; }
                    th, td { padding: 2px !important; border: 0.1pt solid #ccc !important; }
                    .card { border: none !important; box-shadow: none !important; }
                }
            `}</style>
        </div>
    );
}
