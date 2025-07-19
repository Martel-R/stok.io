
'use client';

import { useState, useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import type { User, UserRole, Branch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';
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


function UserForm({ user, onSave, onDone }: { user?: User; onSave: (user: Partial<User>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { name: '', email: '', role: 'cashier', avatar: '/avatars/01.png' }
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleRoleChange = (role: UserRole) => {
        setFormData(prev => ({...prev, role}));
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
                <Label htmlFor="role">Função</Label>                 <Select value={formData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger id="role">
                        <SelectValue placeholder="Selecione uma função" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="cashier">Caixa</SelectItem>
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
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
            setUsers(usersData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge variant="destructive">Admin</Badge>;
            case 'manager':
                return <Badge variant="secondary">Gerente</Badge>;
            case 'cashier':
                return <Badge>Caixa</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    }
    
    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setIsFormOpen(true);
    }
    
    const handleSave = async (userToSave: Partial<User>) => {
        if (editingUser?.id) {
            try {
                const userRef = doc(db, "users", editingUser.id);
                await updateDoc(userRef, { role: userToSave.role });
                toast({ title: 'Função do usuário atualizada com sucesso!' });
            } catch (error) {
                console.error("Error updating user role: ", error);
                toast({ title: 'Erro ao atualizar usuário', variant: 'destructive' });
            }
        } else {
             toast({ title: 'Funcionalidade não implementada', description: 'Por favor, use a página de cadastro para criar novos usuários.', variant: 'destructive'});
        }
    };

    const handleDelete = (userId: string) => {
        toast({ title: 'Funcionalidade não implementada', description: 'A exclusão de usuários deve ser feita a partir de um ambiente seguro.', variant: 'destructive'});
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Usuários</CardTitle>
                        <CardDescription>Gerencie as permissões dos usuários.</CardDescription>
                    </div>
                     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogContent className="sm:max-w-[480px]">
                            <DialogHeader>
                                <DialogTitle>{editingUser ? 'Editar Função do Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
                            </DialogHeader>
                            <UserForm user={editingUser} onSave={handleSave} onDone={() => setIsFormOpen(false)} />
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
                            <TableHead>Função</TableHead>
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
                                    <TableCell>{getRoleBadge(user.role)}</TableCell>
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
                                                <DropdownMenuItem onClick={() => openEditDialog(user)}>Editar Função</DropdownMenuItem>
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
    const { branches, setCurrentBranch } = useAuth();
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        const fetchUsers = async () => {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            setAllUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User));
            setLoading(false);
        };
        fetchUsers();
    }, []);

    const openEditDialog = (branch: Branch) => {
        setEditingBranch(branch);
        setIsFormOpen(true);
    }

    const openNewDialog = () => {
        setEditingBranch(undefined);
        setIsFormOpen(true);
    }

    const handleSave = async (branchData: Omit<Branch, 'id'>) => {
        try {
            if (editingBranch?.id) {
                await updateDoc(doc(db, "branches", editingBranch.id), branchData);
                toast({ title: 'Filial atualizada com sucesso!' });
            } else {
                const docRef = await addDoc(collection(db, "branches"), branchData);
                toast({ title: 'Filial adicionada com sucesso!' });
                 // If this is the first branch, set it as active
                if(branches.length === 0) {
                    setCurrentBranch({id: docRef.id, ...branchData});
                }
            }
        } catch (error) {
            console.error("Error saving branch: ", error);
            toast({ title: 'Erro ao salvar filial', variant: 'destructive' });
        }
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
                <div className="flex justify-between items-center">
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

function BranchForm({ branch, users, onSave, onDone }: { branch?: Branch; users: User[]; onSave: (data: Omit<Branch, 'id'>) => void; onDone: () => void }) {
    const { user: currentUser } = useAuth();
    const [formData, setFormData] = useState(
        branch || { name: '', cnpj: '', location: '', userIds: currentUser ? [currentUser.id] : [] }
    );
    const [open, setOpen] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
        onSave(formData);
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


function StockSettings() {
    const [lowStockThreshold, setLowStockThreshold] = useState(50);
    const { toast } = useToast();

    const handleSave = () => {
        toast({
            title: "Configurações Salvas!",
            description: `O limite de estoque baixo foi definido para ${lowStockThreshold} unidades.`
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Regras de Estoque</CardTitle>
                <CardDescription>Defina os limites para os status de estoque dos produtos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="low-stock">Limite para Estoque Baixo</Label>
                    <Input 
                        id="low-stock" 
                        type="number" 
                        value={lowStockThreshold}
                        onChange={e => setLowStockThreshold(parseInt(e.target.value, 10))}
                        className="w-full md:w-1/3"
                    />
                    <p className="text-sm text-muted-foreground">
                        Produtos com quantidade igual ou inferior a este valor serão marcados como "Estoque Baixo".
                    </p>
                </div>
                 <Button onClick={handleSave}>Salvar Alterações</Button>
            </CardContent>
        </Card>
    )
}


function PaymentConditions() {
    type PaymentConditionType = 'credit' | 'debit' | 'cash' | 'pix';
    type FeeType = 'percentage' | 'fixed';

    interface PaymentCondition {
        id: string;
        name: string;
        type: PaymentConditionType;
        fee: number;
        feeType: FeeType;
    }
    
    const [conditions, setConditions] = useState<PaymentCondition[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCondition, setNewCondition] = useState({
        name: '',
        type: 'credit' as PaymentConditionType,
        fee: 0,
        feeType: 'percentage' as FeeType,
    });
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'paymentConditions'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentCondition));
            setConditions(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setNewCondition(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };
    
    const handleSelectChange = (name: string, value: string) => {
         setNewCondition(prev => ({ ...prev, [name]: value }));
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCondition.name.trim()) {
            toast({ title: 'O nome é obrigatório.', variant: 'destructive' });
            return;
        }
        try {
            await addDoc(collection(db, 'paymentConditions'), newCondition);
            setNewCondition({ name: '', type: 'credit', fee: 0, feeType: 'percentage' });
            toast({ title: 'Condição de pagamento adicionada!' });
        } catch (error) {
            toast({ title: 'Erro ao adicionar condição', variant: 'destructive' });
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
    
    const getTypeName = (type: PaymentConditionType) => {
        const names = { credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro', pix: 'Pix' };
        return names[type] || 'Desconhecido';
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Condições de Pagamento</CardTitle>
                <CardDescription>Gerencie as formas de pagamento aceitas no PDV, incluindo tipos e taxas.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
                    <div className="space-y-2 col-span-3 md:col-span-1">
                        <Label htmlFor="name">Nome da Condição</Label>
                        <Input 
                            id="name"
                            name="name"
                            value={newCondition.name} 
                            onChange={handleInputChange}
                            placeholder="Ex: Cartão de Débito"
                        />
                    </div>
                     <div className="space-y-2 col-span-3 md:col-span-1">
                        <Label htmlFor="type">Tipo</Label>
                        <Select name="type" value={newCondition.type} onValueChange={(value) => handleSelectChange('type', value)}>
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
                    <div className="space-y-2 col-span-3 md:col-span-1">
                        <Label htmlFor="fee">Taxa</Label>
                        <Input 
                            id="fee"
                            name="fee"
                            type="number"
                            step="0.01"
                            value={newCondition.fee} 
                            onChange={handleInputChange}
                            placeholder="Ex: 2.5"
                        />
                    </div>
                    <div className="space-y-2 col-span-3 md:col-span-1">
                         <Label>Tipo de Taxa</Label>
                         <RadioGroup
                            name="feeType"
                            value={newCondition.feeType}
                            onValueChange={(value) => handleSelectChange('feeType', value)}
                            className="flex items-center space-x-4"
                         >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="percentage" id="percentage" />
                                <Label htmlFor="percentage">% (Percentual)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="fixed" id="fixed" />
                                <Label htmlFor="fixed">R$ (Fixo)</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="col-span-3 md:col-span-2 flex items-end">
                       <Button type="submit" className="w-full md:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Adicionar</Button>
                    </div>
                </form>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                             <TableHead>Taxa</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                        ) : (
                            conditions.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell><Badge variant="outline">{getTypeName(c.type)}</Badge></TableCell>
                                    <TableCell>
                                        {c.fee > 0 
                                            ? `${c.fee.toLocaleString('pt-BR')} ${c.feeType === 'percentage' ? '%' : 'R$'}` 
                                            : 'Sem taxa'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
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

function SettingsPageContent() {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'users';

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
                    <TabsTrigger value="stock">Estoque</TabsTrigger>
                    <TabsTrigger value="payments">Pagamentos</TabsTrigger>
                </TabsList>
                <TabsContent value="users">
                   <UsersTable />
                </TabsContent>
                <TabsContent value="branches">
                   <BranchesSettings />
                </TabsContent>
                <TabsContent value="stock">
                    <StockSettings />
                </TabsContent>
                <TabsContent value="payments">
                    <PaymentConditions />
                </TabsContent>
            </Tabs>
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
