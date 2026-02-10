'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Check, Eye, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { format } from 'date-fns';
import { Textarea } from './ui/textarea';
import { arrayUnion, serverTimestamp } from 'firebase/firestore';

interface Reply {
    authorId: string;
    authorName: string;
    text: string;
    createdAt: any;
}

interface Request {
    id: string;
    requestType: string;
    message: string;
    status: 'pending' | 'viewed' | 'done';
    createdAt: any;
    replies?: Reply[];
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'pending':
            return <Badge variant="destructive">Pendente</Badge>;
        case 'viewed':
            return <Badge variant="secondary">Visualizado</Badge>;
        case 'done':
            return <Badge>Concluído</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

function RequestCard({ request, onUpdateStatus }: { request: Request; onUpdateStatus: (id: string, status: 'viewed' | 'done') => void; }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    const handleSendReply = async () => {
        if (!replyText.trim() || !user) return;
        setIsReplying(true);
        try {
            const requestRef = doc(db, 'requests', request.id);
            const newReply: Reply = {
                authorId: user.id,
                authorName: user.name,
                text: replyText,
                createdAt: serverTimestamp(),
            };
            await updateDoc(requestRef, { 
                replies: arrayUnion(newReply),
                status: 'viewed' // Mark as viewed when admin replies
            });
            setReplyText('');
            toast({ title: 'Resposta enviada!' });
        } catch (error) {
            toast({ title: 'Erro ao enviar resposta', variant: 'destructive' });
            console.error("Error sending reply: ", error);
        } finally {
            setIsReplying(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-start pb-2">
                <div>
                    <CardTitle className="text-base">{request.requestType === 'Agendamento' ? 'Agendamento de Serviço' : request.requestType === 'Produto' ? 'Compra de Produto' : 'Outra Solicitação'}</CardTitle>
                    <CardDescription>{request.createdAt ? format(new Date(request.createdAt.toDate()), "dd/MM/yyyy 'às' HH:mm") : ''}</CardDescription>
                </div>
                {getStatusBadge(request.status)}
            </CardHeader>
            <CardContent>
                <p className="text-sm mb-4 bg-gray-50 p-3 rounded-md">{request.message}</p>

                {/* Replies List */}
                <div className="space-y-4 mb-4">
                    {request.replies?.map((reply, index) => (
                        <div key={index} className={`flex flex-col ${reply.authorId === user?.id ? 'items-end' : 'items-start'}`}>
                            <div className={`rounded-lg px-4 py-2 max-w-sm ${reply.authorId === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <p className="text-sm">{reply.text}</p>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1">
                                {reply.authorName} - {reply.createdAt ? format(new Date(reply.createdAt.toDate()), 'dd/MM HH:mm') : ''}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Reply Form */}
                <div className="space-y-2 mb-4">
                    <Textarea 
                        placeholder="Escreva sua resposta..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                    />
                    <Button size="sm" onClick={handleSendReply} disabled={isReplying || !replyText.trim()}>
                        {isReplying && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Responder
                    </Button>
                </div>

                <Separator />

                {/* Status Actions */}
                <div className="flex gap-2 pt-4">
                    {request.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => onUpdateStatus(request.id, 'viewed')}>
                            <Eye className="mr-2 h-4 w-4" />
                            Marcar como Visualizado
                        </Button>
                    )}
                    {request.status !== 'done' && (
                        <Button size="sm" onClick={() => onUpdateStatus(request.id, 'done')}>
                            <Check className="mr-2 h-4 w-4" />
                            Marcar como Concluído
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export function CustomerRequests({ customerId }: { customerId: string }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.organizationId || !customerId) return;

        const q = query(
            collection(db, 'requests'),
            where('organizationId', '==', user.organizationId),
            where('customerId', '==', customerId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
            setRequests(newRequests);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Error on CustomerRequests: ", error);
            toast({ title: "Erro ao carregar solicitações", description: "Verifique o console do navegador para mais detalhes.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.organizationId, customerId, toast]);

    const handleUpdateStatus = async (requestId: string, status: 'viewed' | 'done') => {
        try {
            const requestRef = doc(db, 'requests', requestId);
            await updateDoc(requestRef, { status });
            toast({ title: 'Status da solicitação atualizado!' });
        } catch (error) {
            toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
            console.error("Error updating request status: ", error);
        }
    };

    if (loading) {
        return <p>Carregando solicitações...</p>;
    }

    return (
        <div className="space-y-4">
            {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação encontrada para este cliente.</p>
            ) : (
                requests.map(req => (
                    <RequestCard key={req.id} request={req} onUpdateStatus={handleUpdateStatus} />
                ))
            )}
        </div>
    );
}
