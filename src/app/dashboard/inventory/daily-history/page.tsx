
'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, StockEntryType } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, Printer, Trash2, Edit2, Check, X, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

const convertDate = (dateField: any): Date => {
    if (dateField instanceof Timestamp) return dateField.toDate();
    if (dateField && typeof (dateField as any).seconds === 'number') return new Date((dateField as any).seconds * 1000);
    if (typeof dateField === 'string') return parseISO(dateField);
    return new Date(); // Fallback
};

export default function DailyHistoryPage() {
    const [allStockEntries, setAllStockEntries] = useState<StockEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, currentBranch, authLoading } = useAuth();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [editNotes, setEditNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (authLoading || !currentBranch || !user?.organizationId) {
            setLoading(true);
            return;
        }

        const stockEntriesQuery = query(
            collection(db, 'stockEntries'), 
            where('branchId', '==', currentBranch.id),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(stockEntriesQuery, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({ 
                ...doc.data(), 
                id: doc.id, 
                date: convertDate(doc.data().date) 
            } as StockEntry));
            setAllStockEntries(entriesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentBranch, authLoading, user?.organizationId]);

    const filteredEntries = useMemo(() => {
        return allStockEntries.filter(entry => {
            const inDateRange = dateRange?.from 
                ? (entry.date >= startOfDay(dateRange.from) && entry.date <= endOfDay(dateRange.to || dateRange.from))
                : true;
            
            const matchesSearch = searchQuery
                ? entry.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  entry.notes?.toLowerCase().includes(searchQuery.toLowerCase())
                : true;

            return inDateRange && matchesSearch;
        });
    }, [allStockEntries, searchQuery, dateRange]);

    const groupedByDay = useMemo(() => {
        const groups: Record<string, StockEntry[]> = {};
        filteredEntries.forEach(entry => {
            const day = format(entry.date, 'yyyy-MM-dd');
            if (!groups[day]) groups[day] = [];
            groups[day].push(entry);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [filteredEntries]);

    const handleEdit = (entry: StockEntry) => {
        setEditingId(entry.id);
        setEditValue(entry.quantity);
        setEditNotes(entry.notes || "");
    };

    const handleSaveEdit = async (entry: StockEntry) => {
        if (!currentBranch) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'stockEntries', entry.id), {
                quantity: editValue,
                notes: editNotes,
                updatedAt: new Date(),
                updatedBy: user?.id
            });
            toast({ title: "Movimentação atualizada com sucesso" });
            setEditingId(null);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao atualizar movimentação", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta movimentação? Isso afetará o saldo do estoque.")) return;
        try {
            await deleteDoc(doc(db, 'stockEntries', id));
            toast({ title: "Movimentação excluída com sucesso" });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao excluir movimentação", variant: "destructive" });
        }
    };

    const getBadgeForType = (type: StockEntryType) => {
        switch (type) {
            case 'entry': return <Badge variant="secondary" className="bg-green-100 text-green-800">Entrada</Badge>;
            case 'adjustment': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Saída</Badge>;
            case 'sale': return <Badge variant="outline">Venda</Badge>;
            case 'transfer': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Transferência</Badge>;
            case 'cancellation': return <Badge variant="destructive">Cancelamento</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    }

    if (!currentBranch && !authLoading) {
        return (
            <Card className="m-auto">
                <CardHeader><CardTitle>Nenhuma Filial Selecionada</CardTitle></CardHeader>
                <CardContent>
                    <p>Por favor, selecione uma filial no topo da página.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6 printable-area">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 no-print">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-3xl font-bold">Histórico Diário de Estoque</h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Button>
                </div>
            </div>

            <Card className="no-print">
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Busque por produto, usuário ou observação em um período específico.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar..."
                                className="w-full rounded-lg bg-background pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                    {format(dateRange.from, "LLL dd, y", { locale: ptBR })} -{" "}
                                    {format(dateRange.to, "LLL dd, y", { locale: ptBR })}
                                    </>
                                ) : (
                                    format(dateRange.from, "LLL dd, y", { locale: ptBR })
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
                                defaultMonth={dateRange?.from}
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

            <div className="space-y-8">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                            <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                        </Card>
                    ))
                ) : groupedByDay.length > 0 ? (
                    groupedByDay.map(([day, entries]) => (
                        <Card key={day} className="overflow-hidden break-inside-avoid">
                            <CardHeader className="bg-muted/50 py-3">
                                <CardTitle className="text-lg">
                                    {format(parseISO(day), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">Hora</TableHead>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead className="text-right">Qtd</TableHead>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Obs.</TableHead>
                                            <TableHead className="w-[100px] text-right no-print">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {entries.map(entry => (
                                            <TableRow key={entry.id}>
                                                <TableCell>{format(entry.date, 'HH:mm')}</TableCell>
                                                <TableCell className="font-medium">{entry.productName}</TableCell>
                                                <TableCell>{getBadgeForType(entry.type)}</TableCell>
                                                <TableCell className="text-right">
                                                    {editingId === entry.id ? (
                                                        <Input 
                                                            type="number" 
                                                            className="w-20 ml-auto" 
                                                            value={editValue} 
                                                            onChange={e => setEditValue(Number(e.target.value))}
                                                        />
                                                    ) : (
                                                        <span className={cn("font-bold", entry.quantity > 0 ? "text-green-600" : "text-red-500")}>
                                                            {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">{entry.userName}</TableCell>
                                                <TableCell>
                                                    {editingId === entry.id ? (
                                                        <Input 
                                                            value={editNotes} 
                                                            onChange={e => setEditNotes(e.target.value)}
                                                            placeholder="Notas..."
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">{entry.notes}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right no-print">
                                                    {editingId === entry.id ? (
                                                        <div className="flex justify-end gap-1">
                                                            <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(entry)} disabled={isSaving}>
                                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                                                                <X className="h-4 w-4 text-red-600" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-1">
                                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(entry)}>
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(entry.id)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="py-10 text-center text-muted-foreground">
                            Nenhuma movimentação encontrada para o período selecionado.
                        </CardContent>
                    </Card>
                )}
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: auto;
                        margin: 10mm;
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
                    .card {
                        border: 1px solid #ccc !important;
                        box-shadow: none !important;
                    }
                    .table-header {
                        background-color: #f0f0f0 !important;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
