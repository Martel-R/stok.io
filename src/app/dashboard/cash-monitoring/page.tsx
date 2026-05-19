
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CashSession, CashTransaction, Sale } from '@/lib/types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Eye, XCircle, Calendar as CalendarIcon, Wallet, History, Info, AlertTriangle, Loader2, ShieldCheck, CreditCard, Banknote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CloseSessionDialog } from '@/components/cash-session-manager';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useRouter } from 'next/navigation';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export default function CashMonitoringPage() {
    const { user, currentBranch, loading: authLoading } = useAuth();
    const [sessions, setSessions] = useState<CashSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [sales, setSales] = useState<Record<string, Sale>>({});
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [rowEditingId, setRowEditingId] = useState<string | null>(null);
    const router = useRouter();

    const isAdminOrManager = useMemo(() => {
        if (!user) return false;
        const isSuperAdmin = user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
        const hasModulePermission = user.enabledModules?.cashMonitoring?.view;
        return (
            user.role === 'admin' || 
            user.role === 'manager' || 
            user.isImpersonating || 
            isSuperAdmin ||
            !!hasModulePermission
        );
    }, [user]);

    useEffect(() => {
        if (authLoading || !user?.organizationId || !currentBranch || !isAdminOrManager) {
            if (!authLoading && !isAdminOrManager) setLoading(false);
            return;
        }

        setLoading(true);
        let q = query(
            collection(db, 'cashSessions'),
            where('organizationId', '==', user.organizationId),
            where('branchId', '==', currentBranch.id),
            orderBy('openedAt', 'desc')
        );

        if (dateRange?.from) {
            q = query(q, where('openedAt', '>=', Timestamp.fromDate(startOfDay(dateRange.from))));
        }
        if (dateRange?.to) {
            q = query(q, where('openedAt', '<=', Timestamp.fromDate(endOfDay(dateRange.to))));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as CashSession));
            setSessions(sessionsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching sessions:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.organizationId, currentBranch, dateRange, authLoading, isAdminOrManager]);

    const filteredSessions = useMemo(() => {
        return sessions.filter(session => {
            const matchesSearch = session.userName.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [sessions, searchQuery, statusFilter]);

    useEffect(() => {
        if (!selectedSession?.id || !isDetailsOpen) return;

        setLoadingTransactions(true);
        const q = query(
            collection(db, 'cashTransactions'),
            where('sessionId', '==', selectedSession.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as CashTransaction));
            
            const sortedTx = txData.sort((a, b) => {
                const dateA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
                const dateB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
                return dateB - dateA;
            });

            setTransactions(sortedTx);
            setLoadingTransactions(false);
        }, (error) => {
            console.error("Error fetching transactions:", error);
            setLoadingTransactions(false);
        });

        // Buscar vendas da sessão para mostrar os itens e pagamentos
        const salesQuery = query(
            collection(db, 'sales'),
            where('sessionId', '==', selectedSession.id)
        );

        const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
            const salesMap: Record<string, Sale> = {};
            snapshot.docs.forEach(doc => {
                salesMap[doc.id] = { id: doc.id, ...doc.data() } as Sale;
            });
            setSales(salesMap);
        });

        return () => {
            unsubscribe();
            unsubscribeSales();
        };
    }, [selectedSession?.id, isDetailsOpen]);

    const handleViewDetails = (session: CashSession) => {
        setSelectedSession(session);
        setIsDetailsOpen(true);
    };

    const handleCloseSession = (session: CashSession) => {
        setSelectedSession(session);
        setIsCloseDialogOpen(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open':
                return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 font-bold uppercase text-[10px]">Aberto</Badge>;
            case 'closed':
                return <Badge variant="outline" className="text-muted-foreground font-bold uppercase text-[10px]">Fechado</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
        return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    };

    if (authLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdminOrManager) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Card className="max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center justify-center gap-2">
                            <AlertTriangle className="h-6 w-6" />
                            Acesso Restrito
                        </CardTitle>
                        <CardDescription>
                            Apenas administradores ou gerentes podem acessar esta página de monitoramento.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push('/dashboard')}>Voltar ao Início</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Caixas</h1>
                    <p className="text-muted-foreground">Acompanhe o fluxo de caixa em tempo real.</p>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Filtros de Busca</CardTitle>
                    <CardDescription>Refine a lista de sessões de caixa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4 md:flex-row md:items-center">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome do operador..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "justify-start text-left font-normal w-full md:w-[280px]",
                                        !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "dd LLL, y", { locale: ptBR })} -{" "}
                                                {format(dateRange.to, "dd LLL, y", { locale: ptBR })}
                                            </>
                                        ) : (
                                            format(dateRange.from, "dd LLL, y", { locale: ptBR })
                                        )
                                    ) : (
                                        <span>Selecione um período</span>
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
                        
                        <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)} className="w-full md:w-auto">
                            <TabsList className="grid w-full grid-cols-3 md:w-auto">
                                <TabsTrigger value="all">Todos</TabsTrigger>
                                <TabsTrigger value="open">Abertos</TabsTrigger>
                                <TabsTrigger value="closed">Fechados</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="font-bold">Operador</TableHead>
                                <TableHead className="font-bold">Abertura</TableHead>
                                <TableHead className="font-bold">Fechamento</TableHead>
                                <TableHead className="text-right font-bold">Saldo Inicial</TableHead>
                                <TableHead className="text-right font-bold">Vendas (Dinheiro)</TableHead>
                                <TableHead className="text-right font-bold">Despesas/Sangrias</TableHead>
                                <TableHead className="text-center font-bold">Status</TableHead>
                                <TableHead className="text-right font-bold">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <span className="text-sm text-muted-foreground">Carregando sessões de caixa...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredSessions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">
                                        Nenhuma sessão de caixa encontrada para os filtros selecionados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSessions.map((session) => (
                                    <TableRow key={session.id} className="hover:bg-muted/5 transition-colors">
                                        <TableCell className="font-semibold">{session.userName}</TableCell>
                                        <TableCell className="text-[11px] font-mono">{formatDate(session.openedAt)}</TableCell>
                                        <TableCell className="text-[11px] font-mono">{session.status === 'closed' ? formatDate(session.closedAt) : '-'}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(session.openingBalance)}</TableCell>
                                        <TableCell className="text-right text-green-600 font-bold">+{formatCurrency(session.totalSales)}</TableCell>
                                        <TableCell className="text-right text-destructive font-bold">-{formatCurrency(session.totalExpenses)}</TableCell>
                                        <TableCell className="text-center">
                                            {getStatusBadge(session.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleViewDetails(session)}>
                                                    <Eye className="h-3.5 w-3.5" /> Detalhes
                                                </Button>
                                                {session.status === 'open' && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleCloseSession(session)} title="Fechar Caixa">
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Detalhes do Caixa */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-muted/20 border-b">
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                    <Wallet className="h-6 w-6 text-primary" />
                                    Sessão de Caixa: {selectedSession?.userName}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Iniciada em {selectedSession && formatDate(selectedSession.openedAt)}
                                </DialogDescription>
                            </div>
                            {selectedSession?.status && getStatusBadge(selectedSession.status)}
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                        {/* Cards de Resumo */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="shadow-none border-muted/60 bg-muted/10">
                                <CardContent className="p-4 space-y-1">
                                    <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Saldo Inicial</span>
                                    <p className="text-xl font-bold text-foreground">{formatCurrency(selectedSession?.openingBalance || 0)}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-green-100 bg-green-50/30">
                                <CardContent className="p-4 space-y-1">
                                    <span className="text-[10px] uppercase font-black text-green-600 tracking-widest">Vendas (Dinheiro)</span>
                                    <p className="text-xl font-bold text-green-700">+{formatCurrency(selectedSession?.totalSales || 0)}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-red-100 bg-red-50/30">
                                <CardContent className="p-4 space-y-1">
                                    <span className="text-[10px] uppercase font-black text-red-600 tracking-widest">Despesas/Sangrias</span>
                                    <p className="text-xl font-bold text-red-700">-{formatCurrency(selectedSession?.totalExpenses || 0)}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-primary/20 bg-primary/5">
                                <CardContent className="p-4 space-y-1">
                                    <span className="text-[10px] uppercase font-black text-primary tracking-widest">Saldo em Mão</span>
                                    <p className="text-xl font-bold text-primary">
                                        {formatCurrency((selectedSession?.openingBalance || 0) + (selectedSession?.totalSales || 0) - (selectedSession?.totalExpenses || 0))}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Resumo por Forma de Pagamento */}
                        {selectedSession?.paymentTotals && Object.keys(selectedSession.paymentTotals).length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <CreditCard className="h-5 w-5 text-primary" />
                                    <h3 className="text-lg font-bold">Resumo Financeiro</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {Object.entries(selectedSession.paymentTotals).map(([name, total]) => (
                                        <Card key={name} className="shadow-none border-muted/60 hover:border-primary/30 transition-colors">
                                            <CardContent className="p-3 space-y-1">
                                                <span className="text-[9px] uppercase font-bold text-muted-foreground truncate block">{name.replace(/_/g, '.')}</span>
                                                <span className="text-sm font-bold block">{formatCurrency(total as number)}</span>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Separator className="bg-muted/60" />

                        {/* Histórico de Movimentações */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-primary" />
                                    <h3 className="text-lg font-bold">Fluxo Detalhado de Movimentações</h3>
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase font-medium">{transactions.length} registros</span>
                            </div>
                            
                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                                            <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Horário</TableHead>
                                            <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Operação</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider">Descrição Detalhada</TableHead>
                                            <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Valor Líquido</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingTransactions ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                        <span className="text-xs text-muted-foreground italic">Reconstruindo histórico...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : transactions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">Nenhuma transação registrada nesta sessão.</TableCell>
                                            </TableRow>
                                        ) : (
                                            transactions.map((tx) => {
                                                const sale = tx.saleId ? sales[tx.saleId] : null;
                                                return (
                                                    <React.Fragment key={tx.id}>
                                                        {/* Linha Principal da Transação */}
                                                        <TableRow className={cn(
                                                            "group transition-colors",
                                                            sale ? "border-b-0" : "border-b",
                                                            rowEditingId === tx.id ? "bg-primary/5" : "hover:bg-muted/10"
                                                        )}>
                                                            <TableCell className="text-xs font-mono text-muted-foreground">
                                                                {formatDate(tx.date).split(' ')[1]}
                                                            </TableCell>
                                                            <TableCell>
                                                                {tx.type === 'sale' && <Badge variant="outline" className="text-green-600 border-green-100 bg-green-50 font-black uppercase text-[9px] px-1.5 py-0">Venda</Badge>}
                                                                {tx.type === 'expense' && <Badge variant="outline" className="text-destructive border-red-100 bg-red-50 font-black uppercase text-[9px] px-1.5 py-0">Despesa</Badge>}
                                                                {tx.type === 'opening' && <Badge variant="outline" className="text-blue-600 border-blue-100 bg-blue-50 font-black uppercase text-[9px] px-1.5 py-0">Abertura</Badge>}
                                                                {tx.type === 'withdrawal' && <Badge variant="outline" className="text-orange-600 border-orange-100 bg-orange-50 font-black uppercase text-[9px] px-1.5 py-0">Sangria</Badge>}
                                                                {tx.type === 'deposit' && <Badge variant="outline" className="text-indigo-600 border-indigo-100 bg-indigo-50 font-black uppercase text-[9px] px-1.5 py-0">Reforço</Badge>}
                                                            </TableCell>
                                                            <TableCell className="py-3">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{tx.description}</span>
                                                                    {tx.supervisorName && (
                                                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-muted/50 w-fit px-1.5 py-0.5 rounded border border-muted/60">
                                                                            <ShieldCheck className="h-3 w-3 text-primary" />
                                                                            Supervisor: {tx.supervisorName}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className={cn("text-right font-black text-xs", tx.amount < 0 ? "text-destructive" : "text-green-700")}>
                                                                {tx.amount < 0 ? '' : '+'}{formatCurrency(tx.amount)}
                                                            </TableCell>
                                                        </TableRow>

                                                        {/* Linha de Detalhes da Venda (Produtos e Pagamentos) */}
                                                        {sale && (
                                                            <TableRow className="border-t-0 hover:bg-transparent transition-colors">
                                                                <TableCell />
                                                                <TableCell colSpan={3} className="pt-0 pb-4 px-4">
                                                                    <div className="bg-muted/30 rounded-lg p-3 border border-muted/80 flex flex-col gap-3">
                                                                        {/* Lista de Itens */}
                                                                        <div className="space-y-1.5">
                                                                            <div className="text-[9px] uppercase font-black text-muted-foreground/80 tracking-widest flex items-center gap-1.5 mb-2">
                                                                                <Banknote className="h-3 w-3" /> Itens Vendidos
                                                                            </div>
                                                                            {sale.items.map((item, idx) => {
                                                                                const itemTotal = item.type === 'combo' ? item.finalPrice : item.total;
                                                                                return (
                                                                                    <div key={idx} className="flex justify-between items-center text-[11px] leading-tight pl-1 border-l-2 border-primary/20">
                                                                                        <div className="flex gap-2 items-center">
                                                                                            <span className="font-mono bg-primary/10 text-primary px-1 rounded text-[10px] font-bold">{item.quantity}x</span>
                                                                                            <span className="font-medium text-foreground/80">{item.name}</span>
                                                                                        </div>
                                                                                        <span className="font-semibold text-foreground/60">{formatCurrency(itemTotal)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>

                                                                        {/* Detalhes do Pagamento */}
                                                                        {sale.payments && sale.payments.length > 0 && (
                                                                            <div className="space-y-1.5 pt-2 border-t border-muted/80">
                                                                                <div className="text-[9px] uppercase font-black text-muted-foreground/80 tracking-widest flex items-center gap-1.5 mb-2">
                                                                                    <CreditCard className="h-3 w-3" /> Detalhes do Pagamento
                                                                                </div>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {sale.payments.map((p, pIdx) => (
                                                                                        <div key={pIdx} className="bg-background border border-muted-foreground/10 px-2 py-1 rounded-md flex items-center gap-2 shadow-sm">
                                                                                            <span className="text-[10px] font-bold text-foreground/70">{p.conditionName}:</span>
                                                                                            <span className="text-[10px] font-black text-primary">{formatCurrency(p.amount)}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t bg-muted/10">
                        <div className="flex w-full justify-between items-center px-2">
                            <div className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                <Info className="h-3 w-3" /> Valores em dinheiro somam ao saldo; demais formas apenas para conferência.
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsDetailsOpen(false)}>Fechar Janela</Button>
                                {selectedSession?.status === 'open' && (
                                    <Button variant="destructive" size="sm" className="font-bold shadow-sm" onClick={() => { setIsDetailsOpen(false); handleCloseSession(selectedSession); }}>
                                        <XCircle className="h-4 w-4 mr-2" /> Encerrar Caixa AGORA
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Fechamento */}
            <CloseSessionDialog
                isOpen={isCloseDialogOpen}
                onOpenChange={setIsCloseDialogOpen}
                session={selectedSession}
            />

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.15); }
            `}</style>
        </div>
    );
}
