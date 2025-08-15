

// src/app/super-admin/page.tsx
'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where, getDocs, deleteDoc, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import type { Organization, User, PaymentStatus, EnabledModules, PermissionProfile, Subscription } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Loader2, ShieldAlert, Trash2, SlidersHorizontal, Users, PlusCircle, Pencil, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PermissionProfileForm } from '@/components/permission-profile-form';
import { format, addMonths } from 'date-fns';
import { Separator } from '@/components/ui/separator';

type OrgWithUser = Organization & { owner?: User };

function SubscriptionDialog({ organization, isOpen, onOpenChange, adminUser }: { organization: Organization, isOpen: boolean, onOpenChange: (open: boolean) => void, adminUser: User | null }) {
    const { toast } = useToast();
    const [paymentAmount, setPaymentAmount] = useState<number>(organization.subscription?.price || 0);
    const [newPlanName, setNewPlanName] = useState('Plano Pro');
    const [newPlanPrice, setNewPlanPrice] = useState(99.90);
    const [newPlanDate, setNewPlanDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));

    const handleCreateSubscription = async () => {
        if (!adminUser) return;
        const newSubscription: Subscription = {
            planName: newPlanName,
            price: newPlanPrice,
            nextDueDate: new Date(newPlanDate),
            paymentRecords: [],
        };
        try {
            await updateDoc(doc(db, 'organizations', organization.id), {
                subscription: newSubscription
            });
            toast({ title: 'Assinatura criada com sucesso!' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao criar assinatura', variant: 'destructive' });
        }
    }

    const handleRegisterPayment = async () => {
        if (!organization.subscription || !adminUser) return;
        
        const newPayment = {
            id: doc(collection(db, 'paymentRecords')).id,
            date: serverTimestamp(),
            amount: paymentAmount,
            recordedBy: adminUser.id,
        };
        
        const nextDueDate = addMonths(organization.subscription.nextDueDate.toDate(), 1);

        try {
            await updateDoc(doc(db, 'organizations', organization.id), {
                'subscription.nextDueDate': nextDueDate,
                'subscription.paymentRecords': arrayUnion(newPayment),
                'paymentStatus': 'active'
            });
            toast({ title: 'Pagamento registrado com sucesso!' });
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao registrar pagamento', variant: 'destructive' });
        }
    };
    
    const sub = organization.subscription;
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gerenciar Assinatura: {organization.name}</DialogTitle>
                </DialogHeader>
                {sub ? (
                    <div className="space-y-4 py-4">
                        <div>
                            <p><strong>Plano:</strong> {sub.planName}</p>
                            <p><strong>Valor:</strong> R$ {sub.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                            <p><strong>Próximo Vencimento:</strong> {format(sub.nextDueDate.toDate(), 'dd/MM/yyyy')}</p>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                             <h4 className="font-semibold">Registrar Novo Pagamento</h4>
                             <Label htmlFor="paymentAmount">Valor</Label>
                             <Input 
                                id="paymentAmount"
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                             />
                             <Button onClick={handleRegisterPayment} className="w-full">Registrar Pagamento</Button>
                        </div>
                         <Separator />
                         <div>
                            <h4 className="font-semibold">Histórico de Pagamentos</h4>
                            <div className="max-h-48 overflow-y-auto mt-2 space-y-2">
                                {sub.paymentRecords && sub.paymentRecords.length > 0 ? (
                                    sub.paymentRecords.map((p, i) => (
                                        <div key={i} className="flex justify-between text-sm p-2 bg-muted rounded-md">
                                            <span>{p.date ? format(p.date.toDate(), 'dd/MM/yyyy') : 'Registrando...'}</span>
                                            <span>R$ {p.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                                )}
                            </div>
                         </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <p className="text-muted-foreground">Nenhuma assinatura encontrada para esta organização. Crie uma abaixo.</p>
                         <div className="space-y-2">
                            <Label htmlFor="planName">Nome do Plano</Label>
                            <Input id="planName" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="planPrice">Preço (R$)</Label>
                            <Input id="planPrice" type="number" value={newPlanPrice} onChange={e => setNewPlanPrice(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nextDueDate">Próximo Vencimento</Label>
                            <Input id="nextDueDate" type="date" value={newPlanDate} onChange={e => setNewPlanDate(e.target.value)} />
                        </div>
                        <Button onClick={handleCreateSubscription} className="w-full">Criar Assinatura</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
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
        // When enabling a module, enable all its permissions by default.
        const newPermissions = checked ? { view: true, edit: true, delete: true } : { view: false, edit: false, delete: false };
        const updatedModules = { ...enabledModules, [module]: newPermissions };
        
        setEnabledModules(updatedModules);

        try {
            const orgRef = doc(db, 'organizations', organization.id);
            await updateDoc(orgRef, { enabledModules: updatedModules });
            toast({ title: 'Módulo atualizado com sucesso!' });
        } catch (error) {
            toast({ title: 'Erro ao atualizar módulo', variant: 'destructive' });
            // Revert on error
            setEnabledModules(prev => {
                const reverted = {...prev};
                delete reverted[module];
                return reverted;
            });
        }
    };

    const moduleConfig = [
        { key: 'customers', label: 'Clientes' },
        { key: 'services', label: 'Serviços' },
        { key: 'appointments', label: 'Agendamentos' },
        { key: 'pos', label: 'Frente de Caixa (PDV)' },
        { key: 'combos', label: 'Combos Promocionais' },
        { key: 'kits', label: 'Kits Dinâmicos' },
        { key: 'assistant', label: 'Oráculo AI' },
        { key: 'reports', label: 'Relatórios Gerenciais' },
    ] as const;

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Módulos</DialogTitle>
                    <DialogDescription>Habilite ou desabilite funcionalidades para a organização "{organization.name}".</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     {moduleConfig.map(mod => (
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
    const { createUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

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
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingUser(u); setIsFormOpen(true); }}>Editar</Button>
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
            </DialogContent>
        </Dialog>
    )
}

function UserForm({ user, profiles, onSave, onDone }: { user?: User; profiles: PermissionProfile[]; onSave: (user: Partial<User>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(user || { name: '', email: '', role: profiles[0]?.id || '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleRoleChange = (roleId: string) => setFormData(prev => ({...prev, role: roleId}));
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData as User); onDone(); };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Nome do usuário" required />
            <Input name="email" type="email" value={formData.email || ''} onChange={handleChange} placeholder="Email" required disabled={!!user} />
            <Select value={formData.role} onValueChange={handleRoleChange}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            <DialogFooter><Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button><Button type="submit">Salvar</Button></DialogFooter>
        </form>
    );
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
        // Here you should check if any user is using this profile before deleting
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
    const { user, loading: authLoading } = useAuth();
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
        if (!authLoading && (!user || user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL)) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user && user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
            const unsubscribeOrgs = onSnapshot(collection(db, 'organizations'), async (orgSnapshot) => {
                const orgsData = orgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
                const usersSnapshot = await getDocs(collection(db, 'users'));
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
        const collectionsToDelete = ['users', 'branches', 'products', 'combos', 'kits', 'sales', 'stockEntries', 'paymentConditions', 'permissionProfiles'];
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

    if (authLoading || loading || !user || user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
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
                         <CardDescription>Gerenciamento de todas as organizações do sistema.</CardDescription>
                       </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Organização</TableHead><TableHead>Proprietário</TableHead><TableHead>Status Pag.</TableHead><TableHead>Próx. Venc.</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {organizations.map((org) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell>{org.owner?.name || 'N/A'}</TableCell>
                                    <TableCell>{getStatusBadge(org.paymentStatus)}</TableCell>
                                    <TableCell>{org.subscription?.nextDueDate ? format(org.subscription.nextDueDate.toDate(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
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
