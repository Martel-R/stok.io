
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
import type { User, Branch, PaymentCondition, PaymentConditionType, Product, EnabledModules, AnamnesisQuestion, AnamnesisQuestionType, BrandingSettings, PermissionProfile, ModulePermissions, Organization, Supplier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash2, Eye, EyeOff, Loader2, FileUp, ListChecks, Upload, Link as LinkIcon, Palette, SlidersHorizontal, Home, Users, Briefcase, Calendar, Package, Gift, Component, BarChart, ShoppingCart, Bot, FileText, Settings, View, Pencil, Trash, Lock, Truck, ArrowDownCircle } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';


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
        if (roleId === 'admin') return <Badge variant="default">Admin</Badge>;
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
                        supplierId: '',
                        supplierName: ''
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

    const handleSubmit = (e: React.EventFormEvent) => {
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


function PaymentConditionForm({ condition, onSave, onDone }: { condition?: PaymentCondition, onSave: (data: PartialPaymentCondition) => void, onDone: () => void }) {
    const [formData, setFormData] = useState(
        condition || { name: '', type: 'credit', fee: 0, feeType: 'percentage', maxInstallments: 12 }
    );
    
    const handleInputChange = (e: React.ChangeEvent) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };
    
    const handleSelectChange = (name: string, value: string) => {
         setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.EventFormEvent) => {
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
    const [conditions, setConditions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCondition, setEditingCondition] = useState(undefined);

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

    const handleSave = async (data: PartialPaymentCondition) => {
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

const typeNames: RecordAnamnesisQuestionType, string = {
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
    onSave: (data: PartialAnamnesisQuestion) => void; 
    onDone: () => void 
}) {
    const [formData, setFormData] = useState(question || { label: '', type: 'text' });
    
    const handleInputChange = (e: React.ChangeEvent) => {
        setFormData(prev => ({ ...prev, label: e.target.value }));
    };

    const handleTypeChange = (value: AnamnesisQuestionType) => {
        setFormData(prev => ({ ...prev, type: value }));
    };

    const handleSubmit = (e: React.EventFormEvent) => {
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
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(undefined);
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

    const handleSave = async (data: PartialAnamnesisQuestion) => {
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

    const handleImport = async (importedQuestions: OmitAnamnesisQuestion, 'id' | 'organizationId' | 'order'>[]) => {
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
                        
                             
                                 
                                    Importar
                                
                            
                        
                        
                            
                                 Adicionar Pergunta
                            
                             
                                
                                    {editingQuestion ? 'Editar Pergunta' : 'Adicionar Pergunta'}
                                
                                
                                    
                                        
                                            
                                            
                                        
                                    
                                
                            
                        
                    
                
            CardContent>
                 
                    
                        
                            Pergunta
                            Tipo
                            Ações
                        
                    
                    
                         {loading ? (
                            Array.from({length: 3}).map((_, i) => (
                                
                                    
                                
                            ))
                        ) : questions.length > 0 ? (
                            questions.map(q => (
                                
                                    {q.label}
                                    
                                        {typeNames[q.type] || 'Desconhecido'}
                                    
                                    
                                         
                                             
                                                 
                                                     
                                                         
                                                         
                                                     
                                                     
                                                          Editar
                                                          
                                                      
                                                       
                                                          Excluir
                                                     
                                                
                                             
                                             
                                                
                                                    Excluir Pergunta?
                                                    Essa ação é irreversível.
                                                
                                                
                                                    Cancelar
                                                    
                                                        Sim, excluir
                                                    
                                                
                                             
                                         
                                    
                                
                            ))
                        ) : (
                             
                                 Nenhuma pergunta encontrada.
                             
                        )}
                    
                
            
        
    );
}

function BrandingSettings() {
    const { user, updateOrganizationBranding } = useAuth();
    const [branding, setBranding] = useState({
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

    const handleImageUpload = (e: React.ChangeEvent) => {
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

    const handleColorChange = (e: React.ChangeEvent) => {
        const { value } = e.target;
        // Basic HSL validation
        if (/^\d1,3\s\d1,3%\s\d1,3%$/.test(value)) {
            setBranding(prev => ({...prev, primaryColor: value}));
        } else {
             setBranding(prev => ({...prev, primaryColor: value}));
        }
    }
    
    const handleSubmit = async (e: React.EventFormEvent) => {
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
        
            
                Branding da Organização
                Personalize a aparência do sistema com a identidade visual da sua marca.
            
            
                
                    
                        
                            Logo
                            Cores
                        
                        
                             
                                URL do Logo
                                
                                     placeholder="https://exemplo.com/logo.png" 
                                
                            
                        
                        
                             
                                Cor Primária (HSL)
                                
                                     placeholder="Ex: 231 48% 48%"
                                
                                Insira o valor no formato HSL sem vírgulas. Ex:  231 48% 48%
                            
                        
                    

                    {branding.logoUrl && (
                        
                            Pré-visualização do Logo
                            
                                
                                
                            
                        
                    )}
                    
                    
                        {isSaving   }
                        Salvar Branding
                    
                
            
        
    );
}

function RolesSettings() {
    const { user } = useAuth();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState(undefined);
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

    const handleSave = async (profileData: PartialPermissionProfile) => {
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
        
            
                
                    
                        Perfis e Permissões
                        Crie perfis de usuário e defina quais módulos cada um pode acessar.
                    
                     Adicionar Perfil
                
            
            
                
                    
                        Nome do Perfil
                        Permissões
                        Ações
                    
                    
                        {loading ? (
                             
                        ) : profiles.map(profile => (
                             
                                {profile.name}
                                
                                    {Object.entries(profile.permissions)
                                        .filter(([, perms]) => perms.view)
                                        .map(([key]) => (
                                        {key}
                                    ))}
                                
                                
                                    
                                
                            
                        ))}
                    
                

                 
                     
                         
                             {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
                         
                         
                             
                                 
                                 
                                 
                                 
                             
                         
                     
                 
            
        
    );
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
        
            
                Dados de Teste
                Esta ação excluirá permanentemente todos os produtos, combos, kits, vendas e entradas de estoque da sua organização.
                Use para limpar o ambiente de teste. Esta ação é irreversível e só pode ser executada uma vez.
            
            
                
                     
                         
                            
                                Você tem certeza absoluta?
                                Esta ação não pode ser desfeita. Todos os dados transacionais (produtos, vendas, combos, kits) serão removidos permanentemente.
                            
                         
                         
                            
                                Cancelar
                                
                                    Sim, excluir tudo
                                
                            
                         
                     
                
            
        
    );
}

function SettingsPageContent() {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'users';
    const { user } = useAuth();
    
    if (!user?.enabledModules?.settings?.view) {
        return (
             
                
                    
                         Acesso Negado
                    
                    
                        Você não tem permissão para acessar a página de configurações.
                    
                
            
        );
    }

    return (
        
            
                
                    
                        Configurações
                        Gerencie as configurações gerais do sistema.
                    
                
                
                    
                        
                            Usuários
                            Filiais
                            Fornecedores
                            Pagamentos
                            Branding
                            Perfis &amp; Permissões
                            {user?.enabledModules?.customers?.view && (
                                Anamnese
                            )}
                        
                        
                           
                        
                        
                           
                        
                        
                           
                        
                        
                           
                        
                        
                           
                        
                         {user?.enabledModules?.customers?.view && (
                            
                        )}
                    
                
             
            
        
    )
}

function SupplierForm({ 
    supplier, 
    products,
    onSave, 
    onDone 
}: { 
    supplier?: Supplier; 
    products: Product[];
    onSave: (data: PartialSupplier, productsToLink: string[], productsToUnlink: string[]) => void; 
    onDone: () => void 
}) {
    const [formData, setFormData] = useState({ name: '', contactName: '', phone: '', email: '', address: '' });
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [initialProductIds, setInitialProductIds] = useState([]);

    useEffect(() => {
        if (supplier) {
            setFormData(supplier);
            const linkedIds = products.filter(p => p.supplierId === supplier.id).map(p => p.id);
            setSelectedProductIds(linkedIds);
            setInitialProductIds(linkedIds);
        } else {
            setFormData({ name: '', contactName: '', phone: '', email: '', address: '' });
            setSelectedProductIds([]);
            setInitialProductIds([]);
        }
    }, [supplier, products]);

    const handleChange = (e: React.ChangeEvent) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };
    
    const handleProductSelection = (productId: string) => {
        setSelectedProductIds(prev => 
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    }
    
    const handleSubmit = (e: React.EventFormEvent) => {
        e.preventDefault();
        const productsToLink = selectedProductIds.filter(id => !initialProductIds.includes(id));
        const productsToUnlink = initialProductIds.filter(id => !selectedProductIds.includes(id));
        onSave(formData, productsToLink, productsToUnlink);
    }

    return (
         
            
                
                    Nome do Fornecedor
                    
                         placeholder="Nome do Fornecedor" required 
                    
                
                
                    
                        
                            Nome do Contato
                            
                                 placeholder="Nome do Contato" 
                            
                        
                        
                            Telefone
                            
                                 placeholder="Telefone" 
                            
                        
                    
                     
                        Email
                        
                             placeholder="Email" 
                        
                    
                    
                        Endereço
                        
                             placeholder="Endereço" 
                        
                    
                

                
                    Produtos Vinculados
                    
                        
                            
                            
                                {products.map(product => (
                                    
                                        
                                             
                                            
                                            {product.name}
                                        
                                    
                                ))}
                            
                        
                    
                
            
            
                
                    Cancelar
                    Salvar Fornecedor
                
            
        
    )
}

function SuppliersSettings() {
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(undefined);
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();
    
    useEffect(() => {
        if (!user?.organizationId) return;

        const qSuppliers = query(collection(db, 'suppliers'), where('organizationId', '==', user.organizationId));
        const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
            setLoading(false);
        });

        if (currentBranch?.id) {
            const qProducts = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
            const unsubProducts = onSnapshot(qProducts, (snapshot) => {
                setProducts(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Product)));
            });
            return () => { unsubSuppliers(); unsubProducts(); };
        }

        return () => unsubSuppliers();
    }, [user, currentBranch]);

    const handleSave = async (data: PartialSupplier, productsToLink: string[], productsToUnlink: string[]) => {
        if (!user?.organizationId || !currentBranch?.id) return;
        
        const isEditing = !!editingSupplier;
        const supplierId = editingSupplier?.id || doc(collection(db, 'suppliers')).id;

        const batch = writeBatch(db);

        // 1. Save supplier data
        const supplierRef = doc(db, "suppliers", supplierId);
        if (isEditing) {
            batch.update(supplierRef, data);
        } else {
            batch.set(supplierRef, { ...data, id: supplierId, organizationId: user.organizationId });
        }
        
        // 2. Link products
        productsToLink.forEach(productId => {
            const productRef = doc(db, 'products', productId);
            batch.update(productRef, { supplierId: supplierId, supplierName: data.name });
        });

        // 3. Unlink products
        productsToUnlink.forEach(productId => {
            const productRef = doc(db, 'products', productId);
            batch.update(productRef, { supplierId: '', supplierName: '' });
        });

        try {
            await batch.commit();
            toast({ title: `Fornecedor ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!` });
            setIsFormOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao salvar fornecedor', variant: 'destructive' });
        }
    };
    
    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, "suppliers", id));
            toast({ title: 'Fornecedor excluído!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir fornecedor', variant: 'destructive' });
        }
    };

    return (
        
            
                 
                    
                        Fornecedores
                        Gerencie os fornecedores dos seus produtos.
                    
                    Adicionar Fornecedor
                
            
            
                 
                    
                        Nome
                        Contato
                        Telefone
                        Email
                        Ações
                    
                    
                        {loading   
                               {s.name}
                                {s.contactName}
                                {s.phone}
                                {s.email}
                                
                                     
                                         
                                             Editar
                                             Excluir
                                         
                                     
                                 
                            
                        ))}
                    
                
            

                 
                     
                         
                             {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                         
                         
                             
                                 
                                 
                                 
                                 
                             
                         
                     
                 
            
        
    )
}

export default function SettingsPage() {
    return (
        
            
        
    )
}
