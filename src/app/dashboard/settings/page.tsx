
'use client';

import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MOCK_USERS } from '@/lib/mock-data';
import type { User, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


function UserForm({ user, onSave, onDone }: { user?: User; onSave: (user: User) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { id: `user${Date.now()}`, name: '', email: '', role: 'cashier', avatar: '/avatars/01.png', password: '' }
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
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required={!isEditing} placeholder={isEditing ? "Deixe em branco para não alterar" : ""}/>
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
    const [users, setUsers] = useState<User[]>(MOCK_USERS);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const { toast } = useToast();

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
        setEditingUser({...user, password: ''}); // Clear password for editing form
        setIsFormOpen(true);
    }

    const openNewDialog = () => {
        setEditingUser(undefined);
        setIsFormOpen(true);
    }
    
    const handleSave = (userToSave: Partial<User>) => {
        setUsers((prev) => {
            const exists = prev.find((u) => u.id === userToSave.id);
            if (exists) {
                // If editing and password is empty, keep the old one
                if (!userToSave.password) {
                  userToSave.password = exists.password;
                }
                return prev.map((u) => (u.id === userToSave.id ? {...u, ...userToSave} as User : u));
            }
            // Ensure new user has a password, defaulting if necessary (though form requires it)
            if (!userToSave.password) {
              userToSave.password = 'password';
            }
            return [...prev, userToSave as User];
        });
        toast({ title: 'Usuário salvo com sucesso!'});
    };

    const handleDelete = (userId: string) => {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        toast({ title: 'Usuário excluído com sucesso!', variant: 'destructive'});
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Usuários</CardTitle>
                        <CardDescription>Gerencie os usuários e suas permissões.</CardDescription>
                    </div>
                     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openNewDialog}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Adicionar Usuário
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[480px]">
                            <DialogHeader>
                                <DialogTitle>{editingUser ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
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
                        {users.map((user) => (
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
                                                    Essa ação não pode ser desfeita. Isso excluirá permanentemente o usuário.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(user.id)} className={buttonVariants({ variant: "destructive" })}>Excluir</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                     </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
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
