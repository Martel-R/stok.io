'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { EnabledModules } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const moduleLabels: { [key in keyof EnabledModules]?: string } = {
    dashboard: 'Início',
    appointments: 'Agendamentos',
    customers: 'Clientes',
    services: 'Serviços',
    products: 'Produtos',
    combos: 'Combos',
    kits: 'Kits',
    inventory: 'Estoque',
    pos: 'Frente de Caixa',
    expenses: 'Despesas',
    assistant: 'Oráculo AI',
    reports: 'Relatórios',
    settings: 'Configurações',
    backup: 'Backup',
    subscription: 'Assinatura',
    chat: 'Chat / WhatsApp',
};

export function ActiveModulesSettings() {
    const { user, updateOrganizationModules } = useAuth();
    const { toast } = useToast();
    const [enabledModules, setEnabledModules] = useState<Partial<EnabledModules>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.organization?.enabledModules) {
            setEnabledModules(user.organization.enabledModules);
        }
    }, [user?.organization?.enabledModules]);

    const handleModuleToggle = (module: keyof EnabledModules, checked: boolean) => {
        setEnabledModules(prev => ({ ...prev, [module]: checked }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateOrganizationModules(enabledModules as EnabledModules);
            toast({ title: 'Sucesso', description: 'Módulos ativos foram atualizados.' });
        } catch (error) {
            console.error("Error saving active modules: ", error);
            toast({ title: 'Erro', description: 'Não foi possível salvar os módulos ativos.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Módulos Ativos</CardTitle>
                <CardDescription>Ative ou desative os módulos disponíveis para sua organização.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.keys(moduleLabels).map((key) => {
                            const moduleKey = key as keyof EnabledModules;
                            return (
                                <div key={moduleKey} className="flex items-center space-x-2 p-2 rounded-md border">
                                    <Switch
                                        id={moduleKey}
                                        checked={!!enabledModules[moduleKey]}
                                        onCheckedChange={(checked) => handleModuleToggle(moduleKey, checked)}
                                    />
                                    <Label htmlFor={moduleKey} className="cursor-pointer">{moduleLabels[moduleKey]}</Label>
                                </div>
                            );
                        })}
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Módulos
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
