
// src/app/dashboard/backup/page.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Download, Mail, Clock, Loader2, Archive } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const collectionsToExport = [
    { key: 'products', name: 'Produtos' },
    { key: 'customers', name: 'Clientes' },
    { key: 'services', name: 'Serviços' },
    { key: 'appointments', name: 'Agendamentos' },
    { key: 'sales', name: 'Vendas' },
    { key: 'stockEntries', name: 'Mov. de Estoque' },
    { key: 'expenses', name: 'Despesas' },
    { key: 'users', name: 'Usuários' },
    { key: 'combos', name: 'Combos' },
    { key: 'kits', name: 'Kits' },
];

export default function BackupPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (collectionName: string) => {
        if (!user?.organizationId) {
            toast({ title: 'Erro', description: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        setIsExporting(true);
        try {
            const q = query(collection(db, collectionName), where('organizationId', '==', user.organizationId));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (data.length === 0) {
                toast({ title: 'Nenhum dado', description: `Não há dados para exportar na coleção de ${collectionName}.`, variant: 'destructive' });
                return;
            }

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${collectionName}_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({ title: 'Exportação Concluída', description: `${data.length} registros de ${collectionName} foram exportados.` });

        } catch (error) {
            console.error("Export error: ", error);
            toast({ title: 'Erro na exportação', description: 'Não foi possível exportar os dados.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Archive className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">Backup e Exportação</h1>
                    <p className="text-muted-foreground">Exporte seus dados ou configure backups automáticos.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Exportação Manual de Dados</CardTitle>
                    <CardDescription>
                        Faça o download de um arquivo JSON contendo todos os registros de uma coleção de dados da sua organização.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {collectionsToExport.map(({ key, name }) => (
                        <Button
                            key={key}
                            variant="outline"
                            className="justify-start p-4 h-auto"
                            onClick={() => handleExport(key)}
                            disabled={isExporting}
                        >
                            <Download className="mr-4" />
                            <div className="text-left">
                                <p className="font-semibold">{name}</p>
                                <p className="text-xs text-muted-foreground">Exportar para JSON</p>
                            </div>
                            {isExporting && <Loader2 className="ml-auto animate-spin" />}
                        </Button>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Backup Agendado</CardTitle>
                    <CardDescription>
                        Configure o envio periódico de um backup completo dos seus dados para o seu e-mail.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertTitle>Funcionalidade Futura</AlertTitle>
                        <AlertDescription>
                            A configuração de backups agendados está em desenvolvimento e estará disponível em breve.
                        </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                        <Label htmlFor="frequency">Frequência</Label>
                        <Select disabled>
                            <SelectTrigger id="frequency">
                                <SelectValue placeholder="Selecione a frequência" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Diariamente</SelectItem>
                                <SelectItem value="weekly">Semanalmente</SelectItem>
                                <SelectItem value="monthly">Mensalmente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">E-mail para Envio</Label>
                        <Input id="email" type="email" value={user?.email} disabled />
                    </div>
                     <Button disabled>
                        <Mail className="mr-2" />
                        Salvar Agendamento
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
