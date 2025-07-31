

'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, LayoutDashboard, LogOut, Loader2, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';


function PortalNav() {
    const pathname = usePathname();
    const navItems = [
        { href: '/portal', label: 'Início', icon: LayoutDashboard },
        { href: '/portal/appointments', label: 'Meus Agendamentos', icon: Calendar },
        { href: '/portal/profile', label: 'Meu Perfil', icon: User },
    ];

    return (
        <nav className="flex items-center space-x-4 lg:space-x-6">
            {navItems.map((item) => (
                 <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        "text-sm font-medium transition-colors hover:text-primary",
                        pathname === item.href ? "text-primary" : "text-muted-foreground"
                    )}
                 >
                    <item.icon className="mr-2 inline-block h-4 w-4" />
                    {item.label}
                 </Link>
            ))}
        </nav>
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
                <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}


function PortalLayoutContent({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    
    if (!user || user.role !== 'customer') {
        // This is a safeguard, the main redirection happens in AuthProvider
        return (
             <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center">
                    <div className="mr-4 flex items-center">
                        <Icons.logo className="mr-2 h-6 w-6 text-primary"/>
                        <span className="font-bold">Portal do Cliente</span>
                    </div>
                    <PortalNav />
                    <div className="flex flex-1 items-center justify-end space-x-4">
                        <UserNav />
                    </div>
                </div>
            </header>
            <main className="flex-1">
                <div className="container p-4 md:p-6 lg:p-8">
                    {children}
                </div>
            </main>
             <footer className="py-6 md:px-8 md:py-0 bg-muted">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                       Stokio &copy; {new Date().getFullYear()}
                    </p>
                </div>
            </footer>
        </div>
    )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return <PortalLayoutContent>{children}</PortalLayoutContent>;
}
