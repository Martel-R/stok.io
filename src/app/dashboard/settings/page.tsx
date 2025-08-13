

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, getDocs, query, where, writeBatch, orderBy } from 'firebase/firestore';
import type { User, Branch, PaymentCondition, PaymentConditionType, Product, EnabledModules, AnamnesisQuestion, AnamnesisQuestionType, BrandingSettings, PermissionProfile, ModulePermissions } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash2, Eye, EyeOff, Loader2, FileUp, ListChecks, Upload, Link as LinkIcon, Palette, SlidersHorizontal, Home, Users, Briefcase, Calendar, Package, Gift, Component, BarChart, ShoppingCart, Bot, FileText, Settings, View, Pencil, Trash, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { ImportAnamnesisQuestionsDialog } from '@/components/import-anamnesis-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';


const availableAvatars = [
    'https://placehold.co/100x100.png?text=🦊',
    'https://placehold.co/100x100.png?text=🦉',
    'https://placehold.co/100x100.png?text=🐻',
    'https://placehold.co/100x100.png?text=🦁',
    'https://placehold.co/100x100.png?text=🦄',
];
const getRandomAvatar = () => availableAvatars[Math.floor(Math.random() * availableAvatars.length)];

function UserForm({ user, profiles, onSave, onDone }: { user?: User; profiles: PermissionProfile[]; onSave: (user: Partial<User>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { name: '', email: '', role: '', avatar: getRandomAvatar() }
    );

    useEffect(() => {
        if (!user && profiles.length > 0) {
            // Default to the first profile if creating a new user
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
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required disabled={isEditing}/>
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


function UsersTable() {
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const { toast } = useToast();
    const { createUser, user: adminUser } = useAuth();

    useEffect(() => {
        if (!adminUser?.organizationId) {
            setLoading(false);
            return;
        }
        const qUsers = query(collection(db, 'users'), where('organizationId', '==', adminUser.organizationId));
        const qProfiles = query(collection(db, 'permissionProfiles'), where('organizationId', '==', adminUser.organizationId));
        
        const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
            setUsers(usersData);
            setLoading(false);
        });

        const unsubscribeProfiles = onSnapshot(qProfiles, (snapshot) => {
             setProfiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionProfile)));
        });

        return () => {
            unsubscribeUsers();
            unsubscribeProfiles();
        }
    }, [adminUser]);

    const getProfileName = (roleId: string) => {
        const profile = profiles.find(p => p.id === roleId);
        if (profile) return <Badge variant="secondary">{profile.name}</Badge>;
        return <Badge variant="outline">{roleId}</Badge>;
    }
    
    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setIsFormOpen(true);
    }

    const openNewDialog = () => {
        setEditingUser(undefined);
        setIsFormOpen(true);
    }
    
    const handleSave = async (userToSave: Partial<User>) => {
        if (editingUser?.id) {
            try {
                const userRef = doc(db, "users", editingUser.id);
                await updateDoc(userRef, { role: userToSave.role, name: userToSave.name });
                toast({ title: 'Usuário atualizado com sucesso!' });
            } catch (error) {
                console.error("Error updating user: ", error);
                toast({ title: 'Erro ao atualizar usuário', variant: 'destructive' });
            }
        } else {
            if (!userToSave.email || !userToSave.name || !userToSave.role || !adminUser?.organizationId) {
                toast({title: "Campos obrigatórios faltando", variant: "destructive"});
                return;
            }
            try {
                 const { success, error } = await createUser(
                     userToSave.email, 
                     userToSave.name, 
                     userToSave.role, 
                     adminUser.organizationId
                 );
                 if (success) {
                     toast({title: "Usuário criado!", description: "Um e-mail para definição de senha foi enviado."});
                 } else {
                     toast({title: "Erro ao criar usuário", description: error, variant: "destructive"});
                 }
            } catch (error) {
                 toast({title: "Erro ao criar usuário", variant: "destructive"});
            }
        }
        setIsFormOpen(false);
    };

    const handleDelete = (userId: string) => {
        toast({ title: 'Funcionalidade não implementada', description: 'A exclusão de usuários deve ser feita a partir de um ambiente seguro.', variant: 'destructive'});
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Usuários</CardTitle>
                        <CardDescription>Gerencie as permissões dos usuários da sua organização.</CardDescription>
                    </div>
                     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                           <Button onClick={openNewDialog}><PlusCircle className="mr-2" /> Adicionar Usuário</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[480px]">
                            <DialogHeader>
                                <DialogTitle>{editingUser ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
                            </DialogHeader>
                            <UserForm user={editingUser} profiles={profiles} onSave={handleSave} onDone={() => setIsFormOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Perfil</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{getProfileName(user.role)}</TableCell>
                                    <TableCell className="text-right">
                                         <AlertDialog>
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Abrir menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(user)}>Editar</DropdownMenuItem>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Excluir</DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Essa ação não pode ser desfeita. A exclusão de usuários é uma funcionalidade restrita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(user.id)} className={buttonVariants({ variant: "destructive" })}>Confirmar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                         </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function BranchesSettings() {
    const { user: currentUser, branches, setCurrentBranch } = useAuth();
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        if (!currentUser?.organizationId) return;
        const q = query(collection(db, 'users'), where('organizationId', '==', currentUser.organizationId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const openEditDialog = (branch: Branch) => {
        setEditingBranch(branch);
        setIsFormOpen(true);
    }

    const openNewDialog = () => {
        setEditingBranch(undefined);
        setIsFormOpen(true);
    }

    const handleSave = async (branchData: Omit<Branch, 'id' | 'organizationId'>) => {
        if (!currentUser?.organizationId) {
             toast({ title: 'Erro de permissão', description: 'Organização do usuário não encontrada.', variant: 'destructive' });
             return;
        }
        try {
            if (editingBranch?.id) {
                await updateDoc(doc(db, "branches", editingBranch.id), branchData);
                toast({ title: 'Filial atualizada com sucesso!' });
            } else {
                const batch = writeBatch(db);
                const branchDocRef = doc(collection(db, "branches"));
                const newBranchData = { ...branchData, organizationId: currentUser.organizationId };
                batch.set(branchDocRef, newBranchData);

                // Seed products for the new branch
                MOCK_PRODUCTS.forEach(product => {
                    const productDocRef = doc(collection(db, 'products'));
                    const productWithBranchInfo: Omit<Product, 'id'|'stock'> = {
                        ...product,
                        branchId: branchDocRef.id,
                        organizationId: currentUser.organizationId,
                        isSalable: true,
                        purchasePrice: product.price * 0.6,
                        marginType: 'percentage',
                        marginValue: 66.67,
                    };
                    batch.set(productDocRef, productWithBranchInfo);
                });

                await batch.commit();

                toast({ title: 'Filial adicionada com sucesso!', description: 'Adicionamos alguns produtos de exemplo para você começar.' });
                // If this is the first branch, set it as active
                if(branches.length === 0) {
                    setCurrentBranch({id: branchDocRef.id, ...newBranchData});
                }
            }
        } catch (error) {
            console.error("Error saving branch: ", error);
            toast({ title: 'Erro ao salvar filial', variant: 'destructive' });
        }
        setIsFormOpen(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'branches', id));
            toast({ title: 'Filial removida!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao remover filial', variant: 'destructive' });
        }
    };
    
    const getUserName = (userId: string) => allUsers.find(u => u.id === userId)?.name || 'Usuário desconhecido';

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Filiais</CardTitle>
                        <CardDescription>Gerencie as unidades de negócio da sua empresa.</CardDescription>
                    </div>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openNewDialog}><PlusCircle className="mr-2" /> Adicionar Filial</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{editingBranch ? 'Editar Filial' : 'Adicionar Nova Filial'}</DialogTitle>
                            </DialogHeader>
                            <BranchForm
                                branch={editingBranch}
                                users={allUsers}
                                onSave={handleSave}
                                onDone={() => setIsFormOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>CNPJ</TableHead>
                            <TableHead>Localização</TableHead>
                            <TableHead>Usuários</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 2 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            branches.map(branch => (
                                <TableRow key={branch.id}>
                                    <TableCell className="font-medium">{branch.name}</TableCell>
                                    <TableCell>{branch.cnpj}</TableCell>
                                    <TableCell>{branch.location}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {branch.userIds.map(uid => <Badge key={uid} variant="secondary">{getUserName(uid)}</Badge>)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                         <AlertDialog>
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(branch)}>Editar</DropdownMenuItem>
                                                <AlertDialogTrigger asChild>
                                                     <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Excluir</DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                    <AlertDialogDescription>Essa ação não pode ser desfeita e removerá permanentemente a filial.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(branch.id)} className={buttonVariants({ variant: "destructive" })}>Confirmar Exclusão</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                         </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function BranchForm({ branch, users, onSave, onDone }: { branch?: Branch; users: User[]; onSave: (data: Omit<Branch, 'id' | 'organizationId'>) => void; onDone: () => void }) {
    const { user: currentUser } = useAuth();
    const [formData, setFormData] = useState(
        branch || { name: '', cnpj: '', location: '', userIds: currentUser ? [currentUser.id] : [], taxRate: 8 }
    );
    const [open, setOpen] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleUserSelect = (userId: string) => {
        setFormData(prev => {
            const newUserIds = prev.userIds.includes(userId)
                ? prev.userIds.filter(id => id !== userId)
                : [...prev.userIds, userId];
            return { ...prev, userIds: newUserIds };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Omit<Branch, 'id' | 'organizationId'>);
        onDone();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Label htmlFor="name">Nome da Filial</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="location">Localização</Label>
                <Input id="location" name="location" value={formData.location} onChange={handleChange} required placeholder="Ex: Rua, Nº, Bairro, Cidade - UF" />
            </div>
            <div>
                <Label htmlFor="taxRate">Imposto (%)</Label>
                <Input id="taxRate" name="taxRate" type="number" step="0.1" value={formData.taxRate} onChange={handleChange} required />
            </div>
            <div>
                <Label>Usuários Vinculados</Label>
                 <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between"
                        >
                            <span className="truncate">
                            {formData.userIds.length > 0
                                ? `${formData.userIds.length} usuário(s) selecionado(s)`
                                : "Selecione os usuários..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                        <Command>
                            <CommandInput placeholder="Buscar usuário..." />
                            <CommandList>
                                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                                <CommandGroup>
                                    {users.map((user) => (
                                        <CommandItem
                                            key={user.id}
                                            value={user.name}
                                            onSelect={() => handleUserSelect(user.id)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    formData.userIds.includes(user.id) ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {user.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Filial</Button>
            </DialogFooter>
        </form>
    );
}


function PaymentConditionForm({ condition, onSave, onDone }: { condition?: PaymentCondition, onSave: (data: Partial<PaymentCondition>) => void, onDone: () => void }) {
    const [formData, setFormData] = useState(
        condition || { name: '', type: 'credit', fee: 0, feeType: 'percentage', maxInstallments: 12 }
    );
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };
    
    const handleSelectChange = (name: string, value: string) => {
         setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label htmlFor="name">Nome da Condição</Label>
                <Input 
                    id="name"
                    name="name"
                    value={formData.name} 
                    onChange={handleInputChange}
                    placeholder="Ex: Cartão de Crédito"
                    required
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select name="type" value={formData.type} onValueChange={(value: PaymentConditionType) => handleSelectChange('type', value)}>
                    <SelectTrigger id="type">
                        <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="credit">Crédito</SelectItem>
                        <SelectItem value="debit">Débito</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="pix">Pix</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="fee">Taxa (%)</Label>
                <Input 
                    id="fee"
                    name="fee"
                    type="number"
                    step="0.01"
                    value={formData.fee} 
                    onChange={handleInputChange}
                    placeholder="Ex: 2.5"
                    disabled={formData.type === 'cash'}
                />
            </div>

             {formData.type === 'credit' && (
                 <div className="space-y-2">
                    <Label htmlFor="maxInstallments">Máximo de Parcelas</Label>
                    <Input 
                        id="maxInstallments"
                        name="maxInstallments"
                        type="number"
                        value={formData.maxInstallments} 
                        onChange={handleInputChange}
                    />
                </div>
             )}
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
            </DialogFooter>
        </form>
    )
}

function PaymentConditions() {
    const [conditions, setConditions] = useState<PaymentCondition[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCondition, setEditingCondition] = useState<PaymentCondition | undefined>(undefined);

    useEffect(() => {
        if (!user?.organizationId) return;
        const q = query(collection(db, 'paymentConditions'), where('organizationId', '==', user.organizationId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentCondition));
            setConditions(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleSave = async (data: Partial<PaymentCondition>) => {
        if (!user?.organizationId) {
            toast({ title: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }

        try {
            if (editingCondition?.id) {
                const { id, ...dataToSave } = data;
                await updateDoc(doc(db, 'paymentConditions', editingCondition.id), dataToSave);
                toast({ title: 'Condição atualizada com sucesso!' });
            } else {
                 await addDoc(collection(db, 'paymentConditions'), {
                    ...data,
                    organizationId: user.organizationId
                });
                toast({ title: 'Condição de pagamento adicionada!' });
            }
            setIsFormOpen(false);
        } catch (error) {
             toast({ title: 'Erro ao salvar condição', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'paymentConditions', id));
            toast({ title: 'Condição de pagamento removida!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao remover condição', variant: 'destructive' });
        }
    };

    const openEditDialog = (condition: PaymentCondition) => {
        setEditingCondition(condition);
        setIsFormOpen(true);
    }

    const openNewDialog = () => {
        setEditingCondition(undefined);
        setIsFormOpen(true);
    }
    
    const getTypeName = (type: PaymentConditionType) => {
        const names = { credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro', pix: 'Pix' };
        return names[type] || 'Desconhecido';
    }

    return (
        <Card>
            <CardHeader>
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Condições de Pagamento</CardTitle>
                        <CardDescription>Gerencie as formas de pagamento aceitas na Frente de Caixa, incluindo tipos, taxas e parcelamento.</CardDescription>
                    </div>
                    <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar</Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                             <TableHead>Taxa</TableHead>
                             <TableHead>Max. Parcelas</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                        ) : (
                            conditions.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell><Badge variant="outline">{getTypeName(c.type)}</Badge></TableCell>
                                    <TableCell>
                                        {c.fee > 0 
                                            ? `${c.fee.toLocaleString('pt-BR')} %`
                                            : 'Sem taxa'}
                                    </TableCell>
                                    <TableCell>
                                        {c.type === 'credit' ? c.maxInstallments : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                                                     <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => openEditDialog(c)}>Editar</DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDelete(c.id)} className="text-destructive focus:text-destructive">Excluir</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCondition ? 'Editar' : 'Adicionar'} Condição de Pagamento</DialogTitle>
                    </DialogHeader>
                    <PaymentConditionForm 
                        condition={editingCondition}
                        onSave={handleSave}
                        onDone={() => setIsFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </Card>
    );
}

const typeNames: Record<AnamnesisQuestionType, string> = {
    text: 'Discursiva',
    boolean: 'Sim/Não',
    boolean_with_text: 'Sim/Não com Texto',
    integer: 'Número Inteiro',
    decimal: 'Número Decimal',
};

function AnamnesisQuestionForm({ 
    question, 
    onSave, 
    onDone 
}: { 
    question?: AnamnesisQuestion; 
    onSave: (data: Partial<AnamnesisQuestion>) => void; 
    onDone: () => void 
}) {
    const [formData, setFormData] = useState<Partial<AnamnesisQuestion>>(question || { label: '', type: 'text' });
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, label: e.target.value }));
    };

    const handleTypeChange = (value: AnamnesisQuestionType) => {
        setFormData(prev => ({ ...prev, type: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onDone();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label htmlFor="questionLabel">Texto da Pergunta</Label>
                <Input 
                    id="questionLabel"
                    value={formData.label} 
                    onChange={handleInputChange}
                    placeholder="Ex: Você possui alguma alergia?"
                    required
                />
            </div>
            <div className="space-y-2">
                <Label>Tipo de Resposta</Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(typeNames).map(([key, name]) => (
                            <SelectItem key={key} value={key}>{name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <DialogFooter>
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Pergunta</Button>
            </DialogFooter>
        </form>
    );
}


function AnamnesisSettings() {
    const [questions, setQuestions] = useState<AnamnesisQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<AnamnesisQuestion | undefined>(undefined);
    const { toast } = useToast();
    
    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        };
        const q = query(
            collection(db, 'anamnesisQuestions'), 
            where('organizationId', '==', user.organizationId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnamnesisQuestion));
            // Sort client-side
            data.sort((a,b) => (a.order || 0) - (b.order || 0));
            setQuestions(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleSave = async (data: Partial<AnamnesisQuestion>) => {
        if (!user?.organizationId) {
            toast({ title: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        try {
            if (editingQuestion?.id) {
                await updateDoc(doc(db, 'anamnesisQuestions', editingQuestion.id), data);
                toast({ title: 'Pergunta atualizada!' });
            } else {
                await addDoc(collection(db, 'anamnesisQuestions'), {
                    ...data,
                    organizationId: user.organizationId,
                    order: questions.length, // Simple ordering
                });
                toast({ title: 'Pergunta adicionada!' });
            }
            setIsFormOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao salvar pergunta', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'anamnesisQuestions', id));
            toast({ title: 'Pergunta excluída!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir pergunta', variant: 'destructive' });
        }
    };

    const openEditDialog = (question: AnamnesisQuestion) => {
        setEditingQuestion(question);
        setIsFormOpen(true);
    }
    
    const openNewDialog = () => {
        setEditingQuestion(undefined);
        setIsFormOpen(true);
    }

    const handleImport = async (importedQuestions: Omit<AnamnesisQuestion, 'id' | 'organizationId' | 'order'>[]) => {
      if (!user?.organizationId) {
          toast({ title: 'Organização não encontrada', variant: 'destructive' });
          return;
      }
      const batch = writeBatch(db);
      const baseOrder = questions.length;
      importedQuestions.forEach((q, index) => {
          const questionRef = doc(collection(db, "anamnesisQuestions"));
          batch.set(questionRef, {
              ...q,
              organizationId: user.organizationId,
              order: baseOrder + index,
          });
      });
      try {
          await batch.commit();
          toast({ title: `${importedQuestions.length} perguntas importadas com sucesso!` });
          setIsImportOpen(false);
      } catch (error) {
          console.error("Error importing questions:", error);
          toast({ title: 'Erro ao importar perguntas', variant: 'destructive' });
      }
    };
    
    return (
         <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Perguntas da Anamnese</CardTitle>
                        <CardDescription>Configure as perguntas que aparecerão no formulário de anamnese dos clientes.</CardDescription>
                    </div>
                     <div className="flex flex-wrap gap-2">
                        <ImportAnamnesisQuestionsDialog
                            isOpen={isImportOpen}
                            onOpenChange={setIsImportOpen}
                            onImport={handleImport}
                        >
                             <Button variant="outline">
                                <FileUp className="mr-2" />
                                Importar
                            </Button>
                        </ImportAnamnesisQuestionsDialog>
                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild>
                                 <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Pergunta</Button>
                            </DialogTrigger>
                             <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingQuestion ? 'Editar Pergunta' : 'Adicionar Pergunta'}</DialogTitle>
                                </DialogHeader>
                                <AnamnesisQuestionForm
                                    question={editingQuestion}
                                    onSave={handleSave}
                                    onDone={() => setIsFormOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pergunta</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                            Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                            ))
                        ) : questions.length > 0 ? (
                            questions.map(q => (
                                <TableRow key={q.id}>
                                    <TableCell className="font-medium">{q.label}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {typeNames[q.type] || 'Desconhecido'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => openEditDialog(q)}>
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator/>
                                                     <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                            Excluir
                                                        </DropdownMenuItem>
                                                     </AlertDialogTrigger>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir Pergunta?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Essa ação é irreversível.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(q.id)} className={buttonVariants({variant: 'destructive'})}>
                                                        Sim, excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">Nenhuma pergunta encontrada.</TableCell>
                             </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function BrandingSettings() {
    const { user, updateOrganizationBranding } = useAuth();
    const [branding, setBranding] = useState<BrandingSettings>({
        logoUrl: user?.organization?.branding?.logoUrl || '',
        primaryColor: user?.organization?.branding?.primaryColor || '',
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setBranding({
            logoUrl: user?.organization?.branding?.logoUrl || '',
            primaryColor: user?.organization?.branding?.primaryColor || '',
        })
    }, [user?.organization?.branding]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                setBranding((prev) => ({ ...prev, logoUrl: reader.result as string }));
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        // Basic HSL validation
        if (/^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/.test(value)) {
            setBranding(prev => ({...prev, primaryColor: value}));
        } else {
             setBranding(prev => ({...prev, primaryColor: value}));
        }
    }
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateOrganizationBranding(branding);
            toast({title: "Branding atualizado com sucesso!"});
        } catch (error) {
            console.error(error);
            toast({title: "Erro ao atualizar o branding", variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Branding da Organização</CardTitle>
                <CardDescription>Personalize a aparência do sistema com a identidade visual da sua marca.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Tabs defaultValue="logo" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="logo"><Upload className="mr-2 h-4 w-4" /> Logo</TabsTrigger>
                            <TabsTrigger value="colors"><Palette className="mr-2 h-4 w-4" /> Cores</TabsTrigger>
                        </TabsList>
                        <TabsContent value="logo" className="pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="logoUrl">URL do Logo</Label>
                                <Input 
                                    id="logoUrl" 
                                    name="logoUrl" 
                                    value={branding.logoUrl} 
                                    onChange={(e) => setBranding(prev => ({...prev, logoUrl: e.target.value}))} 
                                    placeholder="https://exemplo.com/logo.png" 
                                />
                            </div>
                        </TabsContent>
                        <TabsContent value="colors" className="pt-4">
                             <div className="space-y-2">
                                <Label htmlFor="primaryColor">Cor Primária (HSL)</Label>
                                <Input 
                                    id="primaryColor" 
                                    name="primaryColor" 
                                    value={branding.primaryColor} 
                                    onChange={handleColorChange}
                                    placeholder="Ex: 231 48% 48%"
                                />
                                <p className="text-sm text-muted-foreground">Insira o valor no formato HSL sem vírgulas. Ex: `231 48% 48%`</p>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {branding.logoUrl && (
                        <div>
                            <Label>Pré-visualização do Logo</Label>
                            <div className="mt-2 rounded-md border p-2 flex justify-center items-center h-24 w-24">
                                <Image src={branding.logoUrl} alt="Pré-visualização do logo" width={80} height={80} className="object-contain h-full w-full" data-ai-hint="company logo" />
                            </div>
                        </div>
                    )}
                    
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salvar Branding
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function RolesSettings() {
    const { user } = useAuth();
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<PermissionProfile | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        const q = query(collection(db, 'permissionProfiles'), where('organizationId', '==', user.organizationId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionProfile));
            setProfiles(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleSave = async (profileData: Partial<PermissionProfile>) => {
        if (!user?.organizationId) return;

        try {
            if (editingProfile?.id) {
                await updateDoc(doc(db, 'permissionProfiles', editingProfile.id), profileData);
                toast({ title: 'Perfil atualizado com sucesso!' });
            } else {
                await addDoc(collection(db, 'permissionProfiles'), { ...profileData, organizationId: user.organizationId });
                toast({ title: 'Novo perfil criado com sucesso!' });
            }
            setIsFormOpen(false);
            setEditingProfile(undefined);
        } catch (error) {
            toast({ title: 'Erro ao salvar perfil', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'permissionProfiles', id));
            toast({ title: 'Perfil excluído!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir perfil', variant: 'destructive' });
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Perfis e Permissões</CardTitle>
                        <CardDescription>
                            Crie perfis de usuário e defina quais módulos cada um pode acessar.
                        </CardDescription>
                    </div>
                     <Button onClick={() => { setEditingProfile(undefined); setIsFormOpen(true); }}>
                        <PlusCircle className="mr-2" /> Adicionar Perfil
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Perfil</TableHead>
                            <TableHead>Permissões</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3}><Skeleton className="h-5 w-full"/></TableCell></TableRow>
                        ) : profiles.map(profile => (
                            <TableRow key={profile.id}>
                                <TableCell className="font-medium">{profile.name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(profile.permissions)
                                            .filter(([, perms]) => perms.view)
                                            .map(([key]) => (
                                            <Badge key={key} variant="outline">{key}</Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingProfile(profile); setIsFormOpen(true);}}>
                                        <Pencil className="h-4 w-4"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingProfile ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
                        </DialogHeader>
                        <PermissionProfileForm
                            profile={editingProfile}
                            onSave={handleSave}
                            onDelete={handleDelete}
                            onDone={() => setIsFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

function PermissionProfileForm({
    profile, onSave, onDelete, onDone
}: {
    profile?: PermissionProfile,
    onSave: (data: Partial<PermissionProfile>) => void,
    onDelete: (id: string) => void,
    onDone: () => void,
}) {
    const { user } = useAuth();
    const [formData, setFormData] = useState<Partial<PermissionProfile>>({});
    
    const allModuleConfig = React.useMemo(() => [
        { key: 'dashboard', label: 'Início', icon: Home },
        { key: 'customers', label: 'Clientes', icon: Users },
        { key: 'services', label: 'Serviços', icon: Briefcase },
        { key: 'appointments', label: 'Agendamentos', icon: Calendar },
        { key: 'products', label: 'Produtos', icon: Package },
        { key: 'combos', label: 'Combos', icon: Gift },
        { key: 'kits', label: 'Kits', icon: Component },
        { key: 'inventory', label: 'Estoque', icon: BarChart },
        { key: 'pos', label: 'Frente de Caixa', icon: ShoppingCart },
        { key: 'assistant', label: 'Oráculo AI', icon: Bot },
        { key: 'reports', label: 'Relatórios', icon: FileText },
        { key: 'settings', label: 'Configurações', icon: Settings },
    ] as const, []);

    const activeModuleConfig = React.useMemo(() => 
        allModuleConfig.filter(mod => user?.organization?.enabledModules[mod.key as keyof EnabledModules]),
    [allModuleConfig, user?.organization?.enabledModules]);

    useEffect(() => {
        const defaultPermissions: Partial<EnabledModules> = {};
        activeModuleConfig.forEach(mod => {
            defaultPermissions[mod.key] = { view: false, edit: false, delete: false };
        });

        const initialPermissions = profile?.permissions 
            ? { ...defaultPermissions, ...profile.permissions } 
            : defaultPermissions;

        setFormData({
            ...profile,
            name: profile?.name || '',
            permissions: initialPermissions as EnabledModules,
        });
    }, [profile, activeModuleConfig]);

    const handlePermissionChange = (
        module: keyof EnabledModules, 
        permission: keyof ModulePermissions, 
        checked: boolean
    ) => {
        setFormData(prev => {
            const newPermissions = { ...prev.permissions };
            const currentModulePerms = newPermissions[module] || { view: false, edit: false, delete: false };
            const updatedModulePerms = { ...currentModulePerms, [permission]: checked };
            
            if (permission === 'view' && !checked) {
                updatedModulePerms.edit = false;
                updatedModulePerms.delete = false;
            }
            if ((permission === 'edit' || permission === 'delete') && checked) {
                 updatedModulePerms.view = true;
            }

            return { ...prev, permissions: {...newPermissions, [module]: updatedModulePerms} as EnabledModules };
        });
    };

    const handleSelectAll = (permission: keyof ModulePermissions, checked: boolean) => {
        setFormData(prev => {
            const newPermissions = { ...prev.permissions } as EnabledModules;
            activeModuleConfig.forEach(mod => {
                const currentModulePerms = newPermissions[mod.key] || { view: false, edit: false, delete: false };
                const updatedModulePerms = { ...currentModulePerms, [permission]: checked };

                if (permission === 'view' && !checked) {
                    updatedModulePerms.edit = false;
                    updatedModulePerms.delete = false;
                }
                if ((permission === 'edit' || permission === 'delete') && checked) {
                    updatedModulePerms.view = true;
                }
                newPermissions[mod.key] = updatedModulePerms;
            });
            return { ...prev, permissions: newPermissions };
        });
    };

    const getSelectAllState = (permission: keyof ModulePermissions): boolean | 'indeterminate' => {
        const selectedCount = activeModuleConfig
            .filter(mod => formData.permissions?.[mod.key]?.[permission])
            .length;
        
        if (selectedCount === 0) return false;
        if (selectedCount === activeModuleConfig.length) return true;
        return 'indeterminate';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="profileName">Nome do Perfil</Label>
                <Input
                    id="profileName"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    required
                />
            </div>
            <div className="space-y-2">
                <Label>Permissões dos Módulos</Label>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Módulo</TableHead>
                                <TableHead className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <Checkbox
                                            checked={getSelectAllState('view')}
                                            onCheckedChange={(checked) => handleSelectAll('view', checked === true)}
                                            id="select-all-view"
                                        />
                                        <Label htmlFor="select-all-view" className="cursor-pointer">Visualizar</Label>
                                    </div>
                                </TableHead>
                                <TableHead className="text-center">
                                     <div className="flex flex-col items-center gap-1">
                                        <Checkbox
                                            checked={getSelectAllState('edit')}
                                            onCheckedChange={(checked) => handleSelectAll('edit', checked === true)}
                                            id="select-all-edit"
                                        />
                                        <Label htmlFor="select-all-edit" className="cursor-pointer">Editar</Label>
                                    </div>
                                </TableHead>
                                <TableHead className="text-center">
                                     <div className="flex flex-col items-center gap-1">
                                        <Checkbox
                                            checked={getSelectAllState('delete')}
                                            onCheckedChange={(checked) => handleSelectAll('delete', checked === true)}
                                            id="select-all-delete"
                                        />
                                        <Label htmlFor="select-all-delete" className="cursor-pointer">Excluir</Label>
                                    </div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeModuleConfig.map(mod => (
                                <TableRow key={mod.key}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <mod.icon className="h-4 w-4"/> {mod.label}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={formData.permissions?.[mod.key]?.view ?? false}
                                            onCheckedChange={(checked) => handlePermissionChange(mod.key, 'view', checked === true)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={formData.permissions?.[mod.key]?.edit ?? false}
                                            onCheckedChange={(checked) => handlePermissionChange(mod.key, 'edit', checked === true)}
                                            disabled={!formData.permissions?.[mod.key]?.view}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={formData.permissions?.[mod.key]?.delete ?? false}
                                            onCheckedChange={(checked) => handlePermissionChange(mod.key, 'delete', checked === true)}
                                            disabled={!formData.permissions?.[mod.key]?.view}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <DialogFooter className="justify-between pt-4">
                <div>
                {profile?.id && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" type="button">Excluir</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                               <AlertDialogTitle>Excluir Perfil?</AlertDialogTitle>
                               <AlertDialogDescription>Esta ação é irreversível. O perfil será removido permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(profile.id)}>Sim, excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                    <Button type="submit">Salvar Perfil</Button>
                </div>
            </DialogFooter>
        </form>
    )
}



function TestDataSettings() {
    const { deleteTestData, user } = useAuth();
    const { toast } = useToast();
    const [isDeleted, setIsDeleted] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem('testDataDeleted') === 'true';
    });
    const [isDeleting, setIsDeleting] = useState(false);

    if (isDeleted) {
        return null;
    }

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            if (!user?.organizationId) {
                toast({ title: "Erro", description: "Organização não encontrada.", variant: "destructive" });
                return;
            }
            await deleteTestData(user.organizationId);
            toast({ title: "Sucesso!", description: "Todos os dados de teste foram excluídos." });
            localStorage.setItem('testDataDeleted', 'true');
            setIsDeleted(true);
        } catch (error) {
            console.error("Failed to delete test data", error);
            toast({ title: "Erro", description: "Não foi possível excluir os dados de teste.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle>Dados de Teste</CardTitle>
                <CardDescription>
                    Esta ação excluirá permanentemente todos os produtos, combos, kits, vendas e entradas de estoque da sua organização.
                    Use para limpar o ambiente de teste. Esta ação é irreversível e só pode ser executada uma vez.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="destructive" disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Excluir Dados de Teste
                         </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Todos os dados transacionais (produtos, vendas, combos, kits) serão removidos permanentemente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: "destructive" })}>
                                Sim, excluir tudo
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}


function SettingsPageContent() {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'users';
    const { user } = useAuth();
    
    if (!user?.enabledModules?.settings?.view) {
        return (
             <div className="flex h-full items-center justify-center">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2"><Lock /> Acesso Negado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Você não tem permissão para acessar a página de configurações.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Configurações</h1>
                <p className="text-muted-foreground">Gerencie as configurações gerais do sistema.</p>
            </div>
            <Tabs defaultValue={tab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="users">Usuários</TabsTrigger>
                    <TabsTrigger value="branches">Filiais</TabsTrigger>
                    <TabsTrigger value="payments">Pagamentos</TabsTrigger>
                    <TabsTrigger value="branding">Branding</TabsTrigger>
                    <TabsTrigger value="roles">Perfis &amp; Permissões</TabsTrigger>
                    {user?.enabledModules?.customers?.view && (
                        <TabsTrigger value="anamnesis">Anamnese</TabsTrigger>
                    )}
                </TabsList>
                <TabsContent value="users">
                   <UsersTable />
                </TabsContent>
                <TabsContent value="branches">
                   <BranchesSettings />
                </TabsContent>
                <TabsContent value="payments">
                    <PaymentConditions />
                </TabsContent>
                <TabsContent value="branding">
                    <BrandingSettings />
                </TabsContent>
                 <TabsContent value="roles">
                    <RolesSettings />
                </TabsContent>
                 {user?.enabledModules?.customers?.view && (
                    <TabsContent value="anamnesis">
                        <AnamnesisSettings />
                    </TabsContent>
                 )}
            </Tabs>
             <Separator />
            <TestDataSettings />
        </div>
    )
}

export default function SettingsPage() {
    return (
        <React.Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
            <SettingsPageContent />
        </React.Suspense>
    )
}

    
