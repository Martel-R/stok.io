'use client';

import { useState, useEffect } from 'react';
import { Bell, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Request {
    id: string;
    customerName: string;
    requestType: string;
    createdAt: any; // Firestore Timestamp
}

export function NotificationBell() {
    const { user } = useAuth();
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
            <PopoverContent className="w-80 p-0">
                <div className="p-4 font-semibold border-b">Notificações</div>
                <div className="space-y-2 p-4 max-h-80 overflow-y-auto">
                    {requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center">Nenhuma nova solicitação.</p>
                    ) : (
                        requests.map(req => (
                            <Link href={`/dashboard/customers?requestId=${req.id}`} key={req.id} onClick={() => setIsOpen(false)}>
                                <div className="flex items-start p-2 rounded-lg hover:bg-accent">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary mr-3">
                                        <Send className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium">
                                            Nova solicitação de <span className="font-bold">{req.customerName}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {req.createdAt ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
