'use client';

import { useState, useEffect } from 'react';
import { Bell, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X as CloseIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Request {
    id: string;
    customerName?: string;
    requesterName?: string;
    requestType: string;
    itemName?: string;
    totalAmount?: number;
    actionDescription?: string;
    createdAt: any; // Firestore Timestamp
    status: string;
    cashSummary?: {
        paymentTotals: Record<string, number>;
        expectedCash: number;
    };
    adjustmentDetails?: {
        type: 'sangria' | 'reforço';
        amount: number;
        reason: string;
    };
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export function NotificationBell() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<Request[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!user?.organizationId) return;

        const q = query(
            collection(db, 'requests'),
            where('organizationId', '==', user.organizationId),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
            setRequests(newRequests);
        }, (error) => {
            console.error("Firestore Error on NotificationBell: ", error);
        });

        return () => unsubscribe();
    }, [user?.organizationId]);

    const handleApproval = async (requestId: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                status: 'approved',
                supervisorId: user.id,
                supervisorName: user.name
            });
            toast({ title: 'Solicitação Aprovada!' });
        } catch (error) {
            console.error("Error approving request:", error);
            toast({ title: 'Erro ao aprovar', variant: 'destructive' });
        }
    };

    const handleReject = async (requestId: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                status: 'rejected',
                supervisorId: user.id,
                supervisorName: user.name
            });
            toast({ title: 'Solicitação Negada.' });
        } catch (error) {
            console.error("Error rejecting request:", error);
            toast({ title: 'Erro ao negar', variant: 'destructive' });
        }
    };

    const renderNotificationContent = (req: Request) => {
        if (req.requestType === 'SupervisorApproval') {
            return (
                <div className="flex flex-col gap-1 w-full">
                    <p className="text-sm font-medium">
                        Solicitação de <span className="font-bold">{req.requesterName}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase">
                        {req.actionDescription}
                    </p>
                    
                    {/* Detalhes de Ajuste de Caixa */}
                    {req.adjustmentDetails && (
                        <div className="bg-muted/50 p-2 rounded text-[10px] space-y-1 my-1">
                            <p><span className="font-semibold">Operação:</span> {req.adjustmentDetails.type.toUpperCase()}</p>
                            <p><span className="font-semibold">Valor:</span> {formatCurrency(req.adjustmentDetails.amount)}</p>
                            <p><span className="font-semibold">Motivo:</span> {req.adjustmentDetails.reason}</p>
                        </div>
                    )}

                    {/* Resumo de Fechamento de Caixa */}
                    {req.cashSummary && (
                        <div className="bg-muted/50 p-2 rounded text-[10px] space-y-1 my-1">
                            <p className="font-bold border-b pb-1 mb-1">Resumo do Caixa:</p>
                            {Object.entries(req.cashSummary.paymentTotals).map(([name, total]) => (
                                <div key={name} className="flex justify-between">
                                    <span>{name.replace(/_/g, '.')}:</span>
                                    <span>{formatCurrency(total as number)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between font-bold border-t pt-1 mt-1 text-primary">
                                <span>Saldo Esperado (DIN):</span>
                                <span>{formatCurrency(req.cashSummary.expectedCash)}</span>
                            </div>
                        </div>
                    )}

                    {/* Detalhes de Item do Carrinho */}
                    {req.itemName && req.itemName !== 'N/A' && (
                        <p className="text-xs text-muted-foreground">
                            Item: <span className="font-medium">{req.itemName}</span>
                        </p>
                    )}

                    {req.totalAmount !== undefined && req.totalAmount > 0 && !req.cashSummary && !req.adjustmentDetails && (
                         <p className="text-xs font-semibold text-primary">
                            Total Carrinho: {formatCurrency(req.totalAmount)}
                        </p>
                    )}

                    <div className="flex gap-2 mt-2" onClick={(e) => e.preventDefault()}>
                        <Button 
                            size="sm" 
                            variant="default" 
                            className="h-7 px-2 flex-1 gap-1 text-[10px]" 
                            onClick={() => handleApproval(req.id)}
                        >
                            <Check className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2 flex-1 gap-1 text-[10px] text-destructive hover:text-destructive" 
                            onClick={() => handleReject(req.id)}
                        >
                            <CloseIcon className="h-3 w-3" /> Negar
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">
                    Nova solicitação de <span className="font-bold">{req.customerName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                    {req.requestType}
                </p>
            </div>
        );
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {requests.length > 0 && (
                        <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                            {requests.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 font-semibold border-b">Notificações</div>
                <div className="space-y-2 p-2 max-h-80 overflow-y-auto">
                    {requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nova solicitação.</p>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="relative group">
                                <Link 
                                    href={req.requestType === 'SupervisorApproval' ? '#' : `/dashboard/customers?requestId=${req.id}`} 
                                    onClick={() => req.requestType !== 'SupervisorApproval' && setIsOpen(false)}
                                    className="block"
                                >
                                    <div className="flex items-start p-3 rounded-lg hover:bg-accent border-b last:border-0">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary mr-3 mt-1 shrink-0">
                                            <Send className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {renderNotificationContent(req)}
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {req.createdAt ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
