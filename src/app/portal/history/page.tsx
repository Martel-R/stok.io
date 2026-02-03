

'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import type { Attendance, Sale } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HistoryEvent {
    id: string;
    date: Date;
    type: 'attendance' | 'sale';
    total: number;
    description: string;
}

const convertTimestamp = (field: any): Date => {
    if (!field) return new Date();
    return field instanceof Timestamp ? field.toDate() : new Date(field.seconds * 1000);
};

export default function CustomerHistoryPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState<HistoryEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !user.customerId) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            const customerId = user.customerId;
            let combinedHistory: HistoryEvent[] = [];

            // Fetch Attendances
            const attendanceQuery = query(collection(db, 'attendances'), where('customerId', '==', customerId));
            const attendanceSnap = await getDocs(attendanceQuery);
            const attendances = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
            
            const attendanceIds = attendances.map(a => a.id);

            // Fetch related sales
            if (attendanceIds.length > 0) {
                 const salesQuery = query(collection(db, 'sales'), where('attendanceId', 'in', attendanceIds));
                 const salesSnap = await getDocs(salesQuery);
                 const salesData = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));

                 attendances.forEach(att => {
                    const relatedSale = salesData.find(s => s.attendanceId === att.id);
                    combinedHistory.push({
                        id: att.id,
                        date: convertTimestamp(att.date),
                        type: 'attendance',
                        total: att.total,
                        description: att.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
                    });
                 });
            }
           
            // Sort by most recent
            combinedHistory.sort((a,b) => b.date.getTime() - a.date.getTime());
            setHistory(combinedHistory);
            setLoading(false);
        };

        fetchHistory();

    }, [user]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Meu Histórico</CardTitle>
                <CardDescription>Veja todos os seus atendimentos, serviços e compras realizadas.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                     {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="mb-4"><Skeleton className="h-20 w-full"/></div>
                            ))
                        ) : history.length > 0 ? (
                            <div className="space-y-4">
                                {history.map(event => (
                                    <div key={event.id} className="flex items-center justify-between rounded-md border p-4">
                                        <div>
                                            <p className="font-semibold text-lg">{format(event.date, 'dd/MM/yyyy')}</p>
                                            <p className="text-sm text-muted-foreground max-w-lg truncate">{event.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-xl">R$ {event.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            <Badge variant={event.type === 'attendance' ? 'secondary' : 'outline'}>
                                                {event.type === 'attendance' ? 'Atendimento' : 'Compra'}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="flex h-48 items-center justify-center text-muted-foreground">
                                Nenhum histórico encontrado.
                            </div>
                        )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
