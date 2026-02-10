'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import type { Customer, FormTemplate, FormField, ClinicalRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';

function CustomerSelector({ onSelect, disabled, value }: { onSelect: (customer: Customer) => void, disabled: boolean, value: Customer | null }) {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!user?.organizationId) { setLoading(false); return; }
        const q = query(collection(db, 'customers'), where('organizationId', '==', user.organizationId), where('isDeleted', '!=', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const selectedCustomerName = value?.name || "Selecione um cliente...";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full max-w-sm justify-between" disabled={disabled}>
                    {selectedCustomerName}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full max-w-sm p-0">
                <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                        {loading && <div className="p-4 text-center text-sm">Carregando...</div>}
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                            {customers.map((customer) => (
                                <CommandItem key={customer.id} value={customer.name} onSelect={() => {
                                    onSelect(customer);
                                    setOpen(false);
                                }}>
                                    <Check className={cn("mr-2 h-4 w-4", value?.id === customer.id ? "opacity-100" : "opacity-0")} />
                                    {customer.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function FormTemplateSelector({ onSelect, disabled }: { onSelect: (template: FormTemplate) => void, disabled: boolean }) {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState('');

    useEffect(() => {
        if (!user?.organizationId) { setLoading(false); return; }
        const q = query(collection(db, 'formTemplates'), where('organizationId', '==', user.organizationId), where('isDeleted', '!=', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormTemplate)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const selectedTemplateName = templates.find(t => t.id === selectedValue)?.name || "Selecione um modelo...";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full max-w-sm justify-between" disabled={disabled}>
                    {selectedTemplateName}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full max-w-sm p-0">
                <Command>
                    <CommandInput placeholder="Buscar modelo..." />
                    <CommandList>
                        {loading && <div className="p-4 text-center text-sm">Carregando...</div>}
                        <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                        <CommandGroup>
                            {templates.map((template) => (
                                <CommandItem key={template.id} value={template.name} onSelect={() => {
                                    setSelectedValue(template.id);
                                    onSelect(template);
                                    setOpen(false);
                                }}>
                                    <Check className={cn("mr-2 h-4 w-4", selectedValue === template.id ? "opacity-100" : "opacity-0")} />
                                    {template.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function DynamicForm({ template, form }: { template: FormTemplate, form: any }) {
    const { register, control, setValue } = form;
    return (
        <div className="space-y-4">
            {template.fields.sort((a, b) => a.order - b.order).map(field => {
                const fieldId = `field_${field.id}`;
                return (
                    <div key={field.id}>
                        <Label htmlFor={fieldId}>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                        {(() => {
                            switch (field.type) {
                                case 'textarea':
                                    return <Textarea id={fieldId} {...register(field.id, { required: field.required })} placeholder={field.placeholder} />;
                                case 'select':
                                    return (
                                        <Select onValueChange={(value) => setValue(field.id, value)} >
                                            <SelectTrigger id={fieldId}><SelectValue placeholder={field.placeholder} /></SelectTrigger>
                                            <SelectContent>
                                                {field.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    );
                                case 'radio':
                                    return (
                                        <RadioGroup onValueChange={(value) => setValue(field.id, value)} className="mt-2">
                                            {field.options?.map(opt => (
                                                <div key={opt} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={opt} id={`${fieldId}-${opt}`} />
                                                    <Label htmlFor={`${fieldId}-${opt}`}>{opt}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    );
                                case 'checkbox':
                                    return (
                                        <div className="flex items-center space-x-2 pt-2">
                                            <Checkbox id={fieldId} onCheckedChange={(checked) => setValue(field.id, !!checked)} />
                                            <Label htmlFor={fieldId} className="font-normal">Confirmar</Label>
                                        </div>
                                    );
                                default: // text, number, date
                                    return <Input id={fieldId} type={field.type} {...register(field.id, { required: field.required })} placeholder={field.placeholder} />;
                            }
                        })()}
                    </div>
                );
            })}
        </div>
    );
}

function NewAttendancePageContent() {
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const form = useForm();
    const { handleSubmit, formState: { isSubmitting } } = form;
    
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
    const [isCustomerLoading, setIsCustomerLoading] = useState(true);

    useEffect(() => {
        const customerId = searchParams.get('customerId');
        if (customerId) {
            const fetchCustomer = async () => {
                const customerDoc = await getDoc(doc(db, 'customers', customerId));
                if (customerDoc.exists()) {
                    setSelectedCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
                } else {
                    toast({ title: "Erro", description: "Cliente não encontrado.", variant: "destructive" });
                }
                setIsCustomerLoading(false);
            };
            fetchCustomer();
        } else {
            setIsCustomerLoading(false);
        }
    }, [searchParams, toast]);

    const onSubmit = async (data: any) => {
        if (!user || !currentBranch || !selectedCustomer || !selectedTemplate) {
            toast({ title: "Erro", description: "Informações essenciais faltando (usuário, filial, cliente ou modelo).", variant: "destructive" });
            return;
        }

        const record: Omit<ClinicalRecord, 'id'> = {
            organizationId: user.organizationId,
            branchId: currentBranch.id,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            professionalId: user.id,
            professionalName: user.name,
            templateId: selectedTemplate.id,
            templateName: selectedTemplate.name,
            date: serverTimestamp(),
            status: 'completed',
            answers: data,
            isDeleted: false,
        };

        try {
            await addDoc(collection(db, 'clinicalRecords'), record);
            toast({ title: "Sucesso!", description: "Ficha de atendimento salva com sucesso." });
            router.push('/dashboard/attendances');
        } catch (error) {
            console.error("Error saving clinical record: ", error);
            toast({ title: "Erro ao Salvar", description: "Não foi possível salvar a ficha de atendimento.", variant: "destructive" });
        }
    };

    if (isCustomerLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Novo Atendimento</CardTitle>
                <CardDescription>Siga os passos para criar uma nova ficha de atendimento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Passo 1: Selecione o Cliente</h3>
                        <CustomerSelector onSelect={setSelectedCustomer} value={selectedCustomer} disabled={!!searchParams.get('customerId')} />
                    </div>

                    {selectedCustomer && (
                        <div className="space-y-4 mt-8">
                            <h3 className="text-lg font-semibold">Passo 2: Selecione o Modelo da Ficha</h3>
                            <FormTemplateSelector onSelect={setSelectedTemplate} disabled={false} />
                        </div>
                    )}

                    {selectedTemplate && (
                        <div className="space-y-4 mt-8">
                            <h3 className="text-lg font-semibold">Passo 3: Preencher Ficha para <span className="text-primary">{selectedCustomer?.name}</span></h3>
                            <DynamicForm template={selectedTemplate} form={form} />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-8">
                        <Button variant="ghost" type="button" onClick={() => router.back()} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!selectedTemplate || isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Atendimento
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

export default function NewAttendancePage() {
    return (
        <React.Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>}>
            <NewAttendancePageContent />
        </React.Suspense>
    );
}
