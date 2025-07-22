
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

const availableAvatars = [
    'https://placehold.co/100x100.png?text=🦊',
    'https://placehold.co/100x100.png?text=🦉',
    'https://placehold.co/100x100.png?text=🐻',
    'https://placehold.co/100x100.png?text=🦁',
    'https://placehold.co/100x100.png?text=🦄',
];

export default function ProfilePage() {
    const { user, updateUserProfile, changeUserPassword, loading } = useAuth();
    const { toast } = useToast();

    const [name, setName] = useState(user?.name || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProfile(true);
        const { success, error } = await updateUserProfile({ name, avatar });
        if (success) {
            toast({ title: 'Perfil atualizado com sucesso!' });
        } else {
            toast({ title: 'Erro ao atualizar perfil', description: error, variant: 'destructive' });
        }
        setIsSavingProfile(false);
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast({ title: 'As senhas não coincidem', variant: 'destructive' });
            return;
        }
        if (newPassword.length < 6) {
            toast({ title: 'Senha muito curta', description: 'A nova senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
            return;
        }

        setIsSavingPassword(true);
        const { success, error } = await changeUserPassword(currentPassword, newPassword);

        if (success) {
            toast({ title: 'Senha alterada com sucesso!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } else {
            toast({ title: 'Erro ao alterar senha', description: error, variant: 'destructive' });
        }
        setIsSavingPassword(false);
    };
    
    if (loading || !user) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Meu Perfil</h1>
                <p className="text-muted-foreground">Gerencie suas informações pessoais e de segurança.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informações Gerais</CardTitle>
                    <CardDescription>Atualize seu nome de exibição e avatar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleProfileSubmit} className="space-y-6">
                         <div className="space-y-2">
                            <Label>Avatar</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={avatar} />
                                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <RadioGroup value={avatar} onValueChange={setAvatar} className="flex flex-wrap gap-2">
                                    {availableAvatars.map((src) => (
                                        <RadioGroupItem key={src} value={src} id={src} className="sr-only" />
                                    ))}
                                    {availableAvatars.map((src) => (
                                        <Label key={`label-${src}`} htmlFor={src} className="cursor-pointer">
                                            <Avatar className={`h-12 w-12 transition-all ${avatar === src ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                                                <AvatarImage asChild src={src}>
                                                   <Image src={src} alt="Avatar" width={48} height={48} data-ai-hint="avatar animal" />
                                                </AvatarImage>
                                            </Avatar>
                                        </Label>
                                    ))}
                                </RadioGroup>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={user.email} disabled />
                            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
                        </div>
                       
                        <Button type="submit" disabled={isSavingProfile}>
                            {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Separator />
            
            <Card>
                <CardHeader>
                    <CardTitle>Alterar Senha</CardTitle>
                    <CardDescription>Para sua segurança, recomendamos o uso de uma senha forte e única.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                        <div className="grid gap-2">
                            <Label htmlFor="currentPassword">Senha Atual</Label>
                             <div className="relative">
                                <Input
                                id="currentPassword"
                                type={showCurrentPassword ? 'text' : 'password'}
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                disabled={isSavingPassword}
                                />
                                <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                                onClick={() => setShowCurrentPassword((prev) => !prev)}
                                >
                                {showCurrentPassword ? <EyeOff /> : <Eye />}
                                </Button>
                            </div>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="newPassword">Nova Senha</Label>
                             <div className="relative">
                                <Input
                                id="newPassword"
                                type={showNewPassword ? 'text' : 'password'}
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={isSavingPassword}
                                />
                                <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                                onClick={() => setShowNewPassword((prev) => !prev)}
                                >
                                {showNewPassword ? <EyeOff /> : <Eye />}
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSavingPassword} />
                        </div>
                         <Button type="submit" disabled={isSavingPassword}>
                            {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Alterar Senha
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

