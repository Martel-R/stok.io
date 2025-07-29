// src/app/super-admin/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import type { Organization, User, PaymentStatus } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type OrgWithUser = Organization & { owner?: User };

function SuperAdminPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [organizations, setOrganizations] = useState<OrgWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Check for super admin access
    useEffect(() => {
        if (!authLoading) {
            if (!user || user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
                router.push('/dashboard');
            }
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user && user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
            const unsubscribeOrgs = onSnapshot(collection(db, 'organizations'), async (orgSnapshot) => {
                const orgsData = orgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

                const orgsWithUsers = orgsData.map(org => ({
                    ...org,
                    owner: usersData.find(u => u.id === org.ownerId)
                }));
                
                setOrganizations(orgsWithUsers);
                setLoading(false);
            });
            return () => unsubscribeOrgs();
        }
    }, [user]);

    const handleStatusChange = async (orgId: string, status: PaymentStatus) => {
        const orgRef = doc(db, 'organizations', orgId);
        try {
            await updateDoc(orgRef, { paymentStatus: status });
            toast({ title: 'Status atualizado com sucesso!' });
        } catch (error) {
            toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
        }
    };
    
    const handleDeleteOrganization = async (orgId: string) => {
        const collectionsToDelete = ['users', 'branches', 'products', 'combos', 'kits', 'sales', 'stockEntries', 'paymentConditions'];
        try {
            const batch = writeBatch(db);

            // Delete documents from related collections
            for (const collectionName of collectionsToDelete) {
                const q = query(collection(db, collectionName), where("organizationId", "==", orgId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }

            // Delete the organization itself
            batch.delete(doc(db, 'organizations', orgId));

            await batch.commit();
            toast({ title: 'Organização e todos os dados vinculados foram excluídos!', variant: 'destructive' });
        } catch (error) {
            console.error("Error deleting organization:", error);
            toast({ title: 'Erro ao excluir organização', description: 'Não foi possível completar a operação.', variant: 'destructive' });
        }
    };

    const getStatusBadge = (status: PaymentStatus) => {
        switch (status) {
            case 'active': return <Badge variant="secondary" className="bg-green-100 text-green-800">Ativo</Badge>;
            case 'overdue': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Vencido</Badge>;
            case 'locked': return <Badge variant="destructive">Bloqueado</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    }

    if (authLoading || loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!user || user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
         return null; // or a dedicated access denied component
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
                        <TableHeader>
                            <TableRow>
                                <TableHead>Organização</TableHead>
                                <TableHead>Proprietário</TableHead>
                                <TableHead>Email do Proprietário</TableHead>
                                <TableHead>Status do Pagamento</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {organizations.map((org) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell>{org.owner?.name || 'Não encontrado'}</TableCell>
                                    <TableCell>{org.owner?.email || 'Não encontrado'}</TableCell>
                                    <TableCell>{getStatusBadge(org.paymentStatus)}</TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                     <div className="p-2">
                                                        <Select defaultValue={org.paymentStatus} onValueChange={(status: PaymentStatus) => handleStatusChange(org.id, status)}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Mudar Status" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="active">Ativo</SelectItem>
                                                                <SelectItem value="overdue">Vencido</SelectItem>
                                                                <SelectItem value="locked">Bloqueado</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                     </div>
                                                    <DropdownMenuSeparator />
                                                     <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Excluir Organização
                                                        </DropdownMenuItem>
                                                     </AlertDialogTrigger>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir "{org.name}"?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Essa ação é irreversível e excluirá a organização, todos os usuários, filiais, produtos, vendas e outros dados associados.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteOrganization(org.id)} className={buttonVariants({ variant: "destructive" })}>
                                                        Sim, excluir tudo
                                                    </AlertDialogAction>
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
        </div>
    );
}

export default SuperAdminPage;
