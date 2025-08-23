
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { Product, Kit, DiscountType } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Trash2, Check, ChevronsUpDown, Percent, Tag, Upload, Link as LinkIcon, Loader2, Copy } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { RadioGroup } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from '@/components/ui/checkbox';
import { logUserActivity } from '@/lib/logging';

function KitForm({ kit, branchProducts, onSave, onDone }: { kit?: Kit; branchProducts: Product[]; onSave: (kit: Omit<Kit, 'id' | 'branchId' | 'organizationId'>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<Kit>>(
        kit || { name: '', eligibleProductIds: [], numberOfItems: 3, discountType: 'percentage', discountValue: 10, imageUrl: '' }
    );
    const [isUploading, setIsUploading] = useState(false);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) || 0 : value }));
    };
    
    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          setIsUploading(true);
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
            setIsUploading(false);
          };
          reader.readAsDataURL(file);
        }
    };
    
    const toggleProduct = (productId: string) => {
        setFormData(prev => {
            const newIds = prev.eligibleProductIds?.includes(productId)
                ? prev.eligibleProductIds.filter(id => id !== productId)
                : [...(prev.eligibleProductIds || []), productId];
            return { ...prev, eligibleProductIds: newIds };
        });
    };
    
    const toggleAllProducts = (checked: boolean) => {
        setFormData(prev => {
            const allProductIds = checked ? branchProducts.map(p => p.id) : [];
            return { ...prev, eligibleProductIds: allProductIds };
        });
    };


    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.name || !formData.eligibleProductIds || formData.eligibleProductIds.length < (formData.numberOfItems || 0)) {
            toast({
                title: 'Dados inválidos',
                description: 'O nome do kit é obrigatório e o número de produtos elegíveis não pode ser menor que o número de itens do kit.',
                variant: 'destructive',
            });
            return;
        }
        onSave({ ...formData, imageUrl: formData.imageUrl || 'https://placehold.co/400x400.png', isDeleted: false } as Omit<Kit, 'id' | 'branchId' | 'organizationId'>);
        onDone();
    };
    
    const { toast } = useToast();

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
            <div>
                <Label htmlFor="name">Nome do Kit</Label>
                <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="numberOfItems">Nº de Itens no Kit</Label>
                    <Input id="numberOfItems" name="numberOfItems" type="number" value={formData.numberOfItems || 0} onChange={handleChange} required />
                </div>
            </div>

            <div>
                <Label>Produtos Elegíveis</Label>
                <ScrollArea className="h-48 rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                     <Checkbox
                                        id="select-all-products"
                                        checked={branchProducts.length > 0 && formData.eligibleProductIds?.length === branchProducts.length}
                                        onCheckedChange={(checked) => toggleAllProducts(checked === true)}
                                    />
                                </TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-right">Preço</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {branchProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <Checkbox
                                            id={`product-${product.id}`}
                                            checked={formData.eligibleProductIds?.includes(product.id)}
                                            onCheckedChange={() => toggleProduct(product.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Label htmlFor={`product-${product.id}`} className="font-normal cursor-pointer">{product.name}</Label>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <p className="text-sm text-muted-foreground mt-1">
                    {formData.eligibleProductIds?.length || 0} produto(s) selecionado(s).
                </p>
            </div>

            <Card>
                <CardHeader><CardTitle>Desconto do Kit</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Valor do Desconto</Label>
                            <Input name="discountValue" type="number" value={formData.discountValue || 0} onChange={handleDiscountChange} />
                        </div>
                        <RadioGroup
                            value={formData.discountType}
                            onValueChange={(val: DiscountType) => setFormData(prev => ({...prev, discountType: val}))}
                            className="flex space-x-2"
                        >
                           <Button type="button" variant={formData.discountType === 'percentage' ? 'secondary' : 'outline'} size="icon" onClick={() => setFormData(prev => ({...prev, discountType: 'percentage'}))}><Percent/></Button>
                           <Button type="button" variant={formData.discountType === 'fixed' ? 'secondary' : 'outline'} size="icon" onClick={() => setFormData(prev => ({...prev, discountType: 'fixed'}))}><Tag/></Button>
                        </RadioGroup>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" /> Upload</TabsTrigger>
                <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4" /> URL</TabsTrigger>
              </TabsList>
              <TabsContent value="upload">
                 <div className="space-y-2 mt-4">
                    <Label htmlFor="imageFile">Arquivo da Imagem</Label>
                    <Input id="imageFile" type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading}/>
                    {isUploading && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando imagem...</div>}
                 </div>
              </TabsContent>
              <TabsContent value="url">
                <div className="space-y-2 mt-4">
                  <Label htmlFor="imageUrl">URL da Imagem</Label>
                  <Input id="imageUrl" name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} placeholder="https://exemplo.com/imagem.png" />
                </div>
              </TabsContent>
            </Tabs>

            {formData.imageUrl && (
              <div>
                  <Label>Pré-visualização da Imagem</Label>
                  <div className="mt-2 rounded-md border p-2 flex justify-center items-center">
                    <Image src={formData.imageUrl} alt="Pré-visualização do kit" width={128} height={128} className="rounded-md object-cover aspect-square" data-ai-hint="kit offer"/>
                  </div>
              </div>
            )}

            <Button type="submit" disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar Kit
            </Button>
        </form>
    );
}

