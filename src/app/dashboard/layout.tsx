'use client';

import { useAuth } from '@/lib/auth';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Home, Package, BarChart, ShoppingCart, Bot, Wrench, LogOut, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function DashboardNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    
    const navItems = [
        { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'manager'] },
        { href: '/dashboard/products', label: 'Products', icon: Package, roles: ['admin', 'manager'] },
        { href: '/dashboard/inventory', label: 'Inventory', icon: BarChart, roles: ['admin', 'manager'] },
        { href: '/dashboard/pos', label: 'POS', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
        { href: '/dashboard/assistant', label: 'AI Assistant', icon: Bot, roles: ['admin', 'manager'] },
        { href: '/dashboard/data-tools', label: 'Data Tools', icon: Wrench, roles: ['admin'] },
    ];

    return (
        <SidebarMenu>
            {navItems.filter(item => user && item.roles.includes(user.role)).map((item) => (
                <SidebarMenuItem key={item.href}>
                    <Link href={item.href} passHref>
                        <SidebarMenuButton isActive={pathname === item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
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
                        <span>Profile</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
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
            <div className="flex h-screen overflow-hidden">
                <Sidebar className="border-r">
                    <SidebarHeader className="p-4">
                        <div className="flex items-center gap-2">
                          <Icons.logo className="h-8 w-8 text-primary" />
                          <span className="text-xl font-semibold">InStockAI</span>
                        </div>
                    </SidebarHeader>
                    <SidebarContent className="p-2">
                       <DashboardNav />
                    </SidebarContent>
                    <SidebarFooter className="p-4">
                        {/* Footer content if any */}
                    </SidebarFooter>
                </Sidebar>
                <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
                    <header className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
                        <div className="md:hidden">
                            <SidebarTrigger />
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
        </SidebarProvider>
    );
}
