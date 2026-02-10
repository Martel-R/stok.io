'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import type { Customer, ClinicalRecord } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Mail, Phone, MapPin, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

function CustomerInfo({ customer }: { customer: Customer }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><User /> {customer.name}</CardTitle>
                <CardDescription>CPF/CNPJ: {customer.cpfCnpj}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.address}</span>
                </div>
            </CardContent>
        </Card>
    );
}

function AttendanceHistory({ customerId }: { customerId: string }) {
    const [records, setRecords] = useState<ClinicalRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'clinicalRecords'),
            where('customerId', '==', customerId),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate(),
            } as ClinicalRecord));
            setRecords(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [customerId]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Histórico de Atendimentos</CardTitle>
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
                            <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                        ) : records.length > 0 ? (
                            records.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell>{format(record.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell>{record.professionalName}</TableCell>
                                    <TableCell>{record.templateName}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" disabled>
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum atendimento encontrado.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


export default function CustomerDetailPage() {
    const params = useParams();
    const { id } = params;
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof id !== 'string') return;

        const fetchCustomer = async () => {
            const customerDoc = await getDoc(doc(db, 'customers', id));
            if (customerDoc.exists()) {
                setCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
            }
            setLoading(false);
        };

        fetchCustomer();
    }, [id]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!customer) {
        return <p>Cliente não encontrado.</p>;
    }

    return (
        <div className="space-y-6">
            <CustomerInfo customer={customer} />
            <AttendanceHistory customerId={customer.id} />
        </div>
    );
}