export default function KitsPage() {
    const [kits, setKits] = useState<Kit[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingKit, setEditingKit] = useState<Kit | undefined>(undefined);
    const { toast } = useToast();
    const { user, currentBranch, loading: authLoading } = useAuth();
    
    const can = useMemo(() => ({
        edit: user?.enabledModules?.kits?.edit ?? false,
        delete: user?.enabledModules?.kits?.delete ?? false,
    }), [user]);

    useEffect(() => {
        if (authLoading || !currentBranch || !user?.organizationId) {
            setLoading(true);
            return;
        }
        
        const qKits = query(collection(db, 'kits'), where("branchId", "==", currentBranch.id), where('isDeleted', '==', false));
        const qProducts = query(collection(db, 'products'), where("branchId", "==", currentBranch.id), where('isDeleted', '==', false));
        
        const unsubscribeKits = onSnapshot(qKits, (snapshot) => {
            setKits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kit)));
            setLoading(false);
        });

        const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
            const productData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(productData.sort((a,b) => a.name.localeCompare(b.name)));
        });

        return () => {
            unsubscribeKits();
            unsubscribeProducts();
        };
    }, [currentBranch, authLoading, user]);

    const handleSave = async (kitData: Omit<Kit, 'id' | 'branchId' | 'organizationId'>) => {
        if (!currentBranch || !user?.organizationId) {
            toast({ title: 'Filial ou organização não encontrada.', variant: 'destructive' });
            return;
        }
        const isEditing = !!editingKit?.id;
        const action = isEditing ? 'kit_updated' : 'kit_created';
        try {
            if (isEditing) {
                await updateDoc(doc(db, "kits", editingKit.id!), kitData);
                toast({ title: 'Kit atualizado com sucesso!' });
            } else {
                await addDoc(collection(db, "kits"), {
                    ...kitData,
                    branchId: currentBranch.id,
                    organizationId: user.organizationId,
                });
                toast({ title: 'Kit adicionado com sucesso!' });
            }
            logUserActivity({
                userId: user.id,
                userName: user.name,
                organizationId: user.organizationId,
                branchId: currentBranch.id,
                action,
                details: { kitId: editingKit?.id || 'new', kitName: kitData.name }
            });
        } catch (error) {
            console.error("Error saving kit: ", error);
            toast({ title: 'Erro ao salvar kit.', variant: 'destructive' });
        }
    };

    const handleDelete = async (kit: Kit) => {
        if (!user || !currentBranch) return;
        try {
            await updateDoc(doc(db, "kits", kit.id), { isDeleted: true });
            toast({ title: 'Kit excluído com sucesso!', variant: 'destructive' });
            logUserActivity({
                userId: user.id,
                userName: user.name,
                organizationId: user.organizationId,
                branchId: currentBranch.id,
                action: 'kit_deleted',
                details: { kitId: kit.id, kitName: kit.name }
            });
        } catch (error) {
            toast({ title: 'Erro ao excluir kit.', variant: 'destructive' });
        }
    };

    const handleCopy = async (kit: Kit) => {
        const { id, ...kitToCopy } = kit;
        const newKitData = {
            ...kitToCopy,
            name: `${kit.name} (Cópia)`,
        };
        await handleSave(newKitData);
    }
    
    const openEditDialog = (kit: Kit) => {
        setEditingKit(kit);
        setIsFormOpen(true);
    };

    const openNewDialog = () => {
        setEditingKit(undefined);
        setIsFormOpen(true);
    };

    if (!currentBranch && !authLoading) {
        return (
            <Card className="m-auto">
                <CardHeader><CardTitle>Nenhuma Filial Selecionada</CardTitle></CardHeader>
                <CardContent>
                    <p>Por favor, selecione uma filial no topo da página para ver os kits.</p>
                    <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Ajustes</Link>.</p>
                </CardContent>
            </Card>
        );
    }
    
    const getProductNames = (ids: string[]) => {
        return ids.map(id => products.find(p => p.id === id)?.name || 'Produto desconhecido').slice(0, 3);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h1 className="text-3xl font-bold">Kits Dinâmicos</h1>
                {can.edit && <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" />Adicionar Kit</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingKit ? 'Editar Kit' : 'Adicionar Novo Kit'}</DialogTitle>
                        </DialogHeader>
                        <KitForm
                            kit={editingKit}
                            branchProducts={products}
                            onSave={handleSave}
                            onDone={() => setIsFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>}
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Itens</TableHead>
                        <TableHead>Desconto</TableHead>
                        <TableHead>Produtos Elegíveis (Exemplos)</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                                <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : kits.length > 0 ? (
                        kits.map((kit) => (
                            <TableRow key={kit.id}>
                                <TableCell className="font-medium">{kit.name}</TableCell>
                                <TableCell>{kit.numberOfItems}</TableCell>
                                <TableCell>{kit.discountValue.toLocaleString('pt-BR')}{kit.discountType === 'percentage' ? '%' : ' R$'}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {getProductNames(kit.eligibleProductIds).map(name => (
                                            <Badge key={name} variant="secondary">{name}</Badge>
                                        ))}
                                        {kit.eligibleProductIds.length > 3 && <Badge variant="outline">...</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Abrir menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {can.edit && <DropdownMenuItem onClick={() => openEditDialog(kit)}>Editar</DropdownMenuItem>}
                                            {can.edit && <DropdownMenuItem onClick={() => handleCopy(kit)}>
                                                <Copy className="mr-2 h-4 w-4" />
                                                Copiar
                                            </DropdownMenuItem>}
                                            {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(kit)}>Excluir</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                Nenhum kit encontrado. Comece a criar seus kits dinâmicos!
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
    

