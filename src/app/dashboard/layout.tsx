

'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Home, Package, BarChart, ShoppingCart, Bot, FileText, LogOut, Loader2, Users, Settings, ChevronsUpDown, Check, Building, Gift, AlertTriangle, CreditCard, Component, LifeBuoy, Calendar, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

function DashboardNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    
    const navItems = [
        { href: '/dashboard', label: 'Início', icon: Home, roles: ['admin', 'manager'], module: 'dashboard' },
        { href: '/dashboard/appointments', label: 'Agendamentos', icon: Calendar, roles: ['admin', 'manager', 'professional'], module: 'appointments' },
        { href: '/dashboard/customers', label: 'Clientes', icon: Users, roles: ['admin', 'manager'], module: 'customers' },
        { href: '/dashboard/services', label: 'Serviços', icon: Briefcase, roles: ['admin', 'manager'], module: 'services' },
        { href: '/dashboard/products', label: 'Produtos', icon: Package, roles: ['admin', 'manager'], module: 'products' },
        { href: '/dashboard/combos', label: 'Combos', icon: Gift, roles: ['admin', 'manager'], module: 'combos' },
        { href: '/dashboard/kits', label: 'Kits', icon: Component, roles: ['admin', 'manager'], module: 'kits' },
        { href: '/dashboard/inventory', label: 'Movimentação', icon: BarChart, roles: ['admin', 'manager'], module: 'inventory' },
        { href: '/dashboard/pos', label: 'Frente de Caixa', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'], module: 'pos' },
        { href: '/dashboard/assistant', label: 'Oráculo AI', icon: Bot, roles: ['admin', 'manager'], module: 'assistant' },
        { href: '/dashboard/reports', label: 'Relatórios', icon: FileText, roles: ['admin'], module: 'reports' },
        { href: '/dashboard/settings', label: 'Ajustes', icon: Settings, roles: ['admin'], module: 'settings' },
        { href: '/dashboard/help', label: 'Ajuda & Tutorial', icon: LifeBuoy, roles: ['admin', 'manager', 'cashier', 'professional'], module: 'dashboard' },
    ];

    const isActive = (href: string) => {
      if (href.includes('?')) {
        return pathname === href.split('?')[0] && window.location.search === '?' + href.split('?')[1];
      }
      return pathname === href;
    }
    
    const isModuleEnabled = (module: string) => {
        if (!user?.enabledModules) return true; // Default to true if not set
        return user.enabledModules[module as keyof typeof user.enabledModules] ?? true;
    }


    return (
        <SidebarMenu>
            {navItems
                .filter(item => user && item.roles.includes(user.role))
                .filter(item => isModuleEnabled(item.module))
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
    const { branches, currentBranch, setCurrentBranch } = useAuth();
    const [open, setOpen] = useState(false);

    if (branches.length <= 1) {
        return (
            <div className="flex items-center gap-2 text-sm font-medium">
                <Building className="h-4 w-4" />
                <span>{currentBranch?.name || "Filial Principal"}</span>
            </div>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between"
                >
                     <Building className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{currentBranch?.name || "Selecione a filial"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar filial..." />
                    <CommandList>
                        <CommandEmpty>Nenhuma filial encontrada.</CommandEmpty>
                        <CommandGroup>
                            {branches.map((branch) => (
                                <CommandItem
                                    key={branch.id}
                                    value={branch.name}
                                    onSelect={() => {
                                        setCurrentBranch(branch);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentBranch?.id === branch.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
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

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    if(user?.paymentStatus === 'locked') {
        return <SystemLockedScreen />;
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <Icons.logo className="h-8 w-8 text-primary" />
                        <span className="text-xl font-semibold">Stokio</span>
                    </div>
                </SidebarHeader>
                <SidebarContent className="p-2">
                    <DashboardNav />
                </SidebarContent>
                <SidebarFooter>
                    {/* Conteúdo do rodapé, se houver */}
                </SidebarFooter>
            </Sidebar>
            <div className="flex flex-1 flex-col md:ml-64">
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
                    <div className="flex items-center gap-4">
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
