
'use client';

import { useAuth } from '@/lib/auth';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Home, Package, BarChart, ShoppingCart, Bot, FileText, LogOut, Loader2, Users, Settings, ChevronsUpDown, Check, Building, Gift } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useState } from 'react';

function DashboardNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    
    const navItems = [
        { href: '/dashboard', label: 'Início', icon: Home, roles: ['admin', 'manager'] },
        { href: '/dashboard/products', label: 'Produtos', icon: Package, roles: ['admin', 'manager'] },
        { href: '/dashboard/combos', label: 'Kits', icon: Gift, roles: ['admin', 'manager'] },
        { href: '/dashboard/inventory', label: 'Movimentação', icon: BarChart, roles: ['admin', 'manager'] },
        { href: '/dashboard/pos', label: 'Frente de Caixa', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
        { href: '/dashboard/assistant', label: 'Oráculo AI', icon: Bot, roles: ['admin', 'manager'] },
        { href: '/dashboard/reports', label: 'Relatórios', icon: FileText, roles: ['admin'] },
        { href: '/dashboard/settings', label: 'Ajustes', icon: Settings, roles: ['admin'] },
    ];

    const isActive = (href: string) => {
      if (href.includes('?')) {
        return pathname === href.split('?')[0] && window.location.search === '?' + href.split('?')[1];
      }
      return pathname === href;
    }

    return (
        <SidebarMenu>
            {navItems.filter(item => user && item.roles.includes(user.role)).map((item) => (
                <SidebarMenuItem key={item.href}>
                    <Link href={item.href} passHref>
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
                    <DropdownMenuItem>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Perfil</span>
                    </DropdownMenuItem>
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

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen">
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <Icons.logo className="h-8 w-8 text-primary" />
                        <span className="text-xl font-semibold">InStockAI</span>
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
                <main className="flex-1 p-4 md:p-6 lg:p-8">
                    {children}
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
