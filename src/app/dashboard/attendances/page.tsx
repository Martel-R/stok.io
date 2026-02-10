'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import type { ClinicalRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function AttendancesPage() {
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.organizationId || !currentBranch?.id) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'clinicalRecords'),
            where('organizationId', '==', user.organizationId),
            where('branchId', '==', currentBranch.id),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                date: doc.data().date.toDate(), // Convert Firestore Timestamp to JS Date
            } as ClinicalRecord));
            setClinicalRecords(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching clinical records:", error);
            toast({ title: "Erro ao buscar registros clínicos", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, currentBranch, toast]);

    const handleNewAttendance = () => {
        router.push('/dashboard/attendances/new');
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Histórico de Atendimentos</CardTitle>
                        <CardDescription>
                            Visualize e gerencie todos os atendimentos e fichas preenchidas.
                        </CardDescription>
                    </div>
                    <Button onClick={handleNewAttendance}><PlusCircle className="mr-2 h-4 w-4" /> Iniciar Novo Atendimento</Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Profissional</TableHead>
                            <TableHead>Modelo da Ficha</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : clinicalRecords.length > 0 ? (
                            clinicalRecords.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell>{format(record.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell className="font-medium">{record.customerName}</TableCell>
                                    <TableCell>{record.professionalName}</TableCell>
                                    <TableCell>{record.templateName}</TableCell>
                                    <TableCell>{record.status}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Nenhum atendimento encontrado para esta filial.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
