
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Appointment } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const convertAppointmentDate = (docData: any): Appointment => {
    const convert = (field: any) => field instanceof Timestamp ? field.toDate() : new Date();
    return { ...docData, start: convert(docData.start), end: convert(docData.end) } as Appointment;
};


export default function CustomerPortalPage() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !user.customerId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'appointments'),
            where('customerId', '==', user.customerId),
            where('start', '>=', new Date())
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const upcomingAppointments = snapshot.docs.map(doc => convertAppointmentDate(doc.data()));
            setAppointments(upcomingAppointments.sort((a,b) => a.start.getTime() - b.start.getTime()));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback>{user?.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold">Bem-vindo(a), {user?.name}!</h1>
                    <p className="text-muted-foreground">Aqui está um resumo das suas próximas atividades.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Próximos Agendamentos</CardTitle>
                    <CardDescription>Seus agendamentos futuros estão listados abaixo.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : appointments.length > 0 ? (
                        <div className="space-y-4">
                            {appointments.map(app => (
                                <div key={app.id} className="flex items-center justify-between rounded-md border p-4">
                                    <div>
                                        <h3 className="font-semibold">{app.serviceName}</h3>
                                        <p className="text-sm text-muted-foreground">com {app.professionalName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium flex items-center gap-2"><Calendar className="h-4 w-4"/> {format(app.start, 'dd/MM/yyyy')}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4"/> {format(app.start, 'HH:mm')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center">Você não possui nenhum agendamento futuro.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
