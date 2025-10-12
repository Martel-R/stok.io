
'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, LayoutDashboard, LogOut, Loader2, User, History, FileText, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';


function PortalNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    
    const navItems = [
        { href: '/portal', label: 'Início', icon: LayoutDashboard, module: 'customers' },
        { href: '/portal/request-appointment', label: 'Solicitar Agendamento', icon: Calendar, module: 'appointments' },
        { href: '/portal/appointments', label: 'Meus Agendamentos', icon: History, module: 'appointments' },
        { href: '/portal/anamnesis', label: 'Anamnese', icon: FileText, module: 'customers' },
        { href: '/portal/profile', label: 'Meu Perfil', icon: User, module: 'customers' },
    ];

    const canViewModule = (module: string) => {
        if (!user?.enabledModules) return false;
        const moduleKey = module as keyof typeof user.enabledModules;
        return user.enabledModules[moduleKey]?.view ?? false;
    }

    return (
        <nav className="grid items-start gap-2">
            {navItems
                .filter(item => canViewModule(item.module))
                .map((item) => (
                 <Link
                    key={item.href}
                    href={item.href}
                 >
                    <span className={cn(
                        "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                        pathname === item.href ? "bg-accent" : "transparent"
                    )}>
                         <item.icon className="mr-2 h-4 w-4" />
                         <span>{item.label}</span>
                    </span>
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
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
            <div className="hidden border-r bg-muted/40 md:block">
                <div className="flex h-full max-h-screen flex-col gap-2">
                    <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                        <Link href="/portal" className="flex items-center gap-2 font-semibold">
                             <Icons.logo className="mr-2 h-6 w-6 text-primary"/>
                            <span className="">Portal do Cliente</span>
                        </Link>
                    </div>
                    <div className="flex-1">
                        <PortalNav />
                    </div>
                </div>
            </div>
            <div className="flex flex-col">
                 <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
                    {/* Mobile nav can be added here if needed */}
                    <div className="w-full flex-1">
                        {/* Can add search or other header items */}
                    </div>
                    <UserNav />
                </header>
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                     {children}
                </main>
            </div>
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
