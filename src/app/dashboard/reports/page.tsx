
'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { summarizeDataRequest } from '@/ai/flows/summarize-data-request';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock } from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const [dataDescription, setDataDescription] = useState('Valores de vendas semanais para todas as categorias de produtos.');
  const [dataToSummarize, setDataToSummarize] = useState('Eletrônicos: R$15.200, Móveis: R$8.500, Mercearia: R$12.100, Esportes: R$5.400');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const hasAccess = user?.role === 'admin';

  const handleSummarize = async () => {
    if (!dataToSummarize.trim() || !dataDescription.trim()) return;
    setLoading(true);
    setSummary('');
    try {
      const result = await summarizeDataRequest({ dataDescription, data: dataToSummarize });
      setSummary(result.summary);
    } catch (error) {
      setSummary('Falha ao gerar o resumo. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
        <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2"><Lock /> Acesso Negado</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Este recurso está disponível apenas para a função de Administrador.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Relatórios Gerenciais</h1>
      <Card>
        <CardHeader>
          <CardTitle>Resumidor de Dados com IA</CardTitle>
          <CardDescription>Cole os dados de qualquer fonte, descreva o que eles representam e a IA gerará um resumo analítico. Futuramente, esta tela terá relatórios pré-definidos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="data-description">Descrição dos Dados</Label>
            <Input 
              id="data-description" 
              value={dataDescription} 
              onChange={(e) => setDataDescription(e.target.value)}
              placeholder="Ex: Dados de inscrição de usuários mensais"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="data-to-summarize">Dados</Label>
            <Textarea 
              id="data-to-summarize" 
              value={dataToSummarize} 
              onChange={(e) => setDataToSummarize(e.target.value)}
              placeholder="Cole seus dados aqui..."
              rows={10}
            />
          </div>
          <Button onClick={handleSummarize} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar Resumo
          </Button>
        </CardContent>
      </Card>
      
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Gerado por IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{summary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
