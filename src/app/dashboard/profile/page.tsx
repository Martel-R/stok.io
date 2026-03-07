
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, PlusCircle, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Availability, DayAvailability } from '@/lib/types';
import { Switch } from '@/components/ui/switch';


const availableAvatars = [
    'https://placehold.co/100x100.png?text=🦊',
    'https://placehold.co/100x100.png?text=🦉',
    'https://placehold.co/100x100.png?text=🐻',
    'https://placehold.co/100x100.png?text=🦁',
    'https://placehold.co/100x100.png?text=🦄',
];

const defaultAvailability: Availability = {
    sunday: { enabled: false, slots: [] },
    monday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
    tuesday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
    wednesday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
    thursday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
    friday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
    saturday: { enabled: false, slots: [] },
};

const weekDays: { key: keyof Availability, label: string }[] = [
    { key: 'sunday', label: 'Domingo' },
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
];

function AvailabilitySettings() {
    const { user, updateUserProfile } = useAuth();
    const [availability, setAvailability] = useState<Availability>(user?.availability || defaultAvailability);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleDayToggle = (day: keyof Availability, enabled: boolean) => {
        setAvailability(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                enabled,
                slots: enabled && prev[day].slots.length === 0 ? [{ start: '09:00', end: '18:00' }] : prev[day].slots
            }
        }));
    };

    const handleSlotChange = (day: keyof Availability, slotIndex: number, field: 'start' | 'end', value: string) => {
        setAvailability(prev => {
            const newSlots = [...prev[day].slots];
            newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
            return { ...prev, [day]: { ...prev[day], slots: newSlots } };
        });
    };

    const addSlot = (day: keyof Availability) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], slots: [...prev[day].slots, { start: '09:00', end: '18:00' }] }
        }));
    };

    const removeSlot = (day: keyof Availability, slotIndex: number) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], slots: prev[day].slots.filter((_, i) => i !== slotIndex) }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const { success, error } = await updateUserProfile({ availability });
        if (success) {
            toast({ title: 'Horários atualizados com sucesso!' });
        } else {
            toast({ title: 'Erro ao atualizar horários', description: error, variant: 'destructive' });
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-6">
            {weekDays.map(({ key, label }) => (
                <Card key={key}>
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <CardTitle className="text-lg">{label}</CardTitle>
                        <Switch checked={availability[key].enabled} onCheckedChange={(checked) => handleDayToggle(key, checked)} />
                    </CardHeader>
                    {availability[key].enabled && (
                        <CardContent className="space-y-4">
                            {availability[key].slots.map((slot, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input type="time" value={slot.start} onChange={e => handleSlotChange(key, index, 'start', e.target.value)} />
                                    <span className="text-muted-foreground">-</span>
                                    <Input type="time" value={slot.end} onChange={e => handleSlotChange(key, index, 'end', e.target.value)} />
                                    <Button variant="ghost" size="icon" onClick={() => removeSlot(key, index)} disabled={availability[key].slots.length <= 1}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addSlot(key)}>
                                <PlusCircle className="mr-2" /> Adicionar Horário
                            </Button>
                        </CardContent>
                    )}
                </Card>
            ))}
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 animate-spin" />}
                Salvar Horários
            </Button>
        </div>
    );
}


export default function ProfilePage() {
    const { user, updateUserProfile, changeUserPassword, loading } = useAuth();
    const { toast } = useToast();

    const [name, setName] = useState(user?.name || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [supervisorPin, setSupervisorPin] = useState(user?.supervisorPin || '');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const [isGeneratingPin, setIsGeneratingPin] = useState(false);

    const generateRandomPin = async () => {
        setIsGeneratingPin(true);
        try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            
            let newPin = '';
            let isUnique = false;
            let attempts = 0;

            while (!isUnique && attempts < 10) {
                newPin = Math.floor(100000 + Math.random() * 900000).toString();
                const q = query(
                    collection(db, 'users'), 
                    where('organizationId', '==', user?.organizationId),
                    where('supervisorPin', '==', newPin)
                );
                const snap = await getDocs(q);
                if (snap.empty) isUnique = true;
                attempts++;
            }

            if (isUnique) {
                // Save immediately
                const { success, error } = await updateUserProfile({ supervisorPin: newPin });
                if (success) {
                    setSupervisorPin(newPin);
                    toast({ title: 'Novo PIN Ativado!', description: 'O novo código já está pronto para uso.' });
                } else {
                    toast({ title: 'Erro ao salvar PIN', description: error, variant: 'destructive' });
                }
            } else {
                toast({ title: 'Erro ao gerar PIN', description: 'Tente novamente.', variant: 'destructive' });
            }
        } catch (err) {
            console.error("Error generating PIN:", err);
        } finally {
            setIsGeneratingPin(false);
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProfile(true);
        const { success, error } = await updateUserProfile({ name, avatar, supervisorPin });
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
    
    const isProfessional = user.role === 'professional';
    // Redirect customers to their own portal profile page
    const isCustomer = user.role === 'customer';
    const defaultTab = isProfessional ? 'availability' : 'general';

    if (isCustomer) {
        // This page is for internal users. Customers have their own profile page.
        // The auth provider should ideally redirect, but this is a fallback.
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Acesso ao Perfil</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Para editar seu perfil, por favor acesse o <a href="/portal/profile" className="underline">Portal do Cliente</a>.</p>
                </CardContent>
            </Card>
        );
    }


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Meu Perfil</h1>
                <p className="text-muted-foreground">Gerencie suas informações pessoais e de segurança.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="space-y-6">
                 <TabsList>
                    {isProfessional && <TabsTrigger value="availability">Horários de Atendimento</TabsTrigger>}
                    <TabsTrigger value="general">Informações Gerais</TabsTrigger>
                    <TabsTrigger value="security">Segurança</TabsTrigger>
                </TabsList>
                
                {isProfessional && (
                     <TabsContent value="availability">
                        <Card>
                             <CardHeader>
                                <CardTitle>Horários de Atendimento</CardTitle>
                                <CardDescription>Defina sua disponibilidade semanal para agendamentos.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AvailabilitySettings />
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
                
                <TabsContent value="general">
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

                                { user?.enabledModules?.pos?.delete && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="space-y-2">
                                            <Label htmlFor="supervisorPin">PIN de Supervisor (6 dígitos)</Label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Input 
                                                        id="supervisorPin" 
                                                        type={showNewPassword ? 'text' : 'password'}
                                                        value={supervisorPin} 
                                                        readOnly
                                                        className="font-mono text-lg bg-muted"
                                                        placeholder="Clique para gerar ->"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                                                        onClick={() => setShowNewPassword((prev) => !prev)}
                                                    >
                                                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    onClick={generateRandomPin}
                                                    disabled={isGeneratingPin}
                                                >
                                                    {isGeneratingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar Novo PIN'}
                                                </Button>
                                            </div>
                                            <CardDescription>
                                                Este PIN é gerado automaticamente e é único na sua organização. Salve para ativar.
                                            </CardDescription>
                                        </div>
                                    </div>
                                )}
                            
                                <Button type="submit" disabled={isSavingProfile} className="mt-4">
                                    {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Alterações
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="security">
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
                </TabsContent>
            </Tabs>
        </div>
    );
}
