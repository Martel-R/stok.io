

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Customer, AnamnesisQuestion, AnamnesisAnswer } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnamnesisPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [questions, setQuestions] = useState<AnamnesisQuestion[]>([]);
    const [answers, setAnswers] = useState<AnamnesisAnswer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!user || !user.organizationId || !user.customerId) {
            setLoading(false);
            return;
        }

        const fetchAllData = async () => {
            // Fetch questions
            const q = query(collection(db, 'anamnesisQuestions'), where('organizationId', '==', user.organizationId), where('isDeleted', '!=', true));
            const questionSnap = await getDocs(q);
            const questionData = questionSnap.docs.map(d => ({ id: d.id, ...d.data() } as AnamnesisQuestion))
                .sort((a,b) => (a.order || 0) - (b.order || 0));
            setQuestions(questionData);

            // Fetch customer data to get existing answers
            const customerRef = doc(db, 'customers', user.customerId);
            const customerSnap = await getDoc(customerRef);
            if (customerSnap.exists()) {
                const customerData = customerSnap.data() as Customer;
                setCustomer(customerData);

                // Initialize answers
                const existingAnswers = new Map(customerData.anamnesisAnswers?.map(a => [a.questionId, a]));
                const initialAnswers = questionData.map(q => {
                    if (existingAnswers.has(q.id)) {
                        return existingAnswers.get(q.id)!;
                    }
                     let defaultAnswer: any;
                    switch(q.type) {
                        case 'boolean': defaultAnswer = null; break;
                        case 'boolean_with_text': defaultAnswer = { choice: null, details: ''}; break;
                        case 'integer': case 'decimal': defaultAnswer = null; break;
                        default: defaultAnswer = ''; break;
                    }
                    return { questionId: q.id, questionLabel: q.label, answer: defaultAnswer };
                });
                setAnswers(initialAnswers as AnamnesisAnswer[]);
            }
            setLoading(false);
        };
        
        fetchAllData();

    }, [user]);

     const handleAnamnesisChange = (questionId: string, value: any) => {
        setAnswers(prev => {
            const newAnswers = prev.map(a => 
                a.questionId === questionId ? { ...a, answer: value } : a
            );
            return newAnswers;
        });
    };

    const renderAnswerInput = (question: AnamnesisQuestion) => {
        const answer = answers.find(a => a.questionId === question.id);
        if (!answer) return null;

        switch(question.type) {
            case 'text':
                return <Textarea value={answer.answer || ''} onChange={(e) => handleAnamnesisChange(question.id, e.target.value)} />;
            case 'boolean':
                return (
                    <RadioGroup
                        value={answer.answer === true ? 'sim' : answer.answer === false ? 'nao' : ''}
                        onValueChange={(val) => handleAnamnesisChange(question.id, val === 'sim')}
                        className="flex space-x-4"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id={`${question.id}-sim`} /><Label htmlFor={`${question.id}-sim`}>Sim</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id={`${question.id}-nao`} /><Label htmlFor={`${question.id}-nao`}>Não</Label></div>
                    </RadioGroup>
                );
            case 'boolean_with_text':
                const currentAnswer = answer.answer || {};
                return (
                    <div className="space-y-2">
                        <RadioGroup
                            value={currentAnswer.choice === true ? 'sim' : currentAnswer.choice === false ? 'nao' : ''}
                            onValueChange={(val) => handleAnamnesisChange(question.id, { ...currentAnswer, choice: val === 'sim' })}
                            className="flex space-x-4"
                        >
                            <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id={`${question.id}-sim-wt`} /><Label htmlFor={`${question.id}-sim-wt`}>Sim</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id={`${question.id}-nao-wt`} /><Label htmlFor={`${question.id}-nao-wt`}>Não</Label></div>
                        </RadioGroup>
                        {currentAnswer.choice === true && (
                            <Textarea 
                                value={currentAnswer.details || ''}
                                onChange={(e) => handleAnamnesisChange(question.id, { ...currentAnswer, details: e.target.value })}
                                placeholder="Se sim, especifique..."
                            />
                        )}
                    </div>
                );
            case 'integer':
            case 'decimal':
                return <Input type="number" step={question.type === 'decimal' ? '0.01' : '1'} value={answer.answer ?? ''} onChange={(e) => handleAnamnesisChange(question.id, e.target.value === '' ? null : (question.type === 'decimal' ? parseFloat(e.target.value) : parseInt(e.target.value, 10)))} />;
            default:
                return null;
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return;
        setIsSaving(true);
        try {
            const customerRef = doc(db, 'customers', customer.id);
            await updateDoc(customerRef, { anamnesisAnswers: answers });
            toast({ title: "Formulário salvo com sucesso!" });
        } catch (error) {
            toast({ title: "Erro ao salvar", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }

    if (loading) {
        return (
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                    {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-20 w-full"/>)}
                </CardContent>
            </Card>
        )
    }

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Formulário de Anamnese</CardTitle>
                    <CardDescription>
                        Por favor, responda às perguntas abaixo. Suas respostas são confidenciais e essenciais para a segurança e eficácia do seu atendimento.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {questions.length > 0 ? questions.map(q => (
                        <div key={q.id} className="space-y-2 border-t pt-4">
                            <Label className="font-semibold">{q.label}</Label>
                            {renderAnswerInput(q)}
                        </div>
                    )) : (
                        <p className="text-muted-foreground text-center">Nenhuma pergunta de anamnese configurada pela clínica.</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSaving || questions.length === 0}>
                        {isSaving && <Loader2 className="mr-2 animate-spin" />}
                        Salvar Respostas
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
