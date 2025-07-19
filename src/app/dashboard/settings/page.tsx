
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MOCK_USERS } from '@/lib/mock-data';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

function UsersTable() {
    const [users, setUsers] = useState<User[]>(MOCK_USERS);
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>Gerencie os usuários e suas permissões.</CardDescription>
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
                                     <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                          <span className="sr-only">Abrir menu</span>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => toast({title: 'Funcionalidade em desenvolvimento'})}>Editar</DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => toast({title: 'Funcionalidade em desenvolvimento'})}>Excluir</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
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
