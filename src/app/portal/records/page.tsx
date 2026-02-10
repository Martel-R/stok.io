'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import type { ClinicalRecord } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PortalRecordsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.organizationId || !user?.customerId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'clinicalRecords'),
            where('organizationId', '==', user.organizationId),
            where('customerId', '==', user.customerId),
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
            console.error("Error fetching clinical records for portal:", error);
            toast({ title: "Erro ao buscar suas fichas", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Minhas Fichas de Atendimento</CardTitle>
                <CardDescription>
                    Visualize o histórico das suas fichas de atendimento.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Profissional</TableHead>
                            <TableHead>Modelo da Ficha</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : clinicalRecords.length > 0 ? (
                            clinicalRecords.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell>{format(record.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell>{record.professionalName}</TableCell>
                                    <TableCell>{record.templateName}</TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/portal/records/${record.id}`}>
                                            <Button variant="ghost" size="icon">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Nenhuma ficha de atendimento encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
