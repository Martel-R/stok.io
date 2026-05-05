
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
import { ArrowLeft, Search, Printer, Trash2, Edit2, Check, X, Loader2, Calendar as CalendarIcon, List, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollBar } from '@/components/ui/scroll-area';

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
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [granularity, setGranularity] = useState<Granularity>('day');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const to = new Date();
        const from = subDays(to, 6); // Últimos 7 dias por padrão
        return { from, to };
    });
    
    // Estados para o Modal de Detalhes/Edição
    const [viewDetails, setViewDetails] = useState<{productName: string, details: StockEntry[]} | null>(null);
    const [rowEditingId, setRowEditingId] = useState<string | null>(null);
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

    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [products]);

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

        const filteredProducts = products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });

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
    }, [products, allStockEntries, periods, granularity, searchQuery, selectedCategory, loading]);

    const handleSaveRowEdit = async (id: string) => {
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'stockEntries', id), {
                quantity: editValue,
                notes: editNotes,
                updatedAt: new Date(),
                updatedBy: user?.id
            });
            toast({ title: "Movimentação atualizada" });
            setRowEditingId(null);
            // Atualizar os detalhes visualizados
            if (viewDetails) {
                const updated = viewDetails.details.map(d => d.id === id ? {...d, quantity: editValue, notes: editNotes} : d);
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
            if (viewDetails) {
                const updated = viewDetails.details.filter(d => d.id !== id);
                setViewDetails({...viewDetails, details: updated});
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao excluir", variant: "destructive" });
        }
    };

    const startEditing = (entry: StockEntry) => {
        setRowEditingId(entry.id);
        setEditValue(entry.quantity);
        setEditNotes(entry.notes || "");
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

                        <div className="w-full sm:w-[200px]">
                            <select 
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="all">Todas as Categorias</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
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

            {/* Container de Tabela com Rolagem Nativa */}
            <div className="flex-1 min-h-0 relative border rounded-md bg-card overflow-auto custom-scrollbar">
                <Table className="border-separate border-spacing-0 text-[11px]">
                    <TableHeader className="sticky top-0 bg-background z-20">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[180px] bg-background border-r border-b sticky left-0 top-0 z-30 font-bold text-foreground">Produto</TableHead>
                            {periods.map(period => (
                                <TableHead key={period.toISOString()} colSpan={4} className="text-center border-r border-b bg-muted/40 font-bold text-foreground py-1 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">
                                    {granularity === 'day' ? format(period, "dd/MM (EEE)", {locale: ptBR}) : 
                                        granularity === 'week' ? `Semana ${format(period, "ww")}` : 
                                        format(period, "MMMM/yyyy", {locale: ptBR})}
                                </TableHead>
                            ))}
                        </TableRow>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[180px] bg-background border-r border-b sticky left-0 top-[29px] z-30"></TableHead>
                            {periods.map(period => (
                                <React.Fragment key={`sub-${period.toISOString()}`}>
                                    <TableHead className="text-[9px] w-12 border-r border-b px-1 text-center bg-muted/20 sticky top-[29px] z-20">Início</TableHead>
                                    <TableHead className="text-[9px] w-12 border-r border-b px-1 text-center bg-green-50/50 text-green-700 sticky top-[29px] z-20">Ent</TableHead>
                                    <TableHead className="text-[9px] w-12 border-r border-b px-1 text-center bg-red-50/50 text-red-700 sticky top-[29px] z-20">Saí</TableHead>
                                    <TableHead className="text-[9px] w-12 border-r border-b px-1 text-center bg-blue-50/50 font-bold text-blue-800 sticky top-[29px] z-20">Final</TableHead>
                                </React.Fragment>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 15 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell className="sticky left-0 bg-background border-r border-b z-10"><Skeleton className="h-3 w-24" /></TableCell>
                                    {periods.map(p => (
                                        <React.Fragment key={p.toISOString()}>
                                            <TableCell className="border-r border-b"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                            <TableCell className="border-r border-b"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                            <TableCell className="border-r border-b"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                            <TableCell className="border-r border-b"><Skeleton className="h-3 w-6 mx-auto" /></TableCell>
                                        </React.Fragment>
                                    ))}
                                </TableRow>
                            ))
                        ) : pivotData.map(prod => (
                            <TableRow key={prod.id} className="hover:bg-muted/30 group">
                                <TableCell className="font-medium sticky left-0 bg-background border-r border-b z-10 truncate max-w-[180px] group-hover:bg-muted/40 transition-colors" title={prod.name}>
                                    {prod.name}
                                </TableCell>
                                {periods.map(period => {
                                    const key = (granularity === 'day' ? startOfDay(period) : 
                                                granularity === 'week' ? startOfWeek(period, { locale: ptBR }) : 
                                                startOfMonth(period)).toISOString();
                                    const pData = prod.periods[key];
                                    return (
                                        <React.Fragment key={`${prod.id}-${key}`}>
                                            <TableCell className="text-center border-r border-b px-1 text-muted-foreground bg-white/50">{pData?.initial ?? 0}</TableCell>
                                            <TableCell 
                                                className={cn("text-center border-r border-b px-1 font-medium cursor-pointer transition-colors", pData?.entries > 0 ? "text-green-600 hover:bg-green-100" : "text-muted-foreground/30")}
                                                onClick={() => {
                                                    if (pData?.details.some(e => e.quantity > 0)) {
                                                        const entries = pData.details.filter(e => e.quantity > 0);
                                                        setViewDetails({productName: prod.name, details: entries});
                                                        if (entries.length === 1) startEditing(entries[0]);
                                                    }
                                                }}
                                            >
                                                {pData?.entries > 0 ? `+${pData.entries}` : '0'}
                                            </TableCell>
                                            <TableCell 
                                                className={cn("text-center border-r border-b px-1 font-medium cursor-pointer transition-colors", pData?.exits > 0 ? "text-red-600 hover:bg-red-100" : "text-muted-foreground/30")}
                                                onClick={() => {
                                                    if (pData?.details.some(e => e.quantity < 0)) {
                                                        const exits = pData.details.filter(e => e.quantity < 0);
                                                        setViewDetails({productName: prod.name, details: exits});
                                                        if (exits.length === 1) startEditing(exits[0]);
                                                    }
                                                }}
                                            >
                                                {pData?.exits > 0 ? `-${pData.exits}` : '0'}
                                            </TableCell>
                                            <TableCell className="text-center border-r border-b px-1 font-bold text-blue-700 bg-blue-50/20">{pData?.final ?? 0}</TableCell>
                                        </React.Fragment>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Painel de Edição Direta (Popover) */}
            <Popover open={!!viewDetails} onOpenChange={(open) => {
                if (!open) {
                    setViewDetails(null);
                    setRowEditingId(null);
                }
            }}>
                <PopoverContent className="w-[500px] p-0 shadow-2xl border-muted overflow-hidden z-[100]" align="center">
                    <div className="bg-muted/50 p-3 border-b flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Ajuste de Lançamentos</span>
                            <span className="text-sm font-bold truncate max-w-[350px]">{viewDetails?.productName}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDetails(null)}><X className="h-4 w-4"/></Button>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto">
                        <Table className="text-xs">
                            <TableHeader className="bg-muted/20 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-24">Data/Hora</TableHead>
                                    <TableHead className="w-20 text-right">Qtd</TableHead>
                                    <TableHead>Observação / Motivo</TableHead>
                                    <TableHead className="w-20 text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewDetails?.details.map(entry => (
                                    <TableRow key={entry.id} className={cn("transition-colors", rowEditingId === entry.id ? "bg-primary/5" : "hover:bg-muted/10")}>
                                        <TableCell className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                                            {format(entry.date, "dd/MM HH:mm")}
                                        </TableCell>
                                        <TableCell className="text-right p-1">
                                            {rowEditingId === entry.id ? (
                                                <Input 
                                                    type="number" 
                                                    className="h-7 text-right px-1 font-bold" 
                                                    value={editValue} 
                                                    onChange={e => setEditValue(Number(e.target.value))}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className={cn("font-bold px-2", entry.quantity > 0 ? "text-green-600" : "text-red-600")}>
                                                    {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="p-1">
                                            {rowEditingId === entry.id ? (
                                                <Input 
                                                    className="h-7 text-[11px]" 
                                                    value={editNotes} 
                                                    onChange={e => setEditNotes(e.target.value)}
                                                    placeholder="Descreva o ajuste..."
                                                />
                                            ) : (
                                                <span className="text-muted-foreground line-clamp-1 italic px-2">{entry.notes || '-'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right p-1">
                                            <div className="flex justify-end gap-1">
                                                {rowEditingId === entry.id ? (
                                                    <>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleSaveRowEdit(entry.id)} disabled={isSaving}>
                                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => setRowEditingId(null)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditing(entry)}>
                                                            <Edit2 className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(entry.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </PopoverContent>
            </Popover>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(0,0,0,0.2);
                }
                
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
