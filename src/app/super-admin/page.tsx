

// src/app/super-admin/page.tsx
'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where, getDocs, deleteDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Organization, User, PaymentStatus, EnabledModules, PermissionProfile, Subscription, PaymentRecord, PaymentRecordStatus, PricingPlan } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Loader2, ShieldAlert, Trash2, SlidersHorizontal, Users, PlusCircle, Pencil, DollarSign, Calendar as CalendarIcon, Edit, CheckCircle, LogIn, Tags, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PermissionProfileForm } from '@/components/permission-profile-form';
import { format, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { allModuleConfig } from '@/components/module-permission-row';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OrgWithUser = Organization & { owner?: User };

// Helper to safely convert a Firestore Timestamp or a JS Date to a JS Date
const toDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date instanceof Timestamp) return date.toDate();
    return undefined;
};

function UserForm({ user, profiles, onSave, onDone }: { user?: User; profiles: PermissionProfile[]; onSave: (user: Partial<User>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { name: '', email: '', role: '', avatar: 'https://placehold.co/100x100.png?text=👤', isDeleted: false }
    );

    useEffect(() => {
        if (!user && profiles.length > 0) {
            setFormData(prev => ({ ...prev, role: profiles[0].id }));
        }
        if (user) {
             setFormData(user);
        }
    }, [user, profiles]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleRoleChange = (roleId: string) => {
        setFormData(prev => ({...prev, role: roleId}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as User);
        onDone();
    };
    
    const isEditing = !!user;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Label htmlFor="name">Nome do Usuário</Label>
                <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required disabled={isEditing}/>
            </div>
            <div>
                <Label htmlFor="role">Perfil</Label>
                 <Select value={formData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger id="role">
                        <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                        {profiles.map(profile => (
                            <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                 <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                 <Button type="submit">Salvar Usuário</Button>
            </DialogFooter>
        </form>
    );
}

function PlanForm({ plan, onSave, onDone }: { plan?: PricingPlan, onSave: (data: Partial<PricingPlan>) => void, onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<PricingPlan>>(plan || { name: '', price: 0, description: '', features: [], maxBranches: 1, maxUsers: 1, isFeatured: false, isDeleted: false });
    const [featureInput, setFeatureInput] = useState('');

    const handleFeatureAdd = () => {
        if(featureInput.trim()) {
            setFormData(prev => ({...prev, features: [...(prev.features || []), featureInput.trim()]}));
            setFeatureInput('');
        }
    }

    const handleFeatureRemove = (index: number) => {
        setFormData(prev => ({...prev, features: prev.features?.filter((_, i) => i !== index)}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Input name="name" value={formData.name || ''} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="Nome do Plano" required />
                <Input name="price" type="number" step="0.01" value={formData.price || ''} onChange={e => setFormData(p => ({...p, price: parseFloat(e.target.value) || 0}))} placeholder="Preço (ex: 99.90)" required />
            </div>
            <Textarea name="description" value={formData.description || ''} onChange={e => setFormData(p => ({...p, description: e.target.value}))} placeholder="Descrição do Plano" required />
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Máx. Filiais</Label>
                    <Input name="maxBranches" type="number" value={formData.maxBranches || ''} onChange={e => setFormData(p => ({...p, maxBranches: parseInt(e.target.value, 10) || 1}))} required />
                </div>
                <div className="space-y-2">
                    <Label>Máx. Usuários</Label>
                    <Input name="maxUsers" type="number" value={formData.maxUsers || ''} onChange={e => setFormData(p => ({...p, maxUsers: parseInt(e.target.value, 10) || 1}))} required />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Funcionalidades</Label>
                <div className="flex gap-2">
                    <Input value={featureInput} onChange={e => setFeatureInput(e.target.value)} placeholder="Adicionar funcionalidade"/>
                    <Button type="button" onClick={handleFeatureAdd}>Adicionar</Button>
                </div>
                <div className="space-y-1">
                    {formData.features?.map((feat, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                            <span>- {feat}</span>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleFeatureRemove(i)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        </div>
                    ))}
                </div>
            </div>
             <div className="flex items-center space-x-2">
                <Switch id="isFeatured" checked={formData.isFeatured} onCheckedChange={c => setFormData(p => ({...p, isFeatured: c}))} />
                <Label htmlFor="isFeatured">Marcar como plano em destaque?</Label>
            </div>
             <div className="flex items-center space-x-2">
                <Switch id="isActive" checked={!formData.isDeleted} onCheckedChange={c => setFormData(p => ({...p, isDeleted: !c}))} />
                <Label htmlFor="isActive">Plano Ativo (visível na página de preços)</Label>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Plano</Button>
            </DialogFooter>
        </form>
    );
}

function PricingPlansSettings() {
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<PricingPlan | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        const q = query(collection(db, 'pricingPlans'));
        const unsub = onSnapshot(q, snap => {
            setPlans(snap.docs.map(d => ({id: d.id, ...d.data()}) as PricingPlan).sort((a,b) => a.price - b.price));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async (data: Partial<PricingPlan>) => {
        try {
            if(editingPlan?.id) {
                await updateDoc(doc(db, 'pricingPlans', editingPlan.id), data);
                toast({title: 'Plano atualizado!'});
            } else {
                await addDoc(collection(db, 'pricingPlans'), {...data, isDeleted: data.isDeleted === undefined ? false : data.isDeleted });
                toast({title: 'Plano criado!'});
            }
            setIsFormOpen(false);
        } catch(error) {
            toast({title: 'Erro ao salvar o plano', variant: 'destructive'});
        }
    }
    
    const togglePlanStatus = async (plan: PricingPlan) => {
        await updateDoc(doc(db, 'pricingPlans', plan.id), { isDeleted: !plan.isDeleted });
        toast({title: `Plano ${!plan.isDeleted ? 'desativado' : 'ativado'} com sucesso.`});
    }

    return (
        <Card>
            <CardHeader>
                 <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Planos de Preços</CardTitle>
                        <CardDescription>Gerencie os planos de assinatura que serão exibidos publicamente.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingPlan(undefined); setIsFormOpen(true)}}>
                        <PlusCircle className="mr-2"/> Adicionar Plano
                    </Button>
                 </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Limites</TableHead>
                            <TableHead>Destaque</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-5 w-full"/></TableCell></TableRow> :
                        plans.map(plan => (
                            <TableRow key={plan.id}>
                                <TableCell className="font-semibold">{plan.name}</TableCell>
                                <TableCell>R$ {plan.price.toLocaleString('pt-br', {minimumFractionDigits: 2})}</TableCell>
                                <TableCell>
                                    <div className='text-sm'>
                                        <p>{plan.maxBranches} Filiais</p>
                                        <p>{plan.maxUsers} Usuários</p>
                                    </div>
                                </TableCell>
                                <TableCell>{plan.isFeatured ? <Badge>Sim</Badge> : 'Não'}</TableCell>
                                <TableCell>
                                    <Badge variant={!plan.isDeleted ? "secondary" : "outline"} className={cn(!plan.isDeleted && 'bg-green-100 text-green-800')}>
                                        {!plan.isDeleted ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Switch checked={!plan.isDeleted} onCheckedChange={() => togglePlanStatus(plan)} aria-label="Ativar/Desativar Plano" />
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingPlan(plan); setIsFormOpen(true);}}>
                                        <Pencil className="h-4 w-4"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle></DialogHeader>
                    <PlanForm plan={editingPlan} onSave={handleSave} onDone={() => setIsFormOpen(false)} />
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function SubscriptionDialog({ organization, isOpen, onOpenChange, adminUser }: { organization: Organization, isOpen: boolean, onOpenChange: (open: boolean) => void, adminUser: User | null }) {
    const { toast } = useToast();
    const [subDetails, setSubDetails] = useState<Partial<Subscription>>(organization.subscription || {});
    const [editingRecord, setEditingRecord] = useState<PaymentRecord | null>(null);
    const [payingRecord, setPayingRecord] = useState<PaymentRecord | null>(null);
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    
    useEffect(() => {
        const q = query(collection(db, 'pricingPlans'), where('isDeleted', '!=', true));
        const unsub = onSnapshot(q, snap => {
            setPlans(snap.docs.map(d => ({id: d.id, ...d.data()}) as PricingPlan));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        setSubDetails(organization.subscription || {});
    }, [organization.subscription]);
    
    const handlePlanChange = (planId: string) => {
        const selectedPlan = plans.find(p => p.id === planId);
        if (selectedPlan) {
            setSubDetails(prev => ({
                ...prev,
                planId: selectedPlan.id,
                planName: selectedPlan.name,
                price: selectedPlan.price,
                maxBranches: selectedPlan.maxBranches,
                maxUsers: selectedPlan.maxUsers,
            }));
        }
    };

    const handleCreateOrUpdateSubscription = async () => {
        if (!adminUser || !subDetails.planName || !subDetails.price) {
            toast({title: 'Dados incompletos', description: 'Plano e preço são obrigatórios.', variant: 'destructive'});
            return;
        };

        const startDate = toDate(subDetails.startDate);
        const endDate = toDate(subDetails.endDate);

        const paymentRecords = (subDetails.paymentRecords || []);
        if (startDate && endDate) {
             const months = eachMonthOfInterval({ start: startDate, end: endDate });
             months.forEach((monthDate) => {
                const alreadyExists = paymentRecords.some(p => {
                    const pDate = toDate(p.date);
                    return pDate && pDate.getMonth() === monthDate.getMonth() && pDate.getFullYear() === monthDate.getFullYear();
                });
                if (!alreadyExists) {
                    paymentRecords.push({
                        id: doc(collection(db, 'dummy')).id, // Temporary unique ID
                        date: Timestamp.fromDate(startOfMonth(monthDate)),
                        amount: subDetails.price || 0,
                        status: 'pending',
                    });
                }
            });
        }

        const newSubscriptionData: Subscription = {
            ...subDetails,
            planName: subDetails.planName,
            price: subDetails.price,
            startDate: subDetails.startDate || null,
            endDate: subDetails.endDate || null,
            maxBranches: subDetails.maxBranches || 1,
            maxUsers: subDetails.maxUsers || 1,
            paymentRecords,
        };
        try {
            await updateDoc(doc(db, 'organizations', organization.id), {
                subscription: newSubscriptionData
            });
            toast({ title: 'Assinatura salva e parcelas geradas com sucesso!' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao salvar assinatura', variant: 'destructive' });
        }
    }
    
    const handleRegisterPayment = async (updatedRecord: PaymentRecord) => {
        if (!organization.subscription || !adminUser) return;
    
        const updatedRecords = organization.subscription.paymentRecords.map(record => {
            if (record.id === updatedRecord.id) {
                return { 
                    ...updatedRecord, 
                    status: 'paid' as PaymentRecordStatus, 
                    recordedBy: adminUser.id,
                    paidDate: new Date(),
                };
            }
            return record;
        });

        try {
            await updateDoc(doc(db, 'organizations', organization.id), {
                'subscription.paymentRecords': updatedRecords
            });
            toast({ title: 'Pagamento registrado com sucesso!' });
            setPayingRecord(null);
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao registrar pagamento', variant: 'destructive' });
        }
    };

    const handleSaveRecord = async (recordToSave: PaymentRecord) => {
        if (!organization.subscription) return;

        let updatedRecords;
        const existingRecordIndex = organization.subscription.paymentRecords.findIndex(r => r.id === recordToSave.id);

        if (existingRecordIndex > -1) {
            updatedRecords = [...organization.subscription.paymentRecords];
            updatedRecords[existingRecordIndex] = recordToSave;
            toast({ title: 'Parcela atualizada!' });
        } else {
            updatedRecords = [...(organization.subscription.paymentRecords || []), recordToSave];
            toast({ title: 'Nova parcela criada!' });
        }

         try {
            await updateDoc(doc(db, 'organizations', organization.id), { 'subscription.paymentRecords': updatedRecords });
            setEditingRecord(null);
        } catch (error) {
            toast({ title: 'Erro ao salvar parcela', variant: 'destructive' });
        }
    };
    
    const handleDeleteRecord = async (recordId: string) => {
        if (!organization.subscription) return;
        const updatedRecords = organization.subscription.paymentRecords.filter(r => r.id !== recordId);
        try {
            await updateDoc(doc(db, 'organizations', organization.id), { 'subscription.paymentRecords': updatedRecords });
            toast({ title: 'Parcela excluída!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir parcela', variant: 'destructive' });
        }
    };

    const openNewRecordForm = () => {
        setEditingRecord({
            id: doc(collection(db, 'dummy')).id,
            date: Timestamp.now(),
            amount: subDetails.price || 0,
            status: 'pending'
        });
    };
    
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Gerenciar Assinatura: {organization.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold">Detalhes do Contrato</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="planName">Plano</Label>
                                <Select value={subDetails.planId} onValueChange={handlePlanChange}>
                                    <SelectTrigger><SelectValue placeholder="Selecione um plano..." /></SelectTrigger>
                                    <SelectContent>
                                        {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (R$ {p.price.toFixed(2)})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Data de Início</Label>
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{subDetails.startDate ? format(toDate(subDetails.startDate)!, 'dd/MM/yyyy') : 'Escolha uma data'}</Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(subDetails.startDate)} onSelect={d => setSubDetails(p => ({...p, startDate: d}))} /></PopoverContent>
                                </Popover>
                             </div>
                             <div className="space-y-2">
                                <Label>Data de Fim</Label>
                                 <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{subDetails.endDate ? format(toDate(subDetails.endDate)!, 'dd/MM/yyyy') : 'Escolha uma data'}</Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(subDetails.endDate)} onSelect={d => setSubDetails(p => ({...p, endDate: d}))} /></PopoverContent>
                                </Popover>
                             </div>
                         </div>
                         <Button onClick={handleCreateOrUpdateSubscription}>Salvar Contrato e Gerar Parcelas</Button>
                    </div>

                     <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Histórico de Parcelas</h3>
                            <Button variant="outline" size="sm" onClick={openNewRecordForm}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Criar Parcela
                            </Button>
                        </div>
                        <div className="max-h-96 overflow-y-auto mt-2 pr-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Data Pag.</TableHead>
                                        <TableHead>Valor Pago</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subDetails.paymentRecords && subDetails.paymentRecords.length > 0 ? (
                                        subDetails.paymentRecords.sort((a,b) => toDate(a.date)!.getTime() - toDate(b.date)!.getTime()).map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell>{p.date ? format(toDate(p.date)!, 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                                <TableCell>R$ {p.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell>{p.paidDate ? format(toDate(p.paidDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                                <TableCell>{p.paidAmount ? `R$ ${p.paidAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`: '-'}</TableCell>
                                                <TableCell>
                                                     <Badge className={cn(p.status === 'paid' && 'bg-green-100 text-green-800')} variant={p.status === 'paid' ? 'secondary' : 'destructive'}>
                                                        {p.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal/></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                {p.status === 'pending' && <DropdownMenuItem onSelect={() => setPayingRecord(p)}>Registrar Pagamento</DropdownMenuItem>}
                                                                <DropdownMenuItem onSelect={() => setEditingRecord(p)}>Editar</DropdownMenuItem>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Excluir Parcela?</AlertDialogTitle>
                                                                <AlertDialogDescription>Deseja realmente excluir a parcela com vencimento em {p.date ? format(toDate(p.date)!, 'dd/MM/yyyy') : 'N/A'}?</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteRecord(p.id)} className={buttonVariants({ variant: "destructive" })}>Sim, Excluir</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center">Nenhuma parcela gerada.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                     </div>
                </div>

                {editingRecord && (
                    <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Editar Parcela</DialogTitle></DialogHeader>
                            <EditRecordForm record={editingRecord} onSave={handleSaveRecord} onCancel={() => setEditingRecord(null)} />
                        </DialogContent>
                    </Dialog>
                )}

                <RegisterPaymentDialog 
                    record={payingRecord}
                    isOpen={!!payingRecord}
                    onOpenChange={(open) => !open && setPayingRecord(null)}
                    onSave={handleRegisterPayment}
                />
            </DialogContent>
        </Dialog>
    )
}

function EditRecordForm({record, onSave, onCancel}: {record: PaymentRecord, onSave: (r: PaymentRecord) => void, onCancel: () => void}) {
    const [formData, setFormData] = useState(record);

    useEffect(() => {
        setFormData(record);
    }, [record]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Popover>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{formData.date ? format(toDate(formData.date)!, 'dd/MM/yyyy') : 'Escolha uma data'}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(formData.date)} onSelect={d => setFormData(p => ({...p, date: d ? Timestamp.fromDate(d) : p.date}))} /></PopoverContent>
                </Popover>
            </div>
             <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: parseFloat(e.target.value) || 0}))} />
            </div>
             <DialogFooter>
                 <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                 <Button type="submit">Salvar</Button>
            </DialogFooter>
        </form>
    );
}

function RegisterPaymentDialog({
    record, isOpen, onOpenChange, onSave
}: {
    record: PaymentRecord | null,
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    onSave: (record: PaymentRecord) => void,
}) {
    const [formData, setFormData] = useState<Partial<PaymentRecord>>({});

    useEffect(() => {
        if (record) {
            setFormData({
                ...record,
                paidDate: new Date(),
                paidAmount: record.amount,
                paymentMethod: '',
                notes: '',
            });
        }
    }, [record]);

    if (!isOpen || !record) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as PaymentRecord);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Pagamento de Parcela</DialogTitle>
                     <DialogDescription>
                        Vencimento em {format(toDate(record.date)!, 'dd/MM/yyyy')} no valor de R$ {record.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Data do Pagamento</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{formData.paidDate ? format(toDate(formData.paidDate)!, 'dd/MM/yyyy') : 'Selecione'}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={toDate(formData.paidDate)} onSelect={(d) => setFormData(p => ({...p, paidDate: d}))} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Valor Pago (R$)</Label>
                            <Input type="number" value={formData.paidAmount || ''} onChange={e => setFormData(p => ({...p, paidAmount: parseFloat(e.target.value) || 0}))}/>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label>Forma de Pagamento</Label>
                        <Input value={formData.paymentMethod || ''} onChange={e => setFormData(p => ({...p, paymentMethod: e.target.value}))} placeholder="Ex: PIX, Boleto, Cartão..."/>
                     </div>
                     <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea value={formData.notes || ''} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} />
                     </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Confirmar Pagamento</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}



function ModulesSettingsDialog({ organization, isOpen, onOpenChange }: { organization: Organization, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [enabledModules, setEnabledModules] = useState<EnabledModules>(organization.enabledModules);

    useEffect(() => {
        if (organization.enabledModules) {
            setEnabledModules(organization.enabledModules);
        }
    }, [organization]);

    const handleModuleToggle = async (module: keyof EnabledModules, checked: boolean) => {
        const newPermissions = checked ? { view: true, edit: true, delete: true } : { view: false, edit: false, delete: false };
        const updatedModules = { ...enabledModules, [module]: newPermissions };
        
        setEnabledModules(updatedModules);

        try {
            const orgRef = doc(db, 'organizations', organization.id);
            await updateDoc(orgRef, { enabledModules: updatedModules });
            toast({ title: 'Módulo atualizado com sucesso!' });
        } catch (error) {
            toast({ title: 'Erro ao atualizar módulo', variant: 'destructive' });
            setEnabledModules(prev => {
                const reverted = {...prev};
                delete reverted[module];
                return reverted;
            });
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Módulos</DialogTitle>
                    <DialogDescription>Habilite ou desabilite funcionalidades para a organização "{organization.name}".</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     {allModuleConfig.map(mod => (
                        <div key={mod.key} className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <Label htmlFor={`module-${mod.key}`} className="text-base">{mod.label}</Label>
                            <Switch
                                id={`module-${mod.key}`}
                                checked={!!enabledModules[mod.key]}
                                onCheckedChange={(checked) => handleModuleToggle(mod.key, checked)}
                            />
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function OrgUsersDialog({ organization, isOpen, onOpenChange }: { organization: OrgWithUser | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const { createUser, resetUserPassword, forceSetUserPassword } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const [passwordUser, setPasswordUser] = useState<User | undefined>(undefined);

    useEffect(() => {
        if (!isOpen || !organization) return;
        setLoading(true);
        const qUsers = query(collection(db, 'users'), where('organizationId', '==', organization.id));
        const qProfiles = query(collection(db, 'permissionProfiles'), where('organizationId', '==', organization.id));
        
        const unsubUsers = onSnapshot(qUsers, (snapshot) => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
            setLoading(false);
        });
        const unsubProfiles = onSnapshot(qProfiles, (snapshot) => {
             setProfiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionProfile)));
        });

        return () => { unsubUsers(); unsubProfiles(); }
    }, [isOpen, organization]);

    const getProfileName = (roleId: string) => profiles.find(p => p.id === roleId)?.name || 'N/A';
    
    const handleSaveUser = async (userToSave: Partial<User>) => {
        if (!organization) return;
        if (editingUser?.id) {
            await updateDoc(doc(db, "users", editingUser.id), { role: userToSave.role, name: userToSave.name });
            toast({ title: 'Usuário atualizado!' });
        } else {
            const { success, error } = await createUser(userToSave.email!, userToSave.name!, userToSave.role!, organization.id);
            if (success) toast({ title: 'Usuário criado!' });
            else toast({ title: 'Erro ao criar', description: error, variant: 'destructive' });
        }
        setIsFormOpen(false);
    };

    const handleResetPassword = async (email: string) => {
        const { success, error } = await resetUserPassword(email);
        if (success) {
            toast({ title: 'E-mail de redefinição enviado!' });
        } else {
            toast({ title: 'Erro ao redefinir senha', description: error, variant: 'destructive' });
        }
    };
    
    const handleSetPassword = async (userId: string, newPass: string) => {
        const { success, error } = await forceSetUserPassword(userId, newPass);
        if (success) {
            toast({ title: 'Senha do usuário alterada com sucesso!' });
            setPasswordUser(undefined);
        } else {
            toast({ title: 'Erro ao alterar senha', description: error, variant: 'destructive' });
        }
    };


    if (!isOpen || !organization) return null;

    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                 <DialogHeader>
                    <DialogTitle>Gerenciar Usuários de "{organization.name}"</DialogTitle>
                </DialogHeader>
                 <div className="py-4">
                     <div className="flex justify-end mb-4">
                        <Button onClick={() => { setEditingUser(undefined); setIsFormOpen(true); }}><PlusCircle className="mr-2" /> Adicionar</Button>
                    </div>
                     <Table>
                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Perfil</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                             users.map(u => (
                                <TableRow key={u.id}>
                                    <TableCell>{u.name}</TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell><Badge variant="secondary">{getProfileName(u.role)}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => { setEditingUser(u); setIsFormOpen(true); }}>Editar</DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleResetPassword(u.email)}>Redefinir Senha (E-mail)</DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setPasswordUser(u)}>Forçar Nova Senha</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                             ))
                            }
                        </TableBody>
                    </Table>
                 </div>
                 {isFormOpen && (
                     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                         <DialogContent>
                             <DialogHeader><DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle></DialogHeader>
                             <UserForm user={editingUser} profiles={profiles} onSave={handleSaveUser} onDone={() => setIsFormOpen(false)} />
                         </DialogContent>
                     </Dialog>
                 )}
                 {passwordUser && (
                    <SetPasswordDialog 
                        user={passwordUser}
                        onSave={handleSetPassword}
                        onDone={() => setPasswordUser(undefined)}
                    />
                 )}
            </DialogContent>
        </Dialog>
    )
}

function SetPasswordDialog({ user, onSave, onDone }: { user: User, onSave: (userId: string, newPass: string) => void, onDone: () => void}) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            toast({title: 'Senha muito curta', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive'});
            return;
        }
        if (password !== confirm) {
            toast({title: 'Senhas não coincidem', variant: 'destructive'});
            return;
        }
        onSave(user.id, password);
    }
    
    return (
        <Dialog open={true} onOpenChange={onDone}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Forçar Nova Senha para {user.name}</DialogTitle>
                </DialogHeader>
                 <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                     <div className="space-y-2">
                        <Label htmlFor="new-password">Nova Senha</Label>
                        <Input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                        <Input id="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                    </div>
                     <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                        <Button type="submit">Definir Senha</Button>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    )
}

function OrgProfilesDialog({ organization, isOpen, onOpenChange }: { organization: OrgWithUser | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<PermissionProfile | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        if (!isOpen || !organization) return;
        setLoading(true);
        const q = query(collection(db, 'permissionProfiles'), where('organizationId', '==', organization.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionProfile));
            setProfiles(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [isOpen, organization]);

    const handleSave = async (profileData: Partial<PermissionProfile>) => {
        if (!organization) return;
        try {
            if (editingProfile?.id) {
                await updateDoc(doc(db, 'permissionProfiles', editingProfile.id), profileData);
                toast({ title: 'Perfil atualizado!' });
            } else {
                await addDoc(collection(db, 'permissionProfiles'), { ...profileData, organizationId: organization.id });
                toast({ title: 'Perfil criado!' });
            }
            setIsFormOpen(false);
            setEditingProfile(undefined);
        } catch (error) {
            toast({ title: 'Erro ao salvar perfil', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        await deleteDoc(doc(db, 'permissionProfiles', id));
        toast({ title: 'Perfil excluído!', variant: 'destructive' });
    };

    if (!isOpen || !organization) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Gerenciar Perfis de "{organization.name}"</DialogTitle>
                </DialogHeader>
                 <div className="py-4">
                     <div className="flex justify-end mb-4">
                        <Button onClick={() => { setEditingProfile(undefined); setIsFormOpen(true); }}><PlusCircle className="mr-2" /> Adicionar Perfil</Button>
                    </div>
                     <Table>
                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Permissões</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                             profiles.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(p.permissions).filter(([, perms]) => perms.view).map(([key]) => <Badge key={key} variant="outline">{key}</Badge>)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingProfile(p); setIsFormOpen(true); }}>Editar</Button>
                                    </TableCell>
                                </TableRow>
                             ))
                            }
                        </TableBody>
                    </Table>
                 </div>
                 {isFormOpen && (
                     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                         <DialogContent className="max-w-2xl">
                             <DialogHeader><DialogTitle>{editingProfile ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle></DialogHeader>
                             <PermissionProfileForm profile={editingProfile} organization={organization} onSave={handleSave} onDelete={handleDelete} onDone={() => setIsFormOpen(false)} />
                         </DialogContent>
                     </Dialog>
                 )}
            </DialogContent>
        </Dialog>
    )
}

function SuperAdminPage() {
    const { user, loading: authLoading, startImpersonation, forceSetUserPassword } = useAuth();
    const router = useRouter();
    const [organizations, setOrganizations] = useState<OrgWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrg, setSelectedOrg] = useState<OrgWithUser | null>(null);
    const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
    const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
    const [isProfilesDialogOpen, setIsProfilesDialogOpen] = useState(false);
    const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!authLoading && user && user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL && !user.isImpersonating) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user && user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
            const unsubscribeOrgs = onSnapshot(collection(db, 'organizations'), async (orgSnapshot) => {
                const orgsData = orgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
                const usersSnapshot = await getDocs(query(collection(db, 'users')));
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

                const orgsWithUsers = orgsData.map(org => ({ ...org, owner: usersData.find(u => u.id === org.ownerId) }));
                
                setOrganizations(orgsWithUsers);
                setLoading(false);
            });
            return () => unsubscribeOrgs();
        }
    }, [user]);

    const handleStatusChange = async (orgId: string, status: PaymentStatus) => {
        await updateDoc(doc(db, 'organizations', orgId), { paymentStatus: status });
        toast({ title: 'Status atualizado com sucesso!' });
    };
    
    const handleDeleteOrganization = async (orgId: string) => {
        const collectionsToDelete = ['users', 'branches', 'products', 'combos', 'kits', 'sales', 'stockEntries', 'paymentConditions', 'permissionProfiles', 'anamnesisQuestions', 'customers', 'attendances', 'appointments', 'services'];
        try {
            const batch = writeBatch(db);
            for (const collectionName of collectionsToDelete) {
                const q = query(collection(db, collectionName), where("organizationId", "==", orgId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => batch.delete(doc.ref));
            }
            batch.delete(doc(db, 'organizations', orgId));
            await batch.commit();
            toast({ title: 'Organização e dados vinculados excluídos!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir organização', variant: 'destructive' });
        }
    };

    const getStatusBadge = (status: PaymentStatus) => {
        const variants = { active: "bg-green-100 text-green-800", overdue: "bg-yellow-100 text-yellow-800", locked: "destructive" };
        return <Badge variant={status === 'locked' ? 'destructive' : 'secondary'} className={variants[status]}>{status}</Badge>;
    }
    
    const handleOpenDialog = (org: OrgWithUser, type: 'modules' | 'users' | 'profiles' | 'subscription') => {
        setSelectedOrg(org);
        if (type === 'modules') setIsModuleDialogOpen(true);
        if (type === 'users') setIsUsersDialogOpen(true);
        if (type === 'profiles') setIsProfilesDialogOpen(true);
        if (type === 'subscription') setIsSubscriptionDialogOpen(true);
    };

    if (authLoading || !user || user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-muted p-4 sm:p-6 lg:p-8">
            <Card className="max-w-7xl mx-auto">
                <CardHeader>
                    <div className="flex items-center gap-4">
                       <ShieldAlert className="h-8 w-8 text-destructive" />
                       <div>
                         <CardTitle>Painel Super Admin</CardTitle>
                         <CardDescription>Gerenciamento de todas as organizações e planos do sistema.</CardDescription>
                       </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <Tabs defaultValue="organizations">
                        <TabsList>
                            <TabsTrigger value="organizations">Organizações</TabsTrigger>
                            <TabsTrigger value="plans">Planos</TabsTrigger>
                        </TabsList>
                        <TabsContent value="organizations" className="mt-4">
                            <Table>
                                <TableHeader><TableRow><TableHead>Organização</TableHead><TableHead>Proprietário</TableHead><TableHead>Status Pag.</TableHead><TableHead>Próx. Venc.</TableHead><TableHead>Acessar</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : organizations.map((org) => (
                                        <TableRow key={org.id}>
                                            <TableCell className="font-medium">{org.name}</TableCell>
                                            <TableCell>{org.owner?.name || 'N/A'}</TableCell>
                                            <TableCell>{getStatusBadge(org.paymentStatus)}</TableCell>
                                            <TableCell>
                                                {org.subscription?.paymentRecords
                                                    ?.filter(p => p.status === 'pending')
                                                    .sort((a,b) => toDate(a.date)!.getTime() - toDate(b.date)!.getTime())
                                                    [0] 
                                                    ? format(toDate(org.subscription.paymentRecords.find(p => p.status === 'pending')!.date)!, 'dd/MM/yyyy') 
                                                    : <Badge variant="outline">N/A</Badge>
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => startImpersonation(org.id)}>
                                                    <LogIn className="mr-2 h-4 w-4"/>
                                                    Acessar Painel
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                             <div className="p-2">
                                                                <Select defaultValue={org.paymentStatus} onValueChange={(s: PaymentStatus) => handleStatusChange(org.id, s)}>
                                                                    <SelectTrigger><SelectValue placeholder="Mudar Status" /></SelectTrigger>
                                                                    <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="overdue">Vencido</SelectItem><SelectItem value="locked">Bloqueado</SelectItem></SelectContent>
                                                                </Select>
                                                             </div>
                                                            <DropdownMenuItem onSelect={() => handleOpenDialog(org, 'subscription')}><DollarSign className="mr-2 h-4 w-4" /> Gerenciar Assinatura</DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleOpenDialog(org, 'users')}><Users className="mr-2 h-4 w-4" /> Gerenciar Usuários</DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleOpenDialog(org, 'profiles')}><Pencil className="mr-2 h-4 w-4" /> Gerenciar Perfis</DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleOpenDialog(org, 'modules')}><SlidersHorizontal className="mr-2 h-4 w-4" /> Gerenciar Módulos</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                             <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Excluir Organização</DropdownMenuItem></AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Excluir "{org.name}"?</AlertDialogTitle><AlertDialogDescription>Essa ação é irreversível e excluirá a organização e todos os seus dados.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOrganization(org.id)} className={buttonVariants({ variant: "destructive" })}>Sim, excluir</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TabsContent>
                         <TabsContent value="plans" className="mt-4">
                            <PricingPlansSettings />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
             {selectedOrg && <ModulesSettingsDialog organization={selectedOrg} isOpen={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen} />}
             {selectedOrg && <OrgUsersDialog organization={selectedOrg} isOpen={isUsersDialogOpen} onOpenChange={setIsUsersDialogOpen} />}
             {selectedOrg && <OrgProfilesDialog organization={selectedOrg} isOpen={isProfilesDialogOpen} onOpenChange={setIsProfilesDialogOpen} />}
             {selectedOrg && <SubscriptionDialog organization={selectedOrg} isOpen={isSubscriptionDialogOpen} onOpenChange={setIsSubscriptionDialogOpen} adminUser={user}/>}
        </div>
    );
}

export default SuperAdminPage;

