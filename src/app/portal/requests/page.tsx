'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

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

export default function RequestPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [requestType, setRequestType] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [myRequests, setMyRequests] = useState<Request[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);

    // Effect to fetch user's requests
    useEffect(() => {
        if (!user?.customerId) {
            setLoadingRequests(false);
            return;
        }

        const q = query(
            collection(db, 'requests'),
            where('customerId', '==', user.customerId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
            setMyRequests(userRequests);
            setLoadingRequests(false);
        }, (error) => {
            console.error("Error fetching requests: ", error);
            toast({ title: 'Erro ao buscar solicitações', variant: 'destructive' });
            setLoadingRequests(false);
        });

        return () => unsubscribe();
    }, [user?.customerId, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestType || !message) {
            toast({ title: 'Erro', description: 'Por favor, preencha todos os campos.', variant: 'destructive' });
            return;
        }
        if (!user || !user.customerId) {
            toast({ title: 'Erro', description: 'Você precisa ser um cliente logado para fazer uma solicitação.', variant: 'destructive' });
            return;
        }

        setLoading(true);

        try {
            const customerRef = doc(db, 'customers', user.customerId);
            const customerSnap = await getDoc(customerRef);

            if (!customerSnap.exists()) {
                throw new Error("Dados do cliente não encontrados.");
            }
            const customerData = customerSnap.data() as Customer;

            await addDoc(collection(db, 'requests'), {
                organizationId: user.organizationId,
                branchId: customerData.branchId, 
                customerId: user.customerId,
                customerName: customerData.name,
                requestType,
                message,
                status: 'pending', // pending -> viewed -> done
                createdAt: serverTimestamp(),
            });

            toast({ title: 'Sucesso!', description: 'Sua solicitação foi enviada.' });
            setRequestType('');
            setMessage('');
        } catch (error) {
            console.error("Error sending request: ", error);
            toast({ title: 'Erro', description: 'Ocorreu um problema ao enviar sua solicitação.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Nova Solicitação</CardTitle>
                    <CardDescription>Peça um produto, serviço ou agendamento. Entraremos em contato em breve.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="requestType">Tipo de Solicitação</Label>
                            <Select value={requestType} onValueChange={setRequestType}>
                                <SelectTrigger id="requestType">
                                    <SelectValue placeholder="Selecione o que você deseja solicitar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Agendamento">Agendamento de Serviço</SelectItem>
                                    <SelectItem value="Produto">Compra de Produto</SelectItem>
                                    <SelectItem value="Outra">Outra Solicitação</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="message">Mensagem</Label>
                            <Textarea
                                id="message"
                                placeholder="Detalhe aqui o que você precisa. Por exemplo: 'Gostaria de agendar uma massagem relaxante na próxima semana' ou 'Preciso de um frasco do shampoo X.'"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                            />
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enviar Solicitação
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Minhas Solicitações</CardTitle>
                    <CardDescription>Acompanhe o status das suas solicitações enviadas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loadingRequests ? (
                        <div className="flex justify-center items-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : myRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Você ainda não fez nenhuma solicitação.</p>
                    ) : (
                        myRequests.map((req, index) => (
                            <div key={req.id}>
                                <div className="flex justify-between items-start">
                                                                    <div className="space-y-1">
                                                                        <p className="font-semibold">{req.requestType === 'Agendamento' ? 'Agendamento de Serviço' : req.requestType === 'Produto' ? 'Compra de Produto' : 'Outra Solicitação'}</p>
                                                                        <p className="text-sm text-muted-foreground bg-gray-50 p-2 rounded-md">{req.message}</p>
                                                                        
                                                                        {/* Replies */}
                                                                        <div className="space-y-3 pt-2 pl-4 border-l-2">
                                                                            {req.replies?.map((reply, i) => (
                                                                                <div key={i} className="flex flex-col items-start">
                                                                                    <div className={`rounded-lg px-3 py-2 max-w-md ${reply.authorId === user?.id ? 'bg-blue-100' : 'bg-green-100'}`}>
                                                                                        <p className="text-sm">{reply.text}</p>
                                                                                    </div>
                                                                                    <span className="text-xs text-muted-foreground mt-1">
                                                                                        {reply.authorName} - {reply.createdAt ? format(new Date(reply.createdAt.toDate()), 'dd/MM HH:mm') : ''}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                    
                                                                        <p className="text-xs text-muted-foreground pt-2">
                                                                            Enviado em: {req.createdAt ? format(new Date(req.createdAt.toDate()), 'dd/MM/yyyy HH:mm') : ''}
                                                                        </p>
                                                                    </div>                                    {getStatusBadge(req.status)}
                                </div>
                                {index < myRequests.length - 1 && <Separator className="my-4" />}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
