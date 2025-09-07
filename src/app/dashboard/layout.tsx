

'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Home, Package, BarChart, ShoppingCart, Bot, FileText, LogOut, Loader2, Users, Settings, ChevronsUpDown, Check, Building, Gift, AlertTriangle, CreditCard, Component, LifeBuoy, Calendar, Briefcase, Menu, LogIn, ShieldAlert, ArrowDownCircle, Archive } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
import type { Organization } from '@/lib/types';

function DashboardNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    
    const navItems = [
        { href: '/dashboard', label: 'Início', icon: Home, module: 'dashboard' },
        { href: '/dashboard/appointments', label: 'Agendamentos', icon: Calendar, module: 'appointments' },
        { href: '/dashboard/customers', label: 'Clientes', icon: Users, module: 'customers' },
        { href: '/dashboard/services', label: 'Serviços', icon: Briefcase, module: 'services' },
        { href: '/dashboard/products', label: 'Produtos', icon: Package, module: 'products' },
        { href: '/dashboard/combos', label: 'Combos', icon: Gift, module: 'combos' },
        { href: '/dashboard/kits', label: 'Kits', icon: Component, module: 'kits' },
        { href: '/dashboard/inventory', label: 'Estoque', icon: BarChart, module: 'inventory' },
        { href: '/dashboard/pos', label: 'Frente de Caixa', icon: ShoppingCart, module: 'pos' },
        { href: '/dashboard/expenses', label: 'Despesas', icon: ArrowDownCircle, module: 'expenses'},
        { href: '/dashboard/assistant', label: 'Oráculo AI', icon: Bot, module: 'assistant' },
        { href: '/dashboard/reports', label: 'Relatórios', icon: FileText, module: 'reports' },
        { href: '/dashboard/settings', label: 'Configurações', icon: Settings, module: 'settings' },
        { href: '/dashboard/backup', label: 'Backup', icon: Archive, module: 'backup' },
        { href: '/dashboard/help', label: 'Ajuda & Tutorial', icon: LifeBuoy, module: 'dashboard' },
    ];

    const isActive = (href: string) => {
      if (href.includes('?')) {
        return pathname === href.split('?')[0] && window.location.search === '?' + href.split('?')[1];
      }
      return pathname === href;
    }
    
    const canViewModule = (module: string) => {
        if (!user?.enabledModules) return false;
        const moduleKey = module as keyof typeof user.enabledModules;
        return user.enabledModules[moduleKey]?.view ?? false;
    }


    return (
        <SidebarMenu>
            {navItems
                .filter(item => canViewModule(item.module))
                .map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <Link href={item.href}>
                            <SidebarMenuButton isActive={isActive(item.href)}>
                                <item.icon />
                                <span>{item.label}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                ))}
        </SidebarMenu>
    );
}

