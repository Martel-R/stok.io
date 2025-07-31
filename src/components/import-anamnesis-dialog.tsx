
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileDown, Loader2 } from 'lucide-react';
import type { AnamnesisQuestion, AnamnesisQuestionType } from '@/lib/types';

type ParsedQuestion = Omit<AnamnesisQuestion, 'id' | 'organizationId' | 'order'>;

export function ImportAnamnesisQuestionsDialog({
    children,
    isOpen,
    onOpenChange,
    onImport,
}: {
    children: React.ReactNode;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (questions: ParsedQuestion[]) => void;
}) {
    const [parsedData, setParsedData] = useState<ParsedQuestion[]>([]);
    const [fileName, setFileName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'text/csv') {
            toast({ title: 'Formato inválido', description: 'Por favor, envie um arquivo .csv', variant: 'destructive' });
            return;
        }

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseCSV(text);
        };
        reader.readAsText(file);
    };

    const parseCSV = (csvText: string) => {
        const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            toast({ title: 'Arquivo vazio ou inválido', description: 'O CSV precisa ter um cabeçalho e pelo menos uma linha de dados.', variant: 'destructive' });
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const expectedHeaders = ['label', 'type'];
        const validTypes: AnamnesisQuestionType[] = ['text', 'boolean', 'boolean_with_text', 'integer', 'decimal'];
        
        if (headers.length !== 2 || headers[0] !== 'label' || headers[1] !== 'type') {
            toast({ title: 'Cabeçalhos inválidos', description: `O cabeçalho do CSV deve ser: ${expectedHeaders.join(',')}`, variant: 'destructive' });
            return;
        }

        const data: ParsedQuestion[] = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const label = values[0]?.trim();
            const type = values[1]?.trim() as AnamnesisQuestionType;

            if (label && validTypes.includes(type)) {
                data.push({ label, type });
            } else {
                toast({ title: 'Linha inválida encontrada', description: `A linha ${i+1} ("${lines[i]}") foi ignorada por conter dados inválidos.`, variant: 'destructive' });
            }
        }
        setParsedData(data);
    };
    
    const downloadTemplate = () => {
        const headers = "label,type";
        const examples = [
            '"Você fuma?",boolean',
            '"Se sim, quantos cigarros por dia?",integer',
            '"Possui alguma alergia? Se sim, qual?",boolean_with_text',
            '"Qual seu peso em kg?",decimal',
            '"Observações adicionais",text'
        ];
        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${examples.join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "template_perguntas_anamnese.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const handleConfirmImport = async () => {
        setIsLoading(true);
        await onImport(parsedData);
        setIsLoading(false);
        setParsedData([]);
        setFileName('');
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Importar Perguntas da Anamnese</DialogTitle>
                    <DialogDescription>
                        Envie um arquivo CSV para adicionar múltiplas perguntas de uma vez.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <h3 className="font-semibold">1. Faça o upload do arquivo</h3>
                        <p className="text-sm text-muted-foreground">
                           O arquivo deve estar no formato .csv e seguir a estrutura do modelo. Tipos válidos são: `text`, `boolean`, `boolean_with_text`, `integer`, `decimal`.
                        </p>
                        <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} />
                         <Button variant="link" onClick={downloadTemplate} className="p-0 h-auto">
                            <FileDown className="mr-2 h-4 w-4" />
                            Baixar modelo CSV
                        </Button>
                        {fileName && <p className="text-sm text-muted-foreground">Arquivo selecionado: {fileName}</p>}
                    </div>
                     <div className="space-y-4">
                         <h3 className="font-semibold">2. Pré-visualização dos Dados</h3>
                         <p className="text-sm text-muted-foreground">
                           Verifique os dados abaixo antes de confirmar a importação.
                        </p>
                        <ScrollArea className="h-64 w-full rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pergunta (label)</TableHead>
                                        <TableHead>Tipo (type)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedData.length > 0 ? (
                                        parsedData.map((question, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{question.label}</TableCell>
                                                <TableCell>{question.type}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">
                                                Aguardando arquivo...
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmImport} disabled={parsedData.length === 0 || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar e Importar {parsedData.length > 0 ? `(${parsedData.length})` : ''}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
