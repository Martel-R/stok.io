
// src/components/nfe-import-dialog.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseISO } from 'date-fns';

export interface NfeProduct {
    code: string;
    name: string;
    quantity: number;
    unitPrice: number;
    ncm: string;
    cfop: string;
    unitOfMeasure: string;
    expirationDate?: Date;
}

export interface NfeData {
    supplierName: string;
    supplierCnpj: string;
    supplierIe: string;
    supplierAddress: string;
    totalValue: number;
    nfeNumber: string;
    issueDate: Date;
    products: NfeProduct[];
}

export function NfeImportDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'text/xml' && file.type !== 'application/xml') {
            toast({ title: 'Formato inválido', description: 'Por favor, envie um arquivo .xml', variant: 'destructive' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseNfeXml(text);
        };
        reader.readAsText(file, 'ISO-8859-1'); // Common encoding for NF-e XML
    };

    const parseNfeXml = (xmlText: string) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        const getTagValue = (parent: Element, tagName: string) => parent?.getElementsByTagName(tagName)[0]?.textContent || '';
        
        try {
            const nfeProc = xmlDoc.getElementsByTagName('nfeProc')[0] || xmlDoc;
            const infNFe = nfeProc.getElementsByTagName('infNFe')[0];
            if (!infNFe) {
                toast({title: "Arquivo XML inválido", description: "A tag <infNFe> não foi encontrada.", variant: "destructive"});
                return;
            }

            const ide = infNFe.getElementsByTagName('ide')[0];
            const emit = infNFe.getElementsByTagName('emit')[0];
            const enderEmit = emit.getElementsByTagName('enderEmit')[0];
            const total = infNFe.getElementsByTagName('ICMSTot')[0];
            const detItems = Array.from(infNFe.getElementsByTagName('det'));

            const nfeProducts: NfeProduct[] = detItems.map(item => {
                const prod = item.getElementsByTagName('prod')[0];
                const rastro = prod.getElementsByTagName('rastro')[0];
                const expirationDateStr = rastro ? getTagValue(rastro, 'dVal') : '';

                return {
                    code: getTagValue(prod, 'cProd'),
                    name: getTagValue(prod, 'xProd'),
                    quantity: parseFloat(getTagValue(prod, 'qCom')),
                    unitPrice: parseFloat(getTagValue(prod, 'vUnCom')),
                    ncm: getTagValue(prod, 'NCM'),
                    cfop: getTagValue(prod, 'CFOP'),
                    unitOfMeasure: getTagValue(prod, 'uCom'),
                    expirationDate: expirationDateStr ? parseISO(expirationDateStr) : undefined,
                };
            });
            
            const address = `${getTagValue(enderEmit, 'xLgr')}, ${getTagValue(enderEmit, 'nro')} - ${getTagValue(enderEmit, 'xBairro')}, ${getTagValue(enderEmit, 'xMun')} - ${getTagValue(enderEmit, 'UF')}, CEP: ${getTagValue(enderEmit, 'CEP')}`;

            const data: NfeData = {
                supplierName: getTagValue(emit, 'xNome'),
                supplierCnpj: getTagValue(emit, 'CNPJ'),
                supplierIe: getTagValue(emit, 'IE'),
                supplierAddress: address,
                totalValue: parseFloat(getTagValue(total, 'vNF')),
                nfeNumber: `${getTagValue(ide, 'serie')}-${getTagValue(ide, 'nNF')}`,
                issueDate: parseISO(getTagValue(ide, 'dhEmi')),
                products: nfeProducts,
            };

            sessionStorage.setItem('nfeData', JSON.stringify(data));
            router.push('/dashboard/inventory/nfe-processing');
            setIsOpen(false);

        } catch(error) {
            console.error("XML Parsing Error:", error);
            toast({title: "Erro ao ler XML", description: "O arquivo XML parece ser inválido ou não está no formato de NF-e esperado.", variant: "destructive"});
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline"><Upload className="mr-2" /> Importar NF-e (XML)</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                    <DialogTitle>Importar Nota Fiscal Eletrônica (NF-e)</DialogTitle>
                    <DialogDescription>
                        Envie o arquivo XML da sua nota fiscal para iniciar o processo de importação de produtos e despesas.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label htmlFor="xml-file">Arquivo XML da NF-e</Label>
                        <Input id="xml-file" type="file" accept=".xml,text/xml" onChange={handleFileChange} />
                    </div>
                 </div>
            </DialogContent>
        </Dialog>
    )
}
