'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import type { EvolutionApiConfig } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EvolutionApiService } from '@/lib/evolution-api';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || 'https://evo.martel.page/';
const API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';

export function EvolutionApiSettings() {
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();
    
    const [config, setConfig] = useState<Partial<EvolutionApiConfig>>({
        enabled: false,
        apiUrl: API_URL,
        apiKey: API_KEY,
        instanceName: '',
    });

    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [creating, setCreating] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<string | null>(null);

    useEffect(() => {
        if (user?.organization?.name && currentBranch?.name) {
            const orgPart = user.organization.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
            const unitPart = currentBranch.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
            const name = `${orgPart}-${unitPart}`;
            
            setConfig(prev => ({
                ...prev,
                instanceName: name,
                apiUrl: API_URL, // Ensure defaults are kept
                apiKey: API_KEY
            }));
        }
    }, [user?.organization?.name, currentBranch?.name]);

    useEffect(() => {
        if (user?.organization?.evolutionApiConfig) {
            setConfig(prev => ({
                ...prev,
                ...user.organization?.evolutionApiConfig,
                apiUrl: API_URL, // Always override with ENV values for security
                apiKey: API_KEY
            }));
        }
    }, [user?.organization?.evolutionApiConfig]);

    const handleSwitchChange = (checked: boolean) => {
        setConfig(prev => ({ ...prev, enabled: checked }));
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setQrCode(null);
        try {
            const api = new EvolutionApiService(config as EvolutionApiConfig);
            const result = await api.testConnection();
            
            if (result.success) {
                setConnectionState(result.state || 'UNKNOWN');
                
                // Tentar configurar/atualizar o Webhook ao verificar status
                const origin = window.location.origin;
                if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
                    const webhookUrl = `${origin}/api/webhooks/evolution`;
                    const webhookResult = await api.setWebhook(webhookUrl);
                    if (webhookResult.success) {
                        toast({ title: 'Status da Instância', description: `Estado: ${result.state}. Webhook sincronizado.` });
                    } else {
                        toast({ 
                            title: 'Aviso', 
                            description: `Conectado (${result.state}), mas erro ao sincronizar webhook: ${webhookResult.error}`,
                            variant: 'destructive'
                        });
                    }
                } else {
                    toast({ 
                        title: 'Status da Instância', 
                        description: `Estado: ${result.state}. Webhook não configurado (localhost detectado).` 
                    });
                    console.warn("Webhook ignorado: Evolution API não pode enviar dados para localhost. Use um túnel (Ngrok) ou deploy para testar o recebimento de mensagens.");
                }

                if (result.state !== 'open') {
                    const connectResult = await api.connectInstance(config.instanceName!);
                    if (connectResult.success && connectResult.base64) {
                        setQrCode(connectResult.base64);
                    }
                }
            } else {
                setConnectionState('NOT_FOUND');
                toast({ title: 'Não Encontrada', description: 'Instância não existe ou está offline.', variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Erro', description: 'Falha na comunicação com a API.', variant: 'destructive' });
        } finally {
            setTesting(false);
        }
    };

    const handleCreateInstance = async () => {
        if (!config.instanceName) return;
        setCreating(true);
        try {
            const api = new EvolutionApiService(config as EvolutionApiConfig);
            const result = await api.createInstance(config.instanceName);
            
            if (result.success) {
                toast({ title: 'Sucesso', description: 'Instância criada! Configurando Webhook...' });
                
                const origin = window.location.origin;
                if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
                    const webhookUrl = `${origin}/api/webhooks/evolution`;
                    const webhookResult = await api.setWebhook(webhookUrl);
                    
                    if (webhookResult.success) {
                        toast({ title: 'Webhook Ativado', description: 'Sincronização em tempo real configurada.' });
                    } else {
                        toast({ 
                            title: 'Aviso', 
                            description: 'Instância criada, mas o webhook falhou: ' + webhookResult.error,
                            variant: 'destructive'
                        });
                    }
                } else {
                    toast({ 
                        title: 'Aviso', 
                        description: 'Instância criada, mas webhook ignorado (Ambiente Local).',
                    });
                    console.warn("A Evolution API exige uma URL pública para o Webhook. O chat funcionará via polling (ou manual) em localhost.");
                }

                setTimeout(handleTestConnection, 2000);
            } else {
                toast({ title: 'Erro', description: result.error, variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Erro', description: 'Falha ao criar instância.', variant: 'destructive' });
        } finally {
            setCreating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const orgRef = doc(db, 'organizations', user.organizationId);
            // We save the enabled status and instance name, but API data comes from ENV
            await updateDoc(orgRef, { evolutionApiConfig: config });
            toast({ title: 'Sucesso', description: 'Configurações salvas.' });
        } catch (error) {
            toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configurações do WhatsApp</CardTitle>
                <CardDescription>
                    Gerencie a conexão da unidade <strong>{currentBranch?.name}</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center space-x-2 pb-4 border-b">
                        <Switch 
                            id="enabled" 
                            checked={config.enabled} 
                            onCheckedChange={handleSwitchChange}
                        />
                        <Label htmlFor="enabled">Ativar WhatsApp para esta Unidade</Label>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">ID da Instância:</span>
                            <span className="font-mono font-bold">{config.instanceName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Servidor:</span>
                            <span className="truncate max-w-[200px]">{API_URL}</span>
                        </div>
                    </div>

                    {qrCode && (
                        <div className="flex flex-col items-center p-6 border-2 border-dashed rounded-lg bg-white shadow-inner">
                            <p className="mb-4 font-semibold text-center text-sm">Escaneie o QR Code no seu WhatsApp:</p>
                            <div className="relative w-64 h-64 bg-white p-2 border rounded">
                                <Image 
                                    src={qrCode} 
                                    alt="WhatsApp QR Code" 
                                    fill 
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                className="mt-4"
                                onClick={handleTestConnection}
                                disabled={testing}
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${testing ? 'animate-spin' : ''}`} /> 
                                Atualizar QR Code
                            </Button>
                        </div>
                    )}

                    {connectionState === 'open' && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            <span className="font-medium">WhatsApp Conectado!</span>
                        </div>
                    )}

                    {connectionState === 'close' && !qrCode && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center text-yellow-700">
                            <AlertCircle className="mr-2 h-5 w-5" />
                            <span>Instância desconectada. Clique em "Verificar" para gerar QR Code.</span>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                        <Button type="submit" disabled={loading} className="min-w-[140px]">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Ativação
                        </Button>
                        
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={handleTestConnection} 
                            disabled={testing || !config.instanceName}
                        >
                            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Verificar Status
                        </Button>

                        {connectionState === 'NOT_FOUND' && (
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={handleCreateInstance}
                                disabled={creating}
                            >
                                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Criar Nova Instância
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
