'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import type { ClinicalRecord, FormTemplate, FormFieldType } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, Calendar, User, FileText, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const fieldTypeNames: Record<FormFieldType, string> = {
    text: 'Texto Curto',
    textarea: 'Texto Longo',
    number: 'Número',
    date: 'Data',
    checkbox: 'Caixa de Seleção',
    select: 'Menu de Opções',
    radio: 'Múltipla Escolha (única)',
};

export default function PortalRecordDetailPage() {
    const params = useParams();
    const { id } = params;
    const { toast } = useToast();
    const router = useRouter();

    const [record, setRecord] = useState<ClinicalRecord | null>(null);
    const [template, setTemplate] = useState<FormTemplate | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof id !== 'string') {
            setLoading(false);
            return;
        }

        const fetchRecordAndTemplate = async () => {
            try {
                const recordDoc = await getDoc(doc(db, 'clinicalRecords', id));
                if (!recordDoc.exists()) {
                    toast({ title: "Erro", description: "Ficha de atendimento não encontrada.", variant: "destructive" });
                    setLoading(false);
                    return;
                }
                const fetchedRecord = { id: recordDoc.id, ...recordDoc.data() } as ClinicalRecord;
                setRecord(fetchedRecord);

                const templateDoc = await getDoc(doc(db, 'formTemplates', fetchedRecord.templateId));
                if (templateDoc.exists()) {
                    setTemplate({ id: templateDoc.id, ...templateDoc.data() } as FormTemplate);
                } else {
                    toast({ title: "Aviso", description: "Modelo da ficha não encontrado.", variant: "default" });
                }
            } catch (error) {
                console.error("Error fetching record or template:", error);
                toast({ title: "Erro", description: "Não foi possível carregar a ficha.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        fetchRecordAndTemplate();
    }, [id, toast]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!record) {
        return <p>Ficha de atendimento não encontrada.</p>;
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText /> {record.templateName}
                </CardTitle>
                <CardDescription>Detalhes da ficha de atendimento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-muted-foreground">Data do Atendimento</Label>
                        <p className="font-medium flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {record.date ? format(record.date.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">Profissional</Label>
                        <p className="font-medium flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {record.professionalName}
                        </p>
                    </div>
                </div>

                <h3 className="text-lg font-semibold mt-6 mb-4 border-b pb-2">Respostas da Ficha</h3>
                {template && template.fields.length > 0 ? (
                    <div className="space-y-4">
                        {template.fields.sort((a, b) => a.order - b.order).map(field => (
                            <div key={field.id} className="border-b pb-3">
                                <Label className="font-medium">{field.label}</Label>
                                <p className="text-sm text-gray-700 mt-1">
                                    {(() => {
                                        const answer = record.answers[field.id];
                                        if (answer === undefined || answer === null || answer === '') {
                                            return <span className="text-muted-foreground italic">Não respondido</span>;
                                        }
                                        switch (field.type) {
                                            case 'checkbox':
                                                return answer ? 'Sim' : 'Não';
                                            case 'date':
                                                try {
                                                    return format(new Date(answer), 'dd/MM/yyyy');
                                                } catch {
                                                    return String(answer);
                                                }
                                            default:
                                                return String(answer);
                                        }
                                    })()}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground italic">Nenhum campo definido para este modelo de ficha ou modelo não encontrado.</p>
                )}
            </CardContent>
            <CardFooter>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
            </CardFooter>
        </Card>
    );
}