function BranchSwitcher() {
    const { user, branches, currentBranch, setCurrentBranch, organizations, startImpersonation } = useAuth();
    const [open, setOpen] = useState(false);
    const isSuperAdmin = user?.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[250px] justify-between"
                >
                     <Building className="mr-2 h-4 w-4 shrink-0" />
                     <div className="flex flex-col items-start text-left">
                        <span className="text-xs text-muted-foreground -mb-1">{user?.isImpersonating ? "Organização" : "Filial"}</span>
                        <span className="truncate font-semibold">{user?.isImpersonating ? user.organization?.name : currentBranch?.name || "Selecione a filial"}</span>
                     </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar..." />
                    <CommandList>
                        <CommandEmpty>Nenhum resultado.</CommandEmpty>
                        {isSuperAdmin && !user?.isImpersonating && organizations.length > 0 && (
                            <>
                                <CommandGroup heading="Organizações">
                                    {organizations.map((org) => (
                                        <CommandItem
                                            key={org.id}
                                            value={org.name}
                                            onSelect={() => {
                                                startImpersonation(org.id);
                                                setOpen(false);
                                            }}
                                        >
                                            <ShieldAlert className="mr-2 h-4 w-4" />
                                            {org.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                <CommandSeparator />
                            </>
                        )}
                        <CommandGroup heading="Filiais">
                            {branches.map((branch) => (
                                <CommandItem
                                    key={branch.id}
                                    value={branch.name}
                                    onSelect={() => {
                                        setCurrentBranch(branch);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentBranch?.id === branch.id ? "opacity-100" : "opacity-0")}/>
                                    {branch.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function UserNav() {
    const { user, logout } = useAuth();
    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <Link href="/dashboard/profile">
                        <DropdownMenuItem>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Perfil</span>
                        </DropdownMenuItem>
                    </Link>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function PaymentStatusBanner() {
    const { user } = useAuth();

    if (user?.paymentStatus === 'overdue') {
        return (
            <div className="bg-yellow-500 text-yellow-900 text-center p-2 text-sm font-semibold flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Seu plano de pagamento está vencido. Para evitar o bloqueio do sistema, por favor, regularize sua situação.</span>
            </div>
        )
    }
    
    return null;
}

function SystemLockedScreen() {
    const { user, logout } = useAuth();

    return (
        <div className="flex h-screen items-center justify-center bg-muted">
            <Card className="max-w-md text-center">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center justify-center gap-2">
                         <AlertTriangle className="h-6 w-6" />
                         Sistema Bloqueado
                    </CardTitle>
                    <CardDescription>
                        O acesso ao sistema foi temporariamente bloqueado por falta de pagamento.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>
                        Para reativar sua conta, o administrador da organização precisa entrar em contato com nosso suporte para regularizar a situação.
                    </p>
                </CardContent>
                 <CardFooter className="flex-col gap-4">
                    <Button onClick={logout} className="w-full">
                        <LogOut />
                        Sair
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}

function ImpersonationExitButton() {
    const { user, stopImpersonation } = useAuth();

    if (!user?.isImpersonating) {
        return null;
    }

    return (
        <Button onClick={stopImpersonation} variant="destructive" className="w-full">
            <LogOut className="mr-2" />
            Sair da Personificação
        </Button>
    )
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { setIsOpen } = useSidebar();

    useEffect(() => {
        if(user?.organization?.branding?.primaryColor) {
            document.documentElement.style.setProperty('--primary', user.organization.branding.primaryColor);
        } else {
             document.documentElement.style.removeProperty('--primary');
        }
        
        if (user?.organization?.name) {
             document.title = `Stokio - ${user.organization.name}`;
        } else {
             document.title = 'Stokio';
        }

    }, [user?.organization]);

    if(user?.paymentStatus === 'locked' && !user?.isImpersonating) {
        return <SystemLockedScreen />;
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <Icons.logo className="h-8 w-8 text-primary shrink-0" />
                        {user?.organization?.branding?.logoUrl && (
                             <>
                                <div className="h-6 w-px bg-border"></div>
                                <Image src={user.organization.branding.logoUrl} alt="Logo da Organização" width={32} height={32} className="h-8 w-8 object-contain"/>
                             </>
                        )}
                        <span className="text-xl font-semibold truncate">{user?.organization?.name || 'Stokio'}</span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <DashboardNav />
                </SidebarContent>
                <SidebarFooter>
                    <ImpersonationExitButton />
                </SidebarFooter>
            </Sidebar>
            <div className="flex flex-1 flex-col md:ml-64">
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
                    <div className="flex items-center gap-4">
                         <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setIsOpen(true)}
                        >
                            <Menu />
                            <span className="sr-only">Abrir Menu</span>
                        </Button>
                        <BranchSwitcher />
                    </div>
                    <div className="flex w-full items-center justify-end gap-4">
                        <UserNav />
                    </div>
                </header>
                <main className="flex-1">
                     <PaymentStatusBanner />
                     <div className="p-4 md:p-6 lg:p-8">
                        {children}
                     </div>
                </main>
            </div>
        </div>
    )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <SidebarProvider>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </SidebarProvider>
    );
}

