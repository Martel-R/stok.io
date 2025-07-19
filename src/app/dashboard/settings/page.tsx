
'use client';

import { useState, useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import type { User, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';


function UserForm({ user, onSave, onDone }: { user?: User; onSave: (user: Partial<User>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { name: '', email: '', role: 'cashier', avatar: '/avatars/01.png' }
    );
    const [showPassword, setShowPassword] = useState(false);

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
                <Label htmlFor="role">Função</Label>
                 <Select value={formData.role} onValueChange={handleRoleChange}>
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
    const { signup } = useAuth();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ ...doc.data() })) as User[];
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

    const openNewDialog = () => {
        setEditingUser(undefined);
        setIsFormOpen(true);
    }
    
    const handleSave = async (userToSave: Partial<User>) => {
        // We only support editing user roles for now.
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
            // Logic for creating new users is complex due to Firebase Auth security rules
            // and is better handled via a dedicated signup flow or backend function.
            // For this app, new users are created via the signup page.
             toast({ title: 'Funcionalidade não implementada', description: 'Por favor, use a página de cadastro para criar novos usuários.', variant: 'destructive'});
        }
    };

    const handleDelete = (userId: string) => {
        // Deleting users from Firebase Auth is a protected action and should be done from a secure backend environment.
        // We are not implementing this on the client-side for security reasons.
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
                        <DialogTrigger asChild>
                           {/* The button to add a user is removed as this should be done from signup page */}
                        </DialogTrigger>
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

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Configurações</h1>
                <p className="text-muted-foreground">Gerencie as configurações gerais do sistema.</p>
            </div>
            <Tabs defaultValue="users" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="users">Usuários</TabsTrigger>
                    <TabsTrigger value="stock">Estoque</TabsTrigger>
                    <TabsTrigger value="payments" disabled>Pagamentos</TabsTrigger>
                    <TabsTrigger value="units" disabled>Unidades</TabsTrigger>
                </TabsList>
                <TabsContent value="users">
                   <UsersTable />
                </TabsContent>
                <TabsContent value="stock">
                    <StockSettings />
                </TabsContent>
            </Tabs>
        </div>
    )
}
