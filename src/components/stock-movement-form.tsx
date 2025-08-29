
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import type { Product, Branch, StockEntry, StockEntryType } from '@/lib/types';
import { db } from '@/lib/firebase';
import { writeBatch, collection, doc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore';
import { Check, ChevronsUpDown, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DialogFooter } from './ui/dialog';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StockMovementFormProps {
    type: 'entry' | 'adjustment' | 'transfer';
    products: Product[];
    branches?: Branch[];
    onDone: () => void;
}

export function StockMovementForm({ type, products, branches = [], onDone }: StockMovementFormProps) {
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [destinationBranch, setDestinationBranch] = useState<Branch | null>(null);
    const [expirationDate, setExpirationDate] = useState<Date | undefined>();
    const [openProductPopover, setOpenProductPopover] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const sortedProducts = [...products].sort((a,b) => a.name.localeCompare(b.name));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        if (!selectedProduct || quantity <= 0 || !user || !currentBranch) {
            toast({ title: "Dados inválidos", description: "Verifique os campos e tente novamente.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        if (type === 'transfer' && !destinationBranch) {
            toast({ title: "Filial de destino obrigatória", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        const batch = writeBatch(db);
        const date = serverTimestamp();
        let destinationProductId = selectedProduct.id;

        // For transfers, check if product exists in destination branch. If not, create it.
        if (type === 'transfer' && destinationBranch) {
             const productsRef = collection(db, 'products');
             const q = query(
                 productsRef, 
                 where('branchId', '==', destinationBranch.id), 
                 where('name', '==', selectedProduct.name),
                 limit(1)
             );
            
            const existingProductSnap = await getDocs(q);
            
            if (existingProductSnap.empty) {
                // Product does not exist, create it in the destination branch
                const { id, branchId, organizationId, ...productToCopy } = selectedProduct as any; // 'stock' is not part of Product type
                const newProductRef = doc(collection(db, 'products'));
                batch.set(newProductRef, {
                    ...productToCopy,
                    branchId: destinationBranch.id,
                    organizationId: user.organizationId
                });
                destinationProductId = newProductRef.id;
            } else {
                // Product exists, use its ID for the stock entry
                destinationProductId = existingProductSnap.docs[0].id;
            }
        }


        // Outgoing entry (from currentBranch)
        const outgoingEntry: Omit<StockEntry, 'id'> = {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity: type === 'entry' ? quantity : -quantity,
            type: type,
            date,
            userId: user.id,
            userName: user.name,
            branchId: currentBranch.id,
            organizationId: user.organizationId,
            notes: type === 'transfer' ? `Para: ${destinationBranch!.name}` : notes,
            ...(type === 'transfer' && { relatedBranchId: destinationBranch!.id, relatedBranchName: destinationBranch!.name }),
            ...(expirationDate && { expirationDate }),
        };
        batch.set(doc(collection(db, 'stockEntries')), outgoingEntry);

        // Incoming entry for transfers
        if (type === 'transfer' && destinationBranch) {
            const incomingEntry: Omit<StockEntry, 'id'> = {
                productId: destinationProductId, // Use the correct product ID for the destination
                productName: selectedProduct.name,
                quantity: quantity,
                type: 'transfer',
                date,
                userId: user.id,
                userName: user.name,
                branchId: destinationBranch.id,
                organizationId: user.organizationId,
                notes: `De: ${currentBranch.name}`,
                relatedBranchId: currentBranch.id,
                relatedBranchName: currentBranch.name,
                 ...(expirationDate && { expirationDate }),
            };
            batch.set(doc(collection(db, 'stockEntries')), incomingEntry);
        }

        try {
            await batch.commit();
            toast({ title: 'Movimentação registrada com sucesso!' });
            onDone();
        } catch (error) {
            console.error('Error creating stock movement:', error);
            toast({ title: 'Erro ao registrar movimentação', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div>
                <Label>Produto</Label>
                <Popover open={openProductPopover} onOpenChange={setOpenProductPopover}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between">
                            {selectedProduct ? selectedProduct.name : "Selecione um produto..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Buscar produto..." />
                            <CommandList>
                                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                <CommandGroup>
                                    {sortedProducts.map(p => (
                                        <CommandItem
                                            key={p.id}
                                            value={p.name}
                                            onSelect={() => {
                                                setSelectedProduct(p);
                                                setOpenProductPopover(false);
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", selectedProduct?.id === p.id ? "opacity-100" : "opacity-0")} />
                                            {p.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="quantity">Quantidade</Label>
                    <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                        required
                    />
                </div>
                 {type === 'entry' && selectedProduct?.isPerishable && (
                     <div>
                        <Label>Data de Validade</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {expirationDate ? format(expirationDate, 'PPP', { locale: ptBR }) : <span>Escolha a data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={expirationDate} onSelect={setExpirationDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </div>

            {type === 'transfer' && (
                <div>
                    <Label>Filial de Destino</Label>
                    <Select
                        onValueChange={(branchId) => {
                            const branch = branches.find(b => b.id === branchId);
                            setDestinationBranch(branch || null);
                        }}
                        required
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione a filial de destino" />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map(b => (
                                <SelectItem key={b.id} value={b.id}>
                                    {b.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {type !== 'transfer' && (
                 <div>
                    <Label htmlFor="notes">Observações (Opcional)</Label>
                    <Textarea
                        id="notes"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder={type === 'entry' ? 'Ex: Compra do fornecedor X' : 'Ex: Produto quebrado'}
                    />
                </div>
            )}

            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onDone} disabled={isLoading}>Cancelar</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Salvando...' : 'Salvar Movimentação'}
                </Button>
            </DialogFooter>
        </form>
    );
}
