
// src/app/super-admin/page.tsx
'use client';
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Organization, User, PaymentStatus, PricingPlan } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Loader2, ShieldAlert, Trash2, SlidersHorizontal, Users, DollarSign, Pencil, LogIn, Search, Filter, TrendingUp, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

// Novos componentes refatorados
import { PricingPlansSettings } from './_components/pricing-plans-settings';
import { SubscriptionDialog } from './_components/subscription-dialog';
import { ModulesSettingsDialog, OrgUsersDialog, OrgProfilesDialog } from './_components/org-management-dialogs';
import { AdminInsights } from './_components/admin-insights';
import { filterOrganizations, calculateStats, exportOrganizationData } from './super-admin.utils';
import { toDate } from '@/lib/utils';

type OrgWithUser = Organization & { owner?: User };

export default function SuperAdminPage() {
    const { user, loading: authLoading, startImpersonation } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [organizations, setOrganizations] = useState<OrgWithUser[]>([]);
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Estado para Diálogos
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [dialogs, setDialogs] = useState({
        modules: false,
        users: false,
        profiles: false,
        subscription: false
    });

    const selectedOrg = useMemo(() => 
        organizations.find(org => org.id === selectedOrgId) || null
    , [organizations, selectedOrgId]);

    const handleExportBackup = async (org: OrgWithUser) => {
        setIsExporting(org.id);
        try {
            await exportOrganizationData(org.id, org.name);
            toast({ title: 'Backup concluído!', description: `O arquivo Excel de "${org.name}" foi gerado.` });
        } catch (error) {
            console.error("Erro no backup:", error);
            toast({ title: 'Erro no backup', description: 'Não foi possível exportar os dados.', variant: 'destructive' });
        } finally {
            setIsExporting(null);
        }
    };

    // Redirecionamento de segurança
    useEffect(() => {
        if (!authLoading && user && user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL && !user.isImpersonating) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    // Carregamento de dados
    useEffect(() => {
        if (user && user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
            const unsubscribeOrgs = onSnapshot(collection(db, 'organizations'), async (orgSnapshot) => {
                const orgsData = orgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
                const usersSnapshot = await getDocs(query(collection(db, 'users')));
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

                const orgsWithUsers = orgsData.map(org => ({ 
                    ...org, 
                    owner: usersData.find(u => u.id === org.ownerId) 
                }));
                
                setOrganizations(orgsWithUsers);
                setLoading(false);
            });

            const unsubscribePlans = onSnapshot(collection(db, 'pricingPlans'), (snapshot) => {
                setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PricingPlan)));
            });

            return () => {
                unsubscribeOrgs();
                unsubscribePlans();
            };
        }
    }, [user]);

    // Métricas para o Dashboard
    const stats = useMemo(() => calculateStats(organizations), [organizations]);

    // Filtro de organizações
    const filteredOrgs = useMemo(() => 
        filterOrganizations(organizations, searchTerm, statusFilter)
    , [organizations, searchTerm, statusFilter]);

    const handleStatusChange = async (orgId: string, status: PaymentStatus) => {
        await updateDoc(doc(db, 'organizations', orgId), { paymentStatus: status });
        toast({ title: 'Status atualizado com sucesso!' });
    };
    
    const handleDeleteOrganization = async (orgId: string) => {
        if (!orgId || orgId !== selectedOrg?.id) {
            toast({ title: 'Erro de validação', description: 'O ID da organização é inválido ou não corresponde à seleção.', variant: 'destructive' });
            return;
        }

        // Lista exaustiva de todas as coleções que possuem o campo 'organizationId'
        const collectionsToDelete = [
            'users', 'branches', 'products', 'combos', 'kits', 'sales', 
            'stockEntries', 'paymentConditions', 'permissionProfiles', 
            'anamnesisQuestions', 'customers', 'attendances', 'appointments', 
            'services', 'expenses', 'clinicalRecords', 'formTemplates', 
            'customerFormTemplates'
        ];

        try {
            const batch = writeBatch(db);
            
            // O loop garante isolamento total: apenas documentos vinculados ao orgId são selecionados
            for (const collectionName of collectionsToDelete) {
                const q = query(collection(db, collectionName), where("organizationId", "==", orgId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => batch.delete(doc.ref));
            }

            // Por fim, deleta o documento principal da organização
            batch.delete(doc(db, 'organizations', orgId));
            
            await batch.commit();
            
            toast({ title: 'Organização excluída!', description: `Todos os dados de "${selectedOrg.name}" foram removidos com segurança.` });
            setIsDeleteDialogOpen(false);
            setSelectedOrgId(null);
        } catch (error) {
            console.error("Erro na deleção atômica:", error);
            toast({ title: 'Erro ao excluir organização', description: 'Ocorreu uma falha na deleção em massa.', variant: 'destructive' });
        }
    };

    const getStatusBadge = (status: PaymentStatus) => {
        const configs = { 
            active: { label: "Ativo", class: "bg-green-100 text-green-800 border-green-200" }, 
            overdue: { label: "Vencido", class: "bg-amber-100 text-amber-800 border-amber-200" }, 
            locked: { label: "Bloqueado", class: "bg-red-100 text-red-800 border-red-200" } 
        };
        const config = configs[status] || { label: status, class: "" };
        return <Badge variant="outline" className={config.class}>{config.label}</Badge>;
    }
    
    const openDialog = (org: OrgWithUser, type: keyof typeof dialogs) => {
        setSelectedOrgId(org.id);
        setTimeout(() => {
            setDialogs(prev => ({ ...prev, [type]: true }));
        }, 100);
    };

    const openDeleteAlert = (org: OrgWithUser) => {
        setSelectedOrgId(org.id);
        setTimeout(() => {
            setIsDeleteDialogOpen(true);
        }, 100);
    };

    if (authLoading || !user || user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-muted/30">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Autenticando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-destructive/10 p-3 rounded-xl">
                            <ShieldAlert className="h-8 w-8 text-destructive" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Painel Super Admin</h1>
                            <p className="text-muted-foreground">Visão geral do sistema Stok.io</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-background px-3 py-1">
                            {user.email}
                        </Badge>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-primary">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-muted-foreground">MRR (Receita Recorrente)</p>
                                <TrendingUp className="h-4 w-4 text-primary" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <p className="text-3xl font-bold">R$ {stats.mrr?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-xs text-muted-foreground">mensal</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-muted-foreground">Organizações Ativas</p>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <p className="text-3xl font-bold">{stats.active}</p>
                                <p className="text-xs text-muted-foreground">{((stats.active/stats.total)*100 || 0).toFixed(0)}% do total</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-muted-foreground">Valor em Atraso</p>
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-amber-600">R$ {stats.overdueRevenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-xs text-muted-foreground">{stats.overdue} orgs. pendentes</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-red-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-muted-foreground">Bloqueadas / Inativas</p>
                                <ShieldAlert className="h-4 w-4 text-red-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <p className="text-3xl font-bold">{stats.locked}</p>
                                <p className="text-xs text-muted-foreground">acesso suspenso</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <Tabs defaultValue="organizations" className="w-full">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                <TabsList>
                                    <TabsTrigger value="organizations">Organizações</TabsTrigger>
                                    <TabsTrigger value="plans">Planos Globais</TabsTrigger>
                                    <TabsTrigger value="insights">Relatórios & Insights</TabsTrigger>
                                </TabsList>
                                
                                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar organização ou dono..."
                                            className="pl-9"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-full sm:w-[150px]">
                                            <div className="flex items-center gap-2">
                                                <Filter className="h-3.5 w-3.5" />
                                                <SelectValue placeholder="Status" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos Status</SelectItem>
                                            <SelectItem value="active">Ativos</SelectItem>
                                            <SelectItem value="overdue">Vencidos</SelectItem>
                                            <SelectItem value="locked">Bloqueados</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <TabsContent value="organizations" className="m-0">
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="font-semibold">Organização</TableHead>
                                                <TableHead className="font-semibold">Proprietário</TableHead>
                                                <TableHead className="font-semibold">Status Pag.</TableHead>
                                                <TableHead className="font-semibold">Próx. Vencimento</TableHead>
                                                <TableHead className="font-semibold">Acesso Rápido</TableHead>
                                                <TableHead className="text-right font-semibold">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">
                                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredOrgs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                        Nenhuma organização encontrada.
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredOrgs.map((org) => (
                                                <TableRow key={org.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-semibold py-4">{org.name}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{org.owner?.name || 'N/A'}</span>
                                                            <span className="text-xs text-muted-foreground">{org.owner?.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{getStatusBadge(org.paymentStatus)}</TableCell>
                                                    <TableCell>
                                                        {org.subscription?.paymentRecords
                                                            ?.filter(p => p.status === 'pending')
                                                            .sort((a,b) => toDate(a.date)!.getTime() - toDate(b.date)!.getTime())
                                                            [0] 
                                                            ? format(toDate(org.subscription.paymentRecords.find(p => p.status === 'pending')!.date)!, 'dd/MM/yyyy') 
                                                            : <Badge variant="secondary" className="font-normal opacity-50">N/A</Badge>
                                                        }
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="outline" size="sm" onClick={() => startImpersonation(org.id)} className="h-8 gap-2 hover:bg-primary hover:text-primary-foreground transition-all">
                                                            <LogIn className="h-3.5 w-3.5"/>
                                                            Acessar Painel
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56">
                                                                <DropdownMenuLabel>Gestão Financeira</DropdownMenuLabel>
                                                                
                                                                <DropdownMenuSub>
                                                                    <DropdownMenuSubTrigger>
                                                                        <div className="flex items-center">
                                                                            <TrendingUp className="mr-2 h-4 w-4" />
                                                                            <span>Mudar Status</span>
                                                                        </div>
                                                                    </DropdownMenuSubTrigger>
                                                                    <DropdownMenuPortal>
                                                                        <DropdownMenuSubContent>
                                                                            <DropdownMenuItem onSelect={() => handleStatusChange(org.id, 'active')}>
                                                                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Ativo
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => handleStatusChange(org.id, 'overdue')}>
                                                                                <AlertCircle className="mr-2 h-4 w-4 text-amber-500" /> Vencido
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => handleStatusChange(org.id, 'locked')}>
                                                                                <ShieldAlert className="mr-2 h-4 w-4 text-red-500" /> Bloqueado
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuSubContent>
                                                                    </DropdownMenuPortal>
                                                                </DropdownMenuSub>

                                                                <DropdownMenuItem onSelect={() => openDialog(org, 'subscription')}>
                                                                    <DollarSign className="mr-2 h-4 w-4" /> Assinatura e Parcelas
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem 
                                                                    onSelect={() => handleExportBackup(org)}
                                                                    disabled={isExporting === org.id}
                                                                >
                                                                    {isExporting === org.id ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Download className="mr-2 h-4 w-4" />
                                                                    )}
                                                                    Exportar Backup (Excel)
                                                                </DropdownMenuItem>

                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                                                                <DropdownMenuItem onSelect={() => openDialog(org, 'users')}>
                                                                    <Users className="mr-2 h-4 w-4" /> Usuários da Org
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openDialog(org, 'profiles')}>
                                                                    <Pencil className="mr-2 h-4 w-4" /> Perfis de Acesso
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => openDialog(org, 'modules')}>
                                                                    <SlidersHorizontal className="mr-2 h-4 w-4" /> Módulos Habilitados
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onSelect={() => openDeleteAlert(org)} className="text-destructive focus:text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir Organização
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="plans" className="m-0 pt-4">
                                <PricingPlansSettings />
                            </TabsContent>

                            <TabsContent value="insights" className="m-0 pt-4">
                                <AdminInsights organizations={organizations} plans={plans} />
                            </TabsContent>
                        </Tabs>
                    </CardHeader>
                </Card>
            </div>

            {/* Renderização condicional de diálogos para performance */}
            {selectedOrg && (
                <>
                    <ModulesSettingsDialog 
                        organization={selectedOrg} 
                        isOpen={dialogs.modules} 
                        onOpenChange={(open) => setDialogs(p => ({...p, modules: open}))} 
                    />
                    <OrgUsersDialog 
                        organization={selectedOrg} 
                        isOpen={dialogs.users} 
                        onOpenChange={(open) => setDialogs(p => ({...p, users: open}))} 
                    />
                    <OrgProfilesDialog 
                        organization={selectedOrg} 
                        isOpen={dialogs.profiles} 
                        onOpenChange={(open) => setDialogs(p => ({...p, profiles: open}))} 
                    />
                    <SubscriptionDialog 
                        organization={selectedOrg} 
                        isOpen={dialogs.subscription} 
                        onOpenChange={(open) => setDialogs(p => ({...p, subscription: open}))} 
                        adminUser={user}
                    />
                    
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Deseja realmente excluir a organização <strong>{selectedOrg.name}</strong> e todos os seus dados? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteOrganization(selectedOrg.id)} className={buttonVariants({ variant: "destructive" })}>Sim, excluir tudo</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    );
}
