
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Appointment, AppointmentStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const convertAppointmentDate = (docData: any): Appointment => {
    const convert = (field: any) => field instanceof Timestamp ? field.toDate() : new Date();
    return { ...docData, start: convert(docData.start), end: convert(docData.end) } as Appointment;
};

const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
        case 'scheduled': return <Badge variant="secondary">Agendado</Badge>;
        case 'completed': return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
        case 'cancelled': return <Badge variant="outline">Cancelado</Badge>;
        case 'rescheduled': return <Badge className="bg-blue-100 text-blue-800">Reagendado</Badge>;
        case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
        default: return <Badge>{status}</Badge>;
    }
};

export default function CustomerAppointmentsPage() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !user.customerId) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'appointments'), where('customerId', '==', user.customerId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userAppointments = snapshot.docs.map(doc => convertAppointmentDate(doc.data()));
            setAppointments(userAppointments.sort((a,b) => b.start.getTime() - a.start.getTime()));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Histórico de Agendamentos</CardTitle>
                <CardDescription>Veja todos os seus agendamentos, passados e futuros.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Hora</TableHead>
                            <TableHead>Serviço</TableHead>
                            <TableHead>Profissional</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell>
                                </TableRow>
                            ))
                        ) : appointments.length > 0 ? (
                            appointments.map(app => (
                                <TableRow key={app.id}>
                                    <TableCell>{format(app.start, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{format(app.start, 'HH:mm')}</TableCell>
                                    <TableCell className="font-medium">{app.serviceName}</TableCell>
                                    <TableCell>{app.professionalName}</TableCell>
                                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    Você ainda não possui nenhum agendamento.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
