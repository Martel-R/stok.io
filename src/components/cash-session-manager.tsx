'use client';
import React, { useState } from 'react';
import { doc, collection, writeBatch, serverTimestamp, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CashSession, CashTransaction } from '@/lib/types';
import { Loader2, Play, StopCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupervisorAuthorizationDialog } from './supervisor-authorization-dialog';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export function CashAdjustmentDialog({ isOpen, onOpenChange, session }: { isOpen: boolean; onOpenChange: (open: boolean) => void; session: CashSession }) {
    const { user, currentBranch } = useAuth();
    const [type, setType] = useState<'withdrawal' | 'deposit'>('withdrawal');
    const [amount, setAmount] = useState('0,00');
    const [description, setDescription] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const { toast } = useToast();

    const handleConfirmClick = () => {
        const val = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0;
        if (val <= 0) {
            toast({ title: 'Informe um valor válido', variant: 'destructive' });
            return;
        }

        // Se o usuário tem permissão direta, executa. Senão, pede autorização.
        if (user?.canAuthorizeCashAdjustment || user?.role === 'admin' || user?.role === 'manager') {
            executeAdjustment();
        } else {
            setIsAuthOpen(true);
        }
    };

    const executeAdjustment = async (supervisorId?: string, supervisorName?: string) => {
        if (!user || !currentBranch) return;
        const val = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0;

        setIsProcessing(true);
        try {
            const batch = writeBatch(db);
            const transactionRef = doc(collection(db, 'cashTransactions'));
            const sessionRef = doc(db, 'cashSessions', session.id);

            const transactionData: CashTransaction = {
                id: transactionRef.id,
                sessionId: session.id,
                organizationId: user.organizationId,
                branchId: currentBranch.id,
                type: type,
                amount: type === 'withdrawal' ? -val : val,
                date: serverTimestamp(),
                description: description || (type === 'withdrawal' ? 'Sangria de Caixa' : 'Reforço de Caixa'),
                ...(supervisorId && { supervisorId, supervisorName })
            };

            batch.set(transactionRef, transactionData);

            if (type === 'withdrawal') {
                batch.update(sessionRef, {
                    totalExpenses: (session.totalExpenses || 0) + val
                });
            } else {
                batch.update(sessionRef, {
                    totalExpenses: (session.totalExpenses || 0) - val
                });
            }

            await batch.commit();
            toast({ title: `${type === 'withdrawal' ? 'Sangria' : 'Reforço'} realizado com sucesso!` });
            setAmount('0,00');
            setDescription('');
            onOpenChange(false);
        } catch (error) {
            console.error("Error adjustment:", error);
            toast({ title: 'Erro ao processar ajuste', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Ajuste de Caixa</DialogTitle>
                    <DialogDescription>Retirada (Sangria) ou Entrada (Reforço) de valores em dinheiro.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tipo de Movimentação</Label>
                        <Select value={type} onValueChange={(val: any) => setType(val)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="withdrawal">Sangria (Retirada)</SelectItem>
                                <SelectItem value="deposit">Reforço (Entrada)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input
                            type="text"
                            value={amount}
                            onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, '');
                                val = (parseInt(val) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                setAmount(val);
                            }}
                            className="text-2xl h-14 font-mono text-center"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Descrição / Motivo</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ex: Pagamento de fornecedor, Troco inicial..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmClick} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <SupervisorAuthorizationDialog
            isOpen={isAuthOpen}
            onOpenChange={setIsAuthOpen}
            onAuthorized={executeAdjustment}
            actionDescription={`Ajuste de Caixa: ${type === 'withdrawal' ? 'Sangria' : 'Reforço'}`}
            permissionRequired="canAuthorizeCashAdjustment"
            adjustmentDetails={{
                type: type === 'withdrawal' ? 'sangria' : 'reforço',
                amount: parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0,
                reason: description || 'Sem descrição'
            }}
        />
        </>
    );
}

export function OpenSessionDialog
({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
    const { user, currentBranch } = useAuth();
    const [openingBalance, setOpeningBalance] = useState('0,00');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleOpen = async () => {
        if (!user || !currentBranch) return;
        
        setIsProcessing(true);
        try {
            const amount = parseFloat(openingBalance.replace(/\./g, '').replace(',', '.')) || 0;
            const sessionRef = doc(collection(db, 'cashSessions'));
            const sessionId = sessionRef.id;

            const sessionData: CashSession = {
                id: sessionId,
                organizationId: user.organizationId,
                branchId: currentBranch.id,
                userId: user.id,
                userName: user.name,
                openedAt: serverTimestamp(),
                openingBalance: amount,
                totalSales: 0,
                totalExpenses: 0,
                status: 'open',
            };

            const transactionRef = doc(collection(db, 'cashTransactions'));
            const transactionData: CashTransaction = {
                id: transactionRef.id,
                sessionId: sessionId,
                organizationId: user.organizationId,
                branchId: currentBranch.id,
                type: 'opening',
                amount: amount,
                date: serverTimestamp(),
                description: 'Abertura de Caixa',
            };

            const batch = writeBatch(db);
            batch.set(sessionRef, sessionData);
            batch.set(transactionRef, transactionData);
            await batch.commit();

            toast({ title: 'Caixa aberto com sucesso!' });
            onOpenChange(false);
        } catch (error) {
            console.error("Error opening session:", error);
            toast({ title: 'Erro ao abrir caixa', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Abrir Caixa</DialogTitle>
                    <DialogDescription>Informe o valor inicial em dinheiro no caixa.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="opening-balance">Valor Inicial (R$)</Label>
                    <Input
                        id="opening-balance"
                        type="text"
                        value={openingBalance}
                        onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            val = (parseInt(val) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                            setOpeningBalance(val);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isProcessing) {
                                e.preventDefault();
                                handleOpen();
                            }
                        }}
                        className="text-2xl h-14 font-mono text-center"
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleOpen} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Abrir Caixa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CloseSessionDialog({ session, isOpen, onOpenChange }: { session: CashSession | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
    const { user } = useAuth();
    const [closingBalance, setClosingBalance] = useState('0,00');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [adjustments, setAdjustments] = useState<CashTransaction[]>([]);
    const { toast } = useToast();

    React.useEffect(() => {
        if (isOpen && session) {
            const q = query(
                collection(db, 'cashTransactions'),
                where('sessionId', '==', session.id),
                where('type', 'in', ['withdrawal', 'deposit', 'adjustment'])
            );
            getDocs(q).then(snap => {
                setAdjustments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CashTransaction)));
            });
        }
    }, [isOpen, session]);

    if (!session && isOpen) return null;
    const safeSession = session || { openingBalance: 0, totalSales: 0, totalExpenses: 0 } as any;

    const expectedBalance = safeSession.openingBalance + safeSession.totalSales - safeSession.totalExpenses;

    const handleConfirmClick = () => {
        if (user?.canAuthorizeCashClose || user?.role === 'admin' || user?.role === 'manager') {
            handleClose();
        } else {
            setIsAuthOpen(true);
        }
    };

    const handleClose = async (supervisorId?: string, supervisorName?: string) => {
        if (!session) return;
        setIsProcessing(true);
        try {
            const amount = parseFloat(closingBalance.replace(/\./g, '').replace(',', '.')) || 0;
            const sessionRef = doc(db, 'cashSessions', session.id);

            await setDoc(sessionRef, {
                closedAt: serverTimestamp(),
                closingBalance: amount,
                expectedBalance: expectedBalance,
                status: 'closed',
                notes: notes,
                ...(supervisorId && { supervisorId, supervisorName })
            }, { merge: true });

            toast({ title: 'Caixa fechado com sucesso!' });
            onOpenChange(false);
        } catch (error) {
            console.error("Error closing session:", error);
            toast({ title: 'Erro ao fechar caixa', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Fechar Caixa</DialogTitle>
                    <DialogDescription>Confira os valores e informe o saldo final.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-muted-foreground">Saldo Inicial:</div>
                        <div className="text-right font-medium">{formatCurrency(safeSession.openingBalance)}</div>
                        <div className="text-muted-foreground">Total Vendas (Dinheiro):</div>
                        <div className="text-right font-medium text-green-600">+{formatCurrency(safeSession.totalSales)}</div>
                        <div className="text-muted-foreground">Total Despesas/Retiradas:</div>
                        <div className="text-right font-medium text-destructive">-{formatCurrency(safeSession.totalExpenses)}</div>
                        <div className="border-t pt-2 font-bold">Saldo Esperado em Dinheiro:</div>
                        <div className="border-t pt-2 text-right font-bold">{formatCurrency(expectedBalance)}</div>
                    </div>

                    {safeSession.paymentTotals && Object.keys(safeSession.paymentTotals).length > 0 && (
                        <div className="space-y-2 border-t pt-4">
                            <h4 className="text-sm font-semibold">Resumo por Forma de Pagamento</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {Object.entries(safeSession.paymentTotals).map(([name, total]) => (
                                    <React.Fragment key={name}>
                                        <div className="text-muted-foreground">{name.replace(/_/g, '.')}:</div>
                                        <div className="text-right font-medium">{formatCurrency(total as number)}</div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {adjustments.length > 0 && (
                        <div className="space-y-2 border-t pt-4">
                            <h4 className="text-sm font-semibold">Movimentações de Caixa</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {adjustments.map(adj => (
                                    <div key={adj.id} className="flex justify-between text-xs border-b pb-1 last:border-0">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{adj.description}</span>
                                            <span className="text-[10px] text-muted-foreground">{adj.type === 'withdrawal' ? 'Sangria' : adj.type === 'deposit' ? 'Reforço' : 'Ajuste'}</span>
                                        </div>
                                        <span className={cn("font-bold", adj.amount < 0 ? "text-destructive" : "text-green-600")}>
                                            {formatCurrency(Math.abs(adj.amount))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 border-t pt-4">

                        <Label htmlFor="closing-balance">Saldo Final em Dinheiro (R$)</Label>
                        <Input
                            id="closing-balance"
                            type="text"
                            value={closingBalance}
                            onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, '');
                                val = (parseInt(val) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                setClosingBalance(val);
                            }}
                            className="text-2xl h-14 font-mono text-center"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Diferenças, sangrias, etc."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button variant="destructive" onClick={handleConfirmClick} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
                        Fechar Caixa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <SupervisorAuthorizationDialog
            isOpen={isAuthOpen}
            onOpenChange={setIsAuthOpen}
            onAuthorized={handleClose}
            actionDescription="Fechamento de Caixa"
            permissionRequired="canAuthorizeCashClose"
            cashSummary={{
                paymentTotals: safeSession.paymentTotals || {},
                expectedCash: expectedBalance
            }}
        />
        </>
    );
}
