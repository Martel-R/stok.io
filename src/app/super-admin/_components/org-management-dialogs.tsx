
'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where, addDoc, deleteDoc } from 'firebase/firestore';
import type { Organization, User, EnabledModules, PermissionProfile } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Loader2, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { allModuleConfig } from '@/components/module-permission-row';
import { UserForm } from './user-form';
import { PermissionProfileForm } from '@/components/permission-profile-form';

type OrgWithUser = Organization & { owner?: User };

export function ModulesSettingsDialog({ organization, isOpen, onOpenChange }: { organization: Organization, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const handleModuleToggle = async (module: keyof EnabledModules, checked: boolean) => {
        const newPermissions = checked ? { view: true, edit: true, delete: true } : { view: false, edit: false, delete: false };
        
        setIsUpdating(module);
        try {
            const orgRef = doc(db, 'organizations', organization.id);
            await updateDoc(orgRef, { [`enabledModules.${module}`]: newPermissions });
            toast({ title: `Módulo ${checked ? 'habilitado' : 'desabilitado'}!` });
        } catch (error) {
            console.error("Error updating module:", error);
            toast({ title: 'Erro ao salvar alteração', variant: 'destructive' });
        } finally {
            setIsUpdating(null);
        }
    };

    if (!isOpen) return null;

    const enabledModules = organization.enabledModules || {} as EnabledModules;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Módulos</DialogTitle>
                    <DialogDescription>Habilite ou desabilite funcionalidades para a organização "{organization.name}".</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                     {allModuleConfig.map(mod => (
                        <div key={mod.key} className="flex flex-row items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                            <div className="flex flex-col">
                                <Label htmlFor={`module-${mod.key}`} className="text-base font-semibold">{mod.label}</Label>
                                {isUpdating === mod.key && <span className="text-[10px] text-muted-foreground animate-pulse">Salvando...</span>}
                            </div>
                            <Switch
                                id={`module-${mod.key}`}
                                checked={!!enabledModules[mod.key]?.view}
                                disabled={isUpdating === mod.key}
                                onCheckedChange={(checked) => handleModuleToggle(mod.key, checked)}
                            />
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function OrgUsersDialog({ organization, isOpen, onOpenChange }: { organization: OrgWithUser | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const { createUser, resetUserPassword } = useAuth();
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
            const { success, error } = await createUser(userToSave.email!, userToSave.name!, userToSave.role!, organization.id, undefined, userToSave.password);
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
    
    if (!isOpen || !organization) return null;

    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                 <DialogHeader>
                    <DialogTitle>Gerenciar Usuários de "{organization.name}"</DialogTitle>
                </DialogHeader>
                 <div className="py-4 flex-1 overflow-y-auto">
                     <div className="flex justify-end mb-4">
                        <Button onClick={() => { setEditingUser(undefined); setIsFormOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Usuário</Button>
                    </div>
                     <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Perfil</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                                users.map(u => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.name}</TableCell>
                                        <TableCell>{u.email}</TableCell>
                                        <TableCell><Badge variant="secondary">{getProfileName(u.role)}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => { setEditingUser(u); setIsFormOpen(true); }}>Editar</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleResetPassword(u.email)}>Redefinir Senha</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                                }
                            </TableBody>
                        </Table>
                     </div>
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

export function OrgProfilesDialog({ organization, isOpen, onOpenChange }: { organization: OrgWithUser | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
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
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Gerenciar Perfis de "{organization.name}"</DialogTitle>
                </DialogHeader>
                 <div className="py-4 flex-1 overflow-y-auto">
                     <div className="flex justify-end mb-4">
                        <Button onClick={() => { setEditingProfile(undefined); setIsFormOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Perfil</Button>
                    </div>
                     <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Permissões Ativas</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                                profiles.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(p.permissions).filter(([, perms]) => perms.view).map(([key]) => <Badge key={key} variant="outline" className="capitalize text-[10px]">{key}</Badge>)}
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
