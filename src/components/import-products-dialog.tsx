
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUp, FileDown, Loader2 } from 'lucide-react';
import type { Product } from '@/lib/types';

type ParsedProduct = Omit<Product, 'id' | 'branchId' | 'organizationId'> & { stock: number };

export function ImportProductsDialog({
    isOpen,
    onOpenChange,
    onImport,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (products: { product: Omit<Product, 'id' | 'branchId' | 'organizationId'>, stock: number }[]) => void;
}) {
    const [parsedData, setParsedData] = useState<ParsedProduct[]>([]);
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
        const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== ''); // Ignore empty lines
        const headers = lines[0].split(',').map(h => h.trim());
        
        const headerMap: { [key: string]: keyof ParsedProduct } = {
            'nome': 'name',
            'categoria': 'category',
            'preco_compra': 'purchasePrice',
            'preco_venda': 'price',
            'alerta_estoque_baixo': 'lowStockThreshold',
            'comerciavel': 'isSalable',
            'codigo_barras': 'barcode',
            'url_imagem': 'imageUrl',
            'codigo_interno': 'code',
            'estoque_inicial': 'stock'
        };

        const requiredHeaders = ['nome', 'categoria', 'preco_venda', 'preco_compra'];
        if (!requiredHeaders.every(h => headers.includes(h))) {
            toast({ title: 'Cabeçalhos obrigatórios faltando', description: `O CSV deve conter pelo menos: ${requiredHeaders.join(', ')}.`, variant: 'destructive' });
            return;
        }

        const data: ParsedProduct[] = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const values = lines[i].split(',');
            const entry: any = {};
            headers.forEach((header, index) => {
                const mappedHeader = headerMap[header];
                if(mappedHeader) {
                    const value = values[index]?.trim() || '';
                    entry[mappedHeader] = value;
                }
            });

            const name = entry.name || '';
            const category = entry.category || 'Geral';
            const purchasePrice = parseFloat(entry.purchasePrice) || 0;
            const price = parseFloat(entry.price) || 0;
            const lowStockThreshold = parseInt(entry.lowStockThreshold, 10) || 10;
            const isSalable = entry.isSalable?.toLowerCase() !== 'false'; // Defaults to true
            const stock = parseInt(entry.stock, 10) || 0;

            if (name && category && price > 0) {
                 data.push({
                    name,
                    category,
                    price,
                    purchasePrice,
                    lowStockThreshold,
                    isSalable,
                    stock,
                    barcode: entry.barcode || '',
                    imageUrl: entry.imageUrl || 'https://placehold.co/400x400.png',
                    code: entry.code || '',
                    marginValue: purchasePrice > 0 ? ((price - purchasePrice) / purchasePrice) * 100 : 0,
                    marginType: 'percentage',
                 });
            }
        }
        setParsedData(data);
    };
    
    const downloadTemplate = () => {
        const headers = "nome,categoria,preco_compra,preco_venda,alerta_estoque_baixo,comerciavel,codigo_barras,url_imagem,codigo_interno,estoque_inicial";
        const example = "Laptop Gamer,Eletrônicos,6000.00,7500.50,5,TRUE,7890123456789,https://placehold.co/400x400.png,LP-GAMER-01,15\nSacola Plástica,Insumos,0.10,0.50,100,FALSE,,,,500";
        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${example}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "template_produtos_completo.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const handleConfirmImport = async () => {
        setIsLoading(true);
        const productsToImport = parsedData.map(({ stock, ...product }) => ({ product, stock }));
        await onImport(productsToImport);
        setIsLoading(false);
        setParsedData([]);
        setFileName('');
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <FileUp className="mr-2" />
                    Importar Produtos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Importar Produtos em Lote</DialogTitle>
                    <DialogDescription>
                        Envie um arquivo CSV para adicionar múltiplos produtos e seu estoque inicial de uma vez.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <h3 className="font-semibold">1. Faça o upload do arquivo</h3>
                        <p className="text-sm text-muted-foreground">
                           O arquivo deve estar no formato .csv e seguir a estrutura do modelo.
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
                                        <TableHead>Nome</TableHead>
                                        <TableHead className="text-right">Preço</TableHead>
                                        <TableHead className="text-right">Estoque Inicial</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedData.length > 0 ? (
                                        parsedData.map((product, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{product.name}</TableCell>
                                                <TableCell className="text-right">R$ {product.price.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">{product.stock}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
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
