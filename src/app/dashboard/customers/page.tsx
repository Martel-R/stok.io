
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, writeBatch, getDocs, orderBy } from 'firebase/firestore';
import type { Customer, AnamnesisQuestion, AnamnesisAnswer } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

function CustomerForm({ 
    customer, 
    anamnesisQuestions, 
    onSave, 
    onDone 
}: { 
    customer?: Customer; 
    anamnesisQuestions: AnamnesisQuestion[];
    onSave: (data: Partial<Customer>) => void; 
    onDone: () => void 
}) {
    const [formData, setFormData] = useState<Partial<Customer>>({});
    
    useEffect(() => {
        const initialData: Partial<Customer> = customer || { 
            name: '', cpfCnpj: '', email: '', phone: '', address: '', isActive: true, 
            anamnesisAnswers: [] 
        };

        const existingAnswers = new Map(initialData.anamnesisAnswers?.map(a => [a.questionId, a]));
        
        const fullAnswers = anamnesisQuestions.map(q => {
            if (existingAnswers.has(q.id)) {
                return existingAnswers.get(q.id)!;
            }

            let defaultAnswer: any;
            switch(q.type) {
                case 'boolean':
                    defaultAnswer = null; // Use null for 'not answered'
                    break;
                case 'boolean_with_text':
                    defaultAnswer = { choice: null, details: ''}; // Use null for 'not answered'
                    break;
                case 'integer':
                case 'decimal':
                    defaultAnswer = null; 
                    break;
                case 'text':
                default:
                    defaultAnswer = '';
                    break;
            }
            return {
                questionId: q.id,
                questionLabel: q.label,
                answer: defaultAnswer
            };
        });

        setFormData({ ...initialData, anamnesisAnswers: fullAnswers as AnamnesisAnswer[] });
    }, [customer, anamnesisQuestions]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAnamnesisChange = (questionId: string, value: any) => {
        setFormData(prev => {
            const newAnswers = prev.anamnesisAnswers?.map(a => 
                a.questionId === questionId ? { ...a, answer: value } : a
            ) || [];
            return { ...prev, anamnesisAnswers: newAnswers };
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onDone();
    };
    
    const renderAnswerInput = (question: AnamnesisQuestion) => {
        const answer = formData.anamnesisAnswers?.find(a => a.questionId === question.id);
        if (!answer) return null;

        switch(question.type) {
            case 'text':
                return (
                    <Textarea 
                        value={answer.answer || ''}
                        onChange={(e) => handleAnamnesisChange(question.id, e.target.value)}
                    />
                );
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
                return (
                    <div className="space-y-2">
                        <RadioGroup
                            value={answer.answer?.choice === true ? 'sim' : answer.answer?.choice === false ? 'nao' : ''}
                            onValueChange={(val) => handleAnamnesisChange(question.id, { ...answer.answer, choice: val === 'sim' })}
                            className="flex space-x-4"
                        >
                            <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id={`${question.id}-sim-wt`} /><Label htmlFor={`${question.id}-sim-wt`}>Sim</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id={`${question.id}-nao-wt`} /><Label htmlFor={`${question.id}-nao-wt`}>Não</Label></div>
                        </RadioGroup>
                        {answer.answer?.choice === true && (
                            <Textarea 
                                value={answer.answer.details || ''}
                                onChange={(e) => handleAnamnesisChange(question.id, { ...answer.answer, details: e.target.value })}
                                placeholder="Se sim, especifique..."
                            />
                        )}
                    </div>
                );
            case 'integer':
            case 'decimal':
                return (
                    <Input 
                        type="number"
                        step={question.type === 'decimal' ? '0.01' : '1'}
                        value={answer.answer === null || answer.answer === undefined ? '' : answer.answer}
                        onChange={(e) => handleAnamnesisChange(question.id, e.target.value === '' ? null : (question.type === 'decimal' ? parseFloat(e.target.value) : parseInt(e.target.value, 10)))}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Tabs defaultValue="general">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="general">Dados Gerais</TabsTrigger>
                    <TabsTrigger value="anamnesis" disabled={anamnesisQuestions.length === 0}>Anamnese</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="name">Nome Completo</Label>
                            <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                            <Input id="cpfCnpj" name="cpfCnpj" value={formData.cpfCnpj || ''} onChange={handleChange} required />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} required />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="address">Endereço Completo</Label>
                        <Input id="address" name="address" value={formData.address || ''} onChange={handleChange} required />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch 
                          id="isActive" 
                          checked={formData.isActive} 
                          onCheckedChange={(checked) => setFormData(prev => ({...prev, isActive: checked}))}
                        />
                        <Label htmlFor="isActive">Cliente Ativo</Label>
                     </div>
                </TabsContent>
                <TabsContent value="anamnesis" className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                   {anamnesisQuestions.map(question => (
                        <div key={question.id} className="space-y-2 border-b pb-4">
                            <Label>{question.label}</Label>
                            {renderAnswerInput(question)}
                        </div>
                   ))}
                </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4">
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Cliente</Button>
            </DialogFooter>
        </form>
    );
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [anamnesisQuestions, setAnamnesisQuestions] = useState<AnamnesisQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();
    const { user, createUser } = useAuth();
    
    const can = useMemo(() => ({
        edit: user?.enabledModules?.customers?.edit ?? false,
        delete: user?.enabledModules?.customers?.delete ?? false,
    }), [user]);

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        const customersQuery = query(collection(db, 'customers'), where("organizationId", "==", user.organizationId));
        const customersUnsub = onSnapshot(customersQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
            setCustomers(data.sort((a,b) => a.name.localeCompare(b.name)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching customers:", error);
            toast({title: "Erro ao buscar clientes", variant: "destructive"});
            setLoading(false);
        });

        const questionsQuery = query(collection(db, 'anamnesisQuestions'), where("organizationId", "==", user.organizationId));
        const questionsUnsub = onSnapshot(questionsQuery, (snapshot) => {
             const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnamnesisQuestion));
             data.sort((a,b) => (a.order || 0) - (b.order || 0));
             setAnamnesisQuestions(data);
        }, (error) => {
            console.error("Error fetching anamnesis questions:", error);
        });


        return () => {
            customersUnsub();
            questionsUnsub();
        }
    }, [user, toast]);

    const filteredCustomers = useMemo(() => {
        if (!searchQuery) return customers;
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
            c.cpfCnpj.includes(searchQuery)
        );
    }, [customers, searchQuery]);

    const handleSave = async (data: Partial<Customer>) => {
        if (!user?.organizationId) {
            toast({ title: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        
        try {
            if (editingCustomer?.id) {
                await updateDoc(doc(db, "customers", editingCustomer.id), data);
                toast({ title: 'Cliente atualizado com sucesso!' });
            } else {
                 // Check if user account with this email already exists
                const usersRef = collection(db, 'users');
                const userQuery = query(usersRef, where("email", "==", data.email));
                const userSnapshot = await getDocs(userQuery);

                const batch = writeBatch(db);
                const customerRef = doc(collection(db, 'customers'));

                if(userSnapshot.empty) {
                     // No user account, create one
                    const { success, error, userId } = await createUser(data.email!, data.name!, 'customer', user.organizationId, customerRef.id);
                    if (!success) {
                        toast({ title: "Erro ao criar conta de acesso", description: error, variant: "destructive" });
                        return; // Stop if user creation fails
                    }
                    batch.set(customerRef, { ...data, organizationId: user.organizationId, userId: userId });
                    toast({ title: 'Cliente adicionado!', description: 'Uma conta de acesso foi criada com uma senha temporária.' });

                } else {
                     // User account exists, just link it
                    const existingUser = userSnapshot.docs[0];
                    batch.set(customerRef, { ...data, organizationId: user.organizationId, userId: existingUser.id });
                    batch.update(existingUser.ref, { customerId: customerRef.id });
                    toast({ title: 'Cliente adicionado!', description: 'Conta de acesso existente foi vinculada.' });
                }

                await batch.commit();
            }
             setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving customer: ", error);
            toast({ title: 'Erro ao salvar cliente', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            // This is a soft delete, we just inactivate the customer
            await updateDoc(doc(db, "customers", id), { isActive: false });
            toast({ title: 'Cliente inativado com sucesso!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao inativar cliente', variant: 'destructive' });
        }
    };
    
    const openEditDialog = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsFormOpen(true);
    };

    const openNewDialog = () => {
        setEditingCustomer(undefined);
        setIsFormOpen(true);
    };

    if (!user?.enabledModules?.customers?.view) {
        return (
            <Card className="m-auto">
                <CardHeader>
                    <CardTitle>Módulo Desabilitado</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>O módulo de clientes não está ativo para a sua organização ou você não tem permissão para visualizá-lo.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Users className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">Clientes</h1>
                        <p className="text-muted-foreground">
                            Gerencie seus clientes e o acesso deles ao sistema.
                        </p>
                    </div>
                </div>
                {can.edit && (
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" />Adicionar Cliente</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
                            </DialogHeader>
                            <CustomerForm
                                customer={editingCustomer}
                                anamnesisQuestions={anamnesisQuestions}
                                onSave={handleSave}
                                onDone={() => setIsFormOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                )}
            </div>
            
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por nome, email ou CPF/CNPJ..."
                    className="w-full rounded-lg bg-background pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>


            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                            <TableRow key={customer.id}>
                                <TableCell className="font-medium">{customer.name}</TableCell>
                                <TableCell>{customer.email}</TableCell>
                                <TableCell>{customer.phone}</TableCell>
                                <TableCell>
                                    <Badge variant={customer.isActive ? 'secondary' : 'outline'}>
                                        {customer.isActive ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {can.edit && <DropdownMenuItem onClick={() => openEditDialog(customer)}>Editar</DropdownMenuItem>}
                                            {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(customer.id)}>Inativar</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                Nenhum cliente encontrado.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
