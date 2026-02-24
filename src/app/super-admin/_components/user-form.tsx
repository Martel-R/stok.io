
'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, PermissionProfile } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';

export function UserForm({ user, profiles, onSave, onDone }: { user?: User; profiles: PermissionProfile[]; onSave: (user: Partial<User>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { name: '', email: '', role: '', password: '', avatar: 'https://placehold.co/100x100.png?text=👤', isDeleted: false }
    );

    useEffect(() => {
        if (!user && profiles.length > 0 && !formData.role) {
            setFormData(prev => ({ ...prev, role: profiles[0].id }));
        }
        if (user) {
             setFormData(user);
        }
    }, [user, profiles, formData.role]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleRoleChange = (roleId: string) => {
        setFormData(prev => ({...prev, role: roleId}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as User);
        onDone();
    };
    
    const isEditing = !!user;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Label htmlFor="name">Nome do Usuário</Label>
                <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required disabled={isEditing}/>
            </div>
            {!isEditing && (
                 <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" name="password" type="password" value={formData.password || ''} onChange={handleChange} required minLength={6} />
                </div>
            )}
            <div>
                <Label htmlFor="role">Perfil</Label>
                 <Select value={formData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger id="role">
                        <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                        {profiles.map(profile => (
                            <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                 <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                 <Button type="submit">Salvar Usuário</Button>
            </DialogFooter>
        </form>
    );
}
