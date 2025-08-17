

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
import { ModulePermissionRow, allModuleConfig } from '@/components/module-permission-row';
import { Checkbox } from './ui/checkbox';
import { Loader2 } from 'lucide-react';


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
    
    const activeModuleConfig = React.useMemo(() => 
        organization ? allModuleConfig.filter(mod => organization.enabledModules[mod.key as keyof EnabledModules]) : [],
    [organization]);

    useEffect(() => {
        if (!organization) return;

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
    }, [profile, activeModuleConfig, organization]);

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

    const handleSelectAll = (permission: keyof ModulePermissions, checked: boolean) => {
        setFormData(prev => {
            const newPermissions = { ...prev.permissions } as EnabledModules;
            activeModuleConfig.forEach(mod => {
                const currentModulePerms = newPermissions[mod.key] || { view: false, edit: false, delete: false };
                const updatedModulePerms = { ...currentModulePerms, [permission]: checked };

                if (permission === 'view' && !checked) {
                    updatedModulePerms.edit = false;
                    updatedModulePerms.delete = false;
                }
                if ((permission === 'edit' || permission === 'delete') && checked) {
                    updatedModulePerms.view = true;
                }
                newPermissions[mod.key] = updatedModulePerms;
            });
            return { ...prev, permissions: newPermissions };
        });
    };

    const getSelectAllState = (permission: keyof ModulePermissions): boolean | 'indeterminate' => {
        const selectedCount = activeModuleConfig
            .filter(mod => formData.permissions?.[mod.key]?.[permission])
            .length;
        
        if (selectedCount === 0) return false;
        if (selectedCount === activeModuleConfig.length) return true;
        return 'indeterminate';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }

    if (!organization || !formData.permissions) {
        return (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="animate-spin" />
            </div>
        );
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
                                <TableHead className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <Checkbox
                                            checked={getSelectAllState('view')}
                                            onCheckedChange={(checked) => handleSelectAll('view', checked === true)}
                                            id="select-all-view"
                                        />
                                        <Label htmlFor="select-all-view" className="cursor-pointer">Visualizar</Label>
                                    </div>
                                </TableHead>
                                <TableHead className="text-center">
                                     <div className="flex flex-col items-center gap-1">
                                        <Checkbox
                                            checked={getSelectAllState('edit')}
                                            onCheckedChange={(checked) => handleSelectAll('edit', checked === true)}
                                            id="select-all-edit"
                                        />
                                        <Label htmlFor="select-all-edit" className="cursor-pointer">Editar</Label>
                                    </div>
                                </TableHead>
                                <TableHead className="text-center">
                                     <div className="flex flex-col items-center gap-1">
                                        <Checkbox
                                            checked={getSelectAllState('delete')}
                                            onCheckedChange={(checked) => handleSelectAll('delete', checked === true)}
                                            id="select-all-delete"
                                        />
                                        <Label htmlFor="select-all-delete" className="cursor-pointer">Excluir</Label>
                                    </div>
                                </TableHead>
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
