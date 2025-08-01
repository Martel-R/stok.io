// src/components/ui/sidebar.tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ScrollArea } from './scroll-area';

interface SidebarContextProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(undefined);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar deve ser usado dentro de um SidebarProvider');
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const Sidebar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isOpen, setIsOpen } = useSidebar();
    return (
      <>
        <aside
          ref={ref}
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform duration-300 ease-in-out md:translate-x-0',
            // Mobile-only transform
            isOpen ? 'translate-x-0' : '-translate-x-full',
            className
          )}
          {...props}
        />
        {/* Mobile overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </>
    );
  }
);
Sidebar.displayName = 'Sidebar';

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex h-16 shrink-0 items-center border-b px-4', className)} {...props} />
  )
);
SidebarHeader.displayName = 'SidebarHeader';

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
      return (
        <ScrollArea ref={ref} className={cn('flex-1', className)} {...props}>
            <div className="p-2">
                {children}
            </div>
        </ScrollArea>
      )
  }
);
SidebarContent.displayName = 'SidebarContent';

export const SidebarMenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <nav ref={ref} className={cn('flex flex-col gap-1', className)} {...props} />
  )
);
SidebarMenu.displayName = 'SidebarMenu';

export const SidebarMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
);
SidebarMenuItem.displayName = 'SidebarMenuItem';

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { isActive?: boolean }
>(({ className, isActive, children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn('w-full justify-start', className)}
      {...props}
    >
      {children}
    </Button>
  );
});
SidebarMenuButton.displayName = 'SidebarMenuButton';


export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
     return (
        <div ref={ref} className={cn('mt-auto border-t p-4', className)} {...props} />
     )
  }
);
SidebarFooter.displayName = 'SidebarFooter';
