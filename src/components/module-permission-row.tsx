
'use client';
import * as React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { ModulePermissions, EnabledModules } from '@/lib/types';
import { Home, Users, Briefcase, Calendar, Package, Gift, Component, BarChart, ShoppingCart, Bot, FileText, Settings, ArrowDownCircle, Archive, DollarSign } from 'lucide-react';

export const allModuleConfig = [
    { key: 'dashboard', label: 'Início', icon: Home },
    { key: 'customers', label: 'Clientes', icon: Users },
    { key: 'services', label: 'Serviços', icon: Briefcase },
    { key: 'appointments', label: 'Agendamentos', icon: Calendar },
    { key: 'products', label: 'Produtos', icon: Package },
    { key: 'combos', label: 'Combos', icon: Gift },
    { key: 'kits', label: 'Kits', icon: Component },
    { key: 'inventory', label: 'Estoque', icon: BarChart },
    { key: 'pos', label: 'Frente de Caixa', icon: ShoppingCart },
    { key: 'expenses', label: 'Despesas', icon: ArrowDownCircle },
    { key: 'assistant', label: 'Oráculo AI', icon: Bot },
    { key: 'reports', label: 'Relatórios', icon: FileText },
    { key: 'backup', label: 'Backup', icon: Archive },
    { key: 'settings', label: 'Configurações', icon: Settings },
    { key: 'subscription', label: 'Assinatura', icon: DollarSign },
] as const;


interface ModulePermissionRowProps {
    module: {
        key: keyof EnabledModules;
        label: string;
        icon: React.ElementType;
    };
    permissions?: ModulePermissions;
    onPermissionChange: (
        module: keyof EnabledModules, 
        permission: keyof ModulePermissions, 
        checked: boolean
    ) => void;
}

export function ModulePermissionRow({ module, permissions, onPermissionChange }: ModulePermissionRowProps) {
    const IconComponent = module.icon;
    const isViewEnabled = permissions?.view ?? false;

    return (
        <TableRow>
            <TableCell className="font-medium flex items-center gap-2">
                <IconComponent className="h-4 w-4"/> {module.label}
            </TableCell>
            <TableCell className="text-center">
                <Checkbox
                    checked={isViewEnabled}
                    onCheckedChange={(checked) => onPermissionChange(module.key, 'view', checked === true)}
                />
            </TableCell>
            <TableCell className="text-center">
                <Checkbox
                    checked={permissions?.edit ?? false}
                    onCheckedChange={(checked) => onPermissionChange(module.key, 'edit', checked === true)}
                    disabled={!isViewEnabled}
                />
            </TableCell>
            <TableCell className="text-center">
                <Checkbox
                    checked={permissions?.delete ?? false}
                    onCheckedChange={(checked) => onPermissionChange(module.key, 'delete', checked === true)}
                    disabled={!isViewEnabled}
                />
            </TableCell>
        </TableRow>
    );
}
