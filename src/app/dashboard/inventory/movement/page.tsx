
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import type { Product, StockEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowLeft, Check, ChevronsUpDown, Loader2, PlusCircle, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import React from 'react';

type MovementType = 'entry' | 'adjustment';
type ListedProduct = Product & { movementQuantity: number; notes?: string; expirationDate?: Date };

function MovementPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();

    const [movementType, setMovementType] = useState<MovementType>((searchParams.get('type') as MovementType) || 'entry');
    const [products, setProducts] = useState<Product[]>([]);
    const [listedProducts, setListedProducts] = useState<ListedProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [globalNotes, setGlobalNotes] = useState('');

    useEffect(() => {
        if (!currentBranch) return;
        const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id), where('isDeleted', '!=', true));
        const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(productsData.sort((a, b) => a.name.localeCompare(b.name)));
            setIsLoading(false);
        });
        return unsubscribe;
    }, [currentBranch]);

    const addProductToList = (product: Product) => {
        if (listedProducts.some(p => p.id === product.id)) {
            toast({ title: 'Produto já está na lista', variant: 'destructive' });
            return;
        }
        setListedProducts(prev => [...prev, { ...product, movementQuantity: 1 }]);
        setPopoverOpen(false);
    };

    const updateListedProduct = (productId: string, field: keyof ListedProduct, value: any) => {
        setListedProducts(prev => prev.map(p => p.id === productId ? { ...p, [field]: value } : p));
    };

    const removeListedProduct = (productId: string) => {
        setListedProducts(prev => prev.filter(p => p.id !== productId));
    };

    const handleSave = async () => {
        if (listedProducts.length === 0) {
            toast({ title: 'Nenhum produto na lista', description: 'Adicione produtos para registrar a movimentação.', variant: 'destructive' });
            return;
        }
        if (!user || !currentBranch) return;

        setIsSaving(true);
        const batch = writeBatch(db);
        const date = serverTimestamp();

        listedProducts.forEach(product => {
            if (product.movementQuantity > 0) {
                const stockEntry: Omit<StockEntry, 'id'> = {
                    productId: product.id,
                    productName: product.name,
                    quantity: movementType === 'entry' ? product.movementQuantity : -product.movementQuantity,
                    type: movementType,
                    date,
                    userId: user.id,
                    userName: user.name,
                    branchId: currentBranch.id,
                    organizationId: user.organizationId,
                    notes: product.notes || globalNotes,
                    ...(product.expirationDate && { expirationDate: product.expirationDate }),
                };
                batch.set(doc(collection(db, 'stockEntries')), stockEntry);
            }
        });

        try {
            await batch.commit();
            toast({ title: 'Movimentação em lote salva com sucesso!' });
            router.push('/dashboard/inventory');
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao salvar movimentação', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2"/> Voltar</Button>

            <Card>
                <CardHeader>
                    <CardTitle>Movimentação de Estoque em Lote</CardTitle>
                    <CardDescription>Adicione vários produtos e defina suas quantidades de entrada ou saída.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <RadioGroup value={movementType} onValueChange={(value) => setMovementType(value as MovementType)} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="entry" id="entry"/>
                            <Label htmlFor="entry">Entrada</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="adjustment" id="adjustment"/>
                            <Label htmlFor="adjustment">Saída / Ajuste</Label>
                        </div>
                    </RadioGroup>
                    
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full md:w-[400px]">
                                <PlusCircle className="mr-2"/> Adicionar Produto à Lista
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {products.map(p => (
                                            <CommandItem key={p.id} onSelect={() => addProductToList(p)}>
                                                {p.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    
                    <div className="space-y-2">
                        <Label htmlFor="globalNotes">Observações Gerais (para todos os itens)</Label>
                        <Textarea id="globalNotes" value={globalNotes} onChange={e => setGlobalNotes(e.target.value)} />
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Produtos na Lista ({listedProducts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="w-[100px]">Quantidade</TableHead>
                                {movementType === 'entry' && <TableHead className="w-[180px]">Validade</TableHead>}
                                <TableHead>Observações</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {listedProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Nenhum produto adicionado.</TableCell>
                                </TableRow>
                            )}
                            {listedProducts.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell>
                                        <Input type="number" value={p.movementQuantity} min={1} onChange={e => updateListedProduct(p.id, 'movementQuantity', parseInt(e.target.value, 10) || 1)} />
                                    </TableCell>
                                    {movementType === 'entry' && (
                                        <TableCell>
                                            {p.isPerishable ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {p.expirationDate ? format(p.expirationDate, 'dd/MM/yy') : <span>N/A</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={p.expirationDate} onSelect={(date) => updateListedProduct(p.id, 'expirationDate', date)} /></PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Não perecível</span>
                                            )}
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Input value={p.notes || ''} onChange={e => updateListedProduct(p.id, 'notes', e.target.value)} placeholder="Obs. específica"/>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => removeListedProduct(p.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} disabled={isSaving || listedProducts.length === 0}>
                        {isSaving && <Loader2 className="mr-2 animate-spin"/>}
                        Salvar Movimentação
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}

export default function MovementPage() {
    return (
        <React.Suspense fallback={<div>Carregando...</div>}>
            <MovementPageContent />
        </React.Suspense>
    )
}
