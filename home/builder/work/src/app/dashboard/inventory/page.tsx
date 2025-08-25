

'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, StockEntry, StockEntryType, Branch } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRightLeft, MinusCircle, Package, History, Search, Printer, FileDown, Calendar as CalendarIcon, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StockMovementForm } from '@/components/stock-movement-form';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { NfeImportDialog } from '@/components/nfe-import-dialog';

const convertDate = (dateField: any): Date => {
    if (dateField instanceof Timestamp) return dateField.toDate();
    if (dateField && typeof (dateField as any).seconds === 'number') return new Date((dateField as any).seconds * 1000);
    if (typeof dateField === 'string') return parseISO(dateField);
    return new Date(); // Fallback
};

interface DailyStockSummary {
    date: string;
    productId: string;
    productName: string;
    initialStock: number;
    entries: number;
    exits: number;
    finalStock: number;
    details: StockEntry[];
}

export default function InventoryPage() {
    const [allStockEntries, setAllStockEntries] = useState<StockEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, currentBranch, branches, loading: authLoading } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formType, setFormType] = useState<'entry' | 'adjustment' | 'transfer'>('entry');
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<DailyStockSummary | null>(null);
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDateRange, setHistoryDateRange] = useState<DateRange | undefined>({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });

    const canManageStock = useMemo(() => user?.enabledModules?.inventory?.edit ?? false, [user]);


    useEffect(() => {
        if (authLoading || !currentBranch) {
            setLoading(true);
            return;
        }

        const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));
        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id), where("isDeleted", "==", false));

        const unsubscribeEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
            const entriesData = entriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: convertDate(doc.data().date) } as StockEntry));
            setAllStockEntries(entriesData);
            setLoading(false);
        });

        const unsubscribeProducts = onSnapshot(productsQuery, (productsSnapshot) => {
            const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(productsData);
        });

        return () => {
            unsubscribeEntries();
            unsubscribeProducts();
        };
    }, [currentBranch, authLoading]);

    const productsWithStock = useMemo(() => {
        return products.map(product => {
            const stock = allStockEntries
                .filter(e => e.productId === product.id)
                .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
            return { ...product, stock };
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [products, allStockEntries]);

    const filteredProductsWithStock = useMemo(() => {
        if (!searchQuery) return productsWithStock;
        return productsWithStock.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [productsWithStock, searchQuery]);

    const totalStockCount = useMemo(() => {
        return productsWithStock.reduce((sum, product) => sum + product.stock, 0);
    }, [productsWithStock]);


    const dailyStockHistory = useMemo(() => {
        const sortedEntries = [...allStockEntries].sort((a,b) => a.date.getTime() - b.date.getTime());

        const groupedByDayAndProduct: Record<string, Record<string, StockEntry[]>> = {};

        sortedEntries.forEach(entry => {
            const day = format(entry.date, 'yyyy-MM-dd');
            if (!groupedByDayAndProduct[day]) groupedByDayAndProduct[day] = {};
            if (!groupedByDayAndProduct[day][entry.productId]) groupedByDayAndProduct[day][entry.productId] = [];
            groupedByDayAndProduct[day][entry.productId].push(entry);
        });

        const sortedDays = Object.keys(groupedByDayAndProduct).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
        const stockByProduct: Record<string, number> = {};
        const fullHistory: DailyStockSummary[] = [];

        for(const day of sortedDays) {
            const dayEntries = groupedByDayAndProduct[day];
            for (const productId in dayEntries) {
                const productEntries = dayEntries[productId];
                const productName = productEntries[0].productName;

                const entries = productEntries.filter(e => e.quantity > 0).reduce((sum, e) => sum + e.quantity, 0);
                const exits = productEntries.filter(e => e.quantity < 0).reduce((sum, e) => sum + e.quantity, 0);

                const initialStock = stockByProduct[productId] || 0;
                const finalStock = initialStock + entries + exits;
                
                fullHistory.push({
                    date: day,
                    productId,
                    productName,
                    initialStock,
                    entries,
                    exits: Math.abs(exits),
                    finalStock,
                    details: productEntries
                });
                stockByProduct[productId] = finalStock;
            }
        }

        return fullHistory.reverse();
    }, [allStockEntries]);
    
    const filteredDailyStockHistory = useMemo(() => {
        return dailyStockHistory.filter(item => {
            const inDateRange = historyDateRange?.from 
                ? (parseISO(item.date) >= startOfDay(historyDateRange.from) && parseISO(item.date) <= endOfDay(historyDateRange.to || historyDateRange.from))
                : true;
            
            const matchesSearch = historySearchQuery
                ? item.productName.toLowerCase().includes(historySearchQuery.toLowerCase())
                : true;

            return inDateRange && matchesSearch;
        });
    }, [dailyStockHistory, historySearchQuery, historyDateRange]);

    const handleOpenForm = (type: 'entry' | 'adjustment' | 'transfer') => {
        setFormType(type);
        setIsFormOpen(true);
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
    
    const exportCurrentStockToPDF = () => {
        const doc = new jsPDF();
        doc.text(`Relatório de Estoque Atual - Filial: ${currentBranch?.name}`, 14, 16);
        doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);
        
        autoTable(doc, {
            head: [['Produto', 'Categoria', 'Quantidade']],
            body: filteredProductsWithStock.map(p => [
                p.name,
                p.category,
                p.stock.toString()
            ]),
            startY: 28
        });

        doc.save(`estoque_atual_${currentBranch?.name}.pdf`);
    };

    if (!currentBranch && !authLoading) {
        return (
            <Card className="m-auto">
                <CardHeader><CardTitle>Nenhuma Filial Selecionada</CardTitle></CardHeader>
                <CardContent>
                    <p>Por favor, selecione uma filial no topo da página para ver o relatório de movimentação.</p>
                    <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Ajustes</Link>.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
        <div className="space-y-6 printable-area">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 no-print">
                <h1 className="text-3xl font-bold">Gestão de Estoque</h1>
                {canManageStock && (
                     <div className="flex flex-wrap gap-2">
                        <NfeImportDialog products={products} />
                        <Button variant="outline" onClick={() => handleOpenForm('entry')}><PlusCircle className="mr-2" />Entrada</Button>
                        <Button variant="outline" onClick={() => handleOpenForm('adjustment')}><MinusCircle className="mr-2" />Saída</Button>
                        <Button variant="outline" onClick={() => handleOpenForm('transfer')} disabled={branches.length <= 1}><ArrowRightLeft className="mr-2" />Transferir</Button>
                    </div>
                )}
            </div>

            {canManageStock && (
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {formType === 'entry' && 'Entrada de Estoque'}
                                {formType === 'adjustment' && 'Saída de Estoque'}
                                {formType === 'transfer' && 'Transferência de Estoque'}
                            </DialogTitle>
                             <DialogDescription>
                                {formType === 'transfer' ? "Selecione o produto, quantidade e filial de destino." : "Selecione o produto e a quantidade para registrar a movimentação."}
                            </DialogDescription>
                        </DialogHeader>
                        <StockMovementForm 
                            type={formType}
                            products={products}
                            branches={branches.filter(b => b.id !== currentBranch?.id)}
                            onDone={() => setIsFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            <Tabs defaultValue="current">
                <TabsList className="grid w-full grid-cols-2 no-print">
                    <TabsTrigger value="current"><Package className="mr-2"/> Estoque Atual</TabsTrigger>
                    <TabsTrigger value="history"><History className="mr-2"/> Histórico de Movimentações</TabsTrigger>
                </TabsList>
                <TabsContent value="current" className="mt-4">
                     <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between gap-4">
                                <div>
                                    <CardTitle>Estoque Atual</CardTitle>
                                    <CardDescription>Visão geral das quantidades de cada produto na filial. Total de Itens em Estoque: <span className="font-bold text-foreground">{totalStockCount.toLocaleString('pt-BR')}</span></CardDescription>
                                </div>
                                <div className="flex gap-2 no-print">
                                    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2" /> Imprimir</Button>
                                    <Button variant="outline" size="sm" onClick={exportCurrentStockToPDF}><FileDown className="mr-2" /> PDF</Button>
                                </div>
                            </div>
                            <div className="relative pt-4 no-print">
                                <Search className="absolute left-2.5 top-6.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Buscar produto por nome ou categoria..."
                                    className="w-full rounded-lg bg-background pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                             {/* Mobile View - List of Cards */}
                            <div className="md:hidden space-y-3">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                                ) : filteredProductsWithStock.length > 0 ? (
                                    filteredProductsWithStock.map((item) => (
                                        <div key={item.id} className="p-4 border rounded-lg flex justify-between items-center">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-sm text-muted-foreground">{item.category}</p>
                                            </div>
                                            <p className="font-bold text-2xl">{item.stock}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-muted-foreground py-10">Nenhum produto encontrado.</p>
                                )}
                            </div>

                            {/* Desktop View - Table */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="text-right">Quantidade</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : filteredProductsWithStock.length > 0 ? (
                                            filteredProductsWithStock.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell>{item.category}</TableCell>
                                                    <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-24 text-center">Nenhum produto encontrado.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Histórico de Movimentações</CardTitle>
                            <CardDescription>Visão completa de todas as movimentações de estoque da filial.</CardDescription>
                             <div className="flex flex-col sm:flex-row gap-2 pt-4 no-print">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Buscar por nome do produto..."
                                        className="w-full rounded-lg bg-background pl-8"
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    />
                                </div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !historyDateRange && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {historyDateRange?.from ? (
                                        historyDateRange.to ? (
                                            <>
                                            {format(historyDateRange.from, "LLL dd, y", { locale: ptBR })} -{" "}
                                            {format(historyDateRange.to, "LLL dd, y", { locale: ptBR })}
                                            </>
                                        ) : (
                                            format(historyDateRange.from, "LLL dd, y", { locale: ptBR })
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
                                        defaultMonth={historyDateRange?.from}
                                        selected={historyDateRange}
                                        onSelect={setHistoryDateRange}
                                        numberOfMonths={2}
                                        locale={ptBR}
                                    />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Mobile View */}
                            <div className="md:hidden space-y-4">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
                                ) : filteredDailyStockHistory.length > 0 ? (
                                    filteredDailyStockHistory.map((item, index) => (
                                        <Card key={`${item.date}-${item.productId}`} onClick={() => setSelectedHistoryItem(item)} className="cursor-pointer">
                                            <CardHeader>
                                                <CardTitle className="text-base">{item.productName}</CardTitle>
                                                <CardDescription>{format(parseISO(item.date), 'dd/MM/yyyy')}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                <div>Est. Inicial: <span className="font-semibold">{item.initialStock}</span></div>
                                                <div className="text-green-600">Entradas: <span className="font-semibold">+{item.entries}</span></div>
                                                <div className="text-red-500">Saídas: <span className="font-semibold">-{item.exits}</span></div>
                                                <div>Est. Final: <span className="font-semibold">{item.finalStock}</span></div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <p className="text-center text-muted-foreground py-10">Nenhuma movimentação encontrada.</p>
                                )}
                            </div>

                            {/* Desktop View */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Produto</TableHead>
                                            <TableHead className="text-right">Est. Inicial</TableHead>
                                            <TableHead className="text-right text-green-600">Entradas</TableHead>
                                            <TableHead className="text-right text-red-500">Saídas</TableHead>
                                            <TableHead className="text-right">Est. Final</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : filteredDailyStockHistory.length > 0 ? (
                                            filteredDailyStockHistory.map((item, index) => (
                                                <TableRow key={`${item.date}-${item.productId}`} onClick={() => setSelectedHistoryItem(item)} className="cursor-pointer">
                                                    <TableCell className="font-medium">{format(parseISO(item.date), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell>{item.productName}</TableCell>
                                                    <TableCell className="text-right">{item.initialStock}</TableCell>
                                                    <TableCell className="text-right text-green-600">+{item.entries}</TableCell>
                                                    <TableCell className="text-right text-red-500">-{item.exits}</TableCell>
                                                    <TableCell className="text-right font-semibold">{item.finalStock}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center">Nenhuma movimentação encontrada.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            
            <Dialog open={!!selectedHistoryItem} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalhes da Movimentação</DialogTitle>
                        <DialogDescription>
                            {selectedHistoryItem?.productName} - {selectedHistoryItem && format(parseISO(selectedHistoryItem.date), 'dd/MM/yyyy')}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Quantidade</TableHead>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead>Obs.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedHistoryItem?.details.map(detail => (
                                     <TableRow key={detail.id}>
                                        <TableCell>{format(detail.date, 'HH:mm:ss')}</TableCell>
                                        <TableCell>{getBadgeForType(detail.type)}</TableCell>
                                        <TableCell className={`font-semibold ${detail.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {detail.quantity > 0 ? `+${detail.quantity}` : detail.quantity}
                                        </TableCell>
                                        <TableCell>{detail.userName}</TableCell>
                                        <TableCell>{detail.notes}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
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
                    .no-print {
                        display: none;
                    }
                }
            `}</style>
        </>
    );
}

    
