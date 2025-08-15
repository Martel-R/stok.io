
'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { PermissionProfile, EnabledModules, ModulePermissions, Organization } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Home, Users, Briefcase, Calendar, Package, Gift, Component, BarChart, ShoppingCart, Bot, FileText, Settings } from 'lucide-react';
import { ModulePermissionRow } from '@/components/module-permission-row';

const allModuleConfig = [
    { key: 'dashboard', label: 'Início', icon: Home },
    { key: 'customers', label: 'Clientes', icon: Users },
    { key: 'services', label: 'Serviços', icon: Briefcase },
    { key: 'appointments', label: 'Agendamentos', icon: Calendar },
    { key: 'products', label: 'Produtos', icon: Package },
    { key: 'combos', label: 'Combos', icon: Gift },
    { key: 'kits', label: 'Kits', icon: Component },
    { key: 'inventory', label: 'Estoque', icon: BarChart },
    { key: 'pos', label: 'Frente de Caixa', icon: ShoppingCart },
    { key: 'assistant', label: 'Oráculo AI', icon: Bot },
    { key: 'reports', label: 'Relatórios', icon: FileText },
    { key: 'settings', label: 'Configurações', icon: Settings },
] as const;

export function PermissionProfileForm({
    profile, organization, onSave, onDelete, onDone
}: {
    profile?: PermissionProfile,
    organization: Organization,
    onSave: (data: Partial<PermissionProfile>) => void,
    onDelete: (id: string) => void,
    onDone: () => void,
}) {
    const [formData, setFormData] = useState<Partial<PermissionProfile>>({});
    
    const activeModuleConfig = allModuleConfig.filter(mod => organization.enabledModules[mod.key as keyof EnabledModules]);

    useEffect(() => {
        const defaultPermissions: Partial<EnabledModules> = {};
        activeModuleConfig.forEach(mod => {
            defaultPermissions[mod.key] = { view: false, edit: false, delete: false };
        });

        const initialPermissions = profile?.permissions 
            ? { ...defaultPermissions, ...profile.permissions } 
            : defaultPermissions;

        setFormData({
            ...profile,
            name: profile?.name || '',
            permissions: initialPermissions as EnabledModules,
        });
    }, [profile?.id]);

    const handlePermissionChange = useCallback((
        module: keyof EnabledModules, 
        permission: keyof ModulePermissions, 
        checked: boolean
    ) => {
        setFormData(prev => {
            const newPermissions = { ...prev.permissions };
            const currentModulePerms = newPermissions[module] || { view: false, edit: false, delete: false };
            const updatedModulePerms = { ...currentModulePerms, [permission]: checked };
            
            if (permission === 'view' && !checked) {
                updatedModulePerms.edit = false;
                updatedModulePerms.delete = false;
            }
            if ((permission === 'edit' || permission === 'delete') && checked) {
                 updatedModulePerms.view = true;
            }
            
            newPermissions[module] = updatedModulePerms;
            return { ...prev, permissions: newPermissions as EnabledModules };
        });
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="profileName">Nome do Perfil</Label>
                <Input
                    id="profileName"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    required
                />
            </div>
            <div className="space-y-2">
                <Label>Permissões dos Módulos</Label>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Módulo</TableHead>
                                <TableHead className="text-center">Visualizar</TableHead>
                                <TableHead className="text-center">Editar</TableHead>
                                <TableHead className="text-center">Excluir</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeModuleConfig.map(mod => (
                                <ModulePermissionRow 
                                    key={mod.key}
                                    module={mod}
                                    permissions={formData.permissions?.[mod.key]}
                                    onPermissionChange={handlePermissionChange}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <DialogFooter className="justify-between pt-4">
                <div>
                {profile?.id && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" type="button">Excluir</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                               <AlertDialogTitle>Excluir Perfil?</AlertDialogTitle>
                               <AlertDialogDescription>Esta ação é irreversível. O perfil será removido permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(profile.id)}>Sim, excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                    <Button type="submit">Salvar Perfil</Button>
                </div>
            </DialogFooter>
        </form>
    )
}
