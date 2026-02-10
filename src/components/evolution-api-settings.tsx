'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { EvolutionApiConfig } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function EvolutionApiSettings() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [config, setConfig] = useState<Partial<EvolutionApiConfig>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.organization?.evolutionApiConfig) {
            setConfig(user.organization.evolutionApiConfig);
        }
    }, [user?.organization?.evolutionApiConfig]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) {
            toast({ title: 'Erro', description: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        setLoading(true);
        try {
            const orgRef = doc(db, 'organizations', user.organizationId);
            await updateDoc(orgRef, { evolutionApiConfig: config });
            toast({ title: 'Sucesso', description: 'Configurações da API da Evolution salvas.' });
        } catch (error) {
            console.error("Error saving Evolution API config: ", error);
            toast({ title: 'Erro', description: 'Não foi possível salvar as configurações.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configurações da Evolution API</CardTitle>
                <CardDescription>Conecte sua instância da Evolution API para ativar a integração com o WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="apiUrl">Endpoint da API</Label>
                        <Input 
                            id="apiUrl"
                            name="apiUrl"
                            value={config.apiUrl || ''}
                            onChange={handleChange}
                            placeholder="https://sua-api.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="apiKey">Chave da API (apiKey)</Label>
                        <Input 
                            id="apiKey"
                            name="apiKey"
                            type="password"
                            value={config.apiKey || ''}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="instanceName">Nome da Instância</Label>
                        <Input 
                            id="instanceName"
                            name="instanceName"
                            value={config.instanceName || ''}
                            onChange={handleChange}
                            placeholder="Nome da sua instância no Evolution"
                            required
                        />
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Configurações
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
