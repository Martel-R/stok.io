
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { Product, Combo, ComboProduct } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Upload, Link as LinkIcon, Loader2, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


function ComboForm({ combo, branchProducts, onSave, onDone }: { combo?: Combo; branchProducts: Product[]; onSave: (combo: Omit<Combo, 'id' | 'branchId'>) => void; onDone: () => void }) {
  const [formData, setFormData] = useState<Partial<Combo>>(
    combo || { name: '', price: 0, products: [], imageUrl: '' }
  );
  const [isUploading, setIsUploading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  };

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
  
  const addProductToCombo = (product: Product) => {
    setFormData(prev => {
        const existingProduct = prev.products?.find(p => p.productId === product.id);
        if (existingProduct) {
            return prev; // Or increment quantity, for now just prevent duplicates
        }
        const newProduct: ComboProduct = { productId: product.id, productName: product.name, quantity: 1 };
        return { ...prev, products: [...(prev.products || []), newProduct] };
    });
    setPopoverOpen(false);
  }

  const removeProductFromCombo = (productId: string) => {
    setFormData(prev => ({
        ...prev,
        products: prev.products?.filter(p => p.productId !== productId)
    }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.products || formData.products.length === 0) {
        alert("Por favor, preencha o nome do combo e adicione pelo menos um produto.");
        return;
    }
    onSave({
      ...formData,
      imageUrl: formData.imageUrl || 'https://placehold.co/400x400.png'
    } as Omit<Combo, 'id' | 'branchId'>);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome do Combo</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div>
        <Label htmlFor="price">Preço do Combo</Label>
        <Input id="price" name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} required />
      </div>
       <div>
        <Label>Produtos no Combo</Label>
         <div className="space-y-2 rounded-md border p-2">
            {formData.products?.map(p => (
                <div key={p.productId} className="flex items-center justify-between">
                    <span className="text-sm">{p.productName} (x{p.quantity})</span>
                     <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeProductFromCombo(p.productId)}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                     </Button>
                </div>
            ))}
             <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Produto
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar produto..." />
                        <CommandList>
                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                            <CommandGroup>
                                {branchProducts.map((product) => (
                                    <CommandItem
                                        key={product.id}
                                        value={product.name}
                                        onSelect={() => addProductToCombo(product)}
                                    >
                                        {product.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
         </div>
       </div>

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
              <Input id="imageUrl" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://exemplo.com/imagem.png" />
            </div>
          </TabsContent>
        </Tabs>
      
      {formData.imageUrl && (
          <div>
              <Label>Pré-visualização da Imagem</Label>
              <div className="mt-2 rounded-md border p-2 flex justify-center items-center">
                <Image src={formData.imageUrl} alt="Pré-visualização do combo" width={128} height={128} className="rounded-md object-cover aspect-square" data-ai-hint="combo offer" />
              </div>
          </div>
      )}

      <Button type="submit" disabled={isUploading}>
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salvar Combo
      </Button>
    </form>
  );
}

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | undefined>(undefined);
  const { toast } = useToast();
  const { currentBranch, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !currentBranch) {
        setLoading(true);
        return;
    }
    
    const combosRef = collection(db, 'combos');
    const qCombos = query(combosRef, where("branchId", "==", currentBranch.id));

    const productsRef = collection(db, 'products');
    const qProducts = query(productsRef, where("branchId", "==", currentBranch.id));

    const unsubscribeCombos = onSnapshot(qCombos, (snapshot) => {
      const combosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Combo[];
      setCombos(combosData);
      setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
        setProducts(productsData);
    });

    return () => {
        unsubscribeCombos();
        unsubscribeProducts();
    };
  }, [currentBranch, authLoading, toast]);

  const handleSave = async (comboData: Omit<Combo, 'id' | 'branchId'>) => {
    if (!currentBranch) {
        toast({ title: 'Nenhuma filial selecionada', description: 'Selecione uma filial para salvar o combo.', variant: 'destructive' });
        return;
    }
    try {
      if (editingCombo?.id) {
        const comboRef = doc(db, "combos", editingCombo.id);
        await updateDoc(comboRef, comboData);
        toast({ title: 'Combo atualizado com sucesso!' });
      } else {
        await addDoc(collection(db, "combos"), { ...comboData, branchId: currentBranch.id });
        toast({ title: 'Combo adicionado com sucesso!' });
      }
    } catch (error) {
      console.error("Error saving combo: ", error);
      toast({ title: 'Erro ao salvar combo', description: 'Ocorreu um erro, por favor tente novamente.', variant: 'destructive' });
    }
  };

  const handleDelete = async (comboId: string) => {
    try {
      await deleteDoc(doc(db, "combos", comboId));
      toast({ title: 'Combo excluído com sucesso!', variant: 'destructive' });
    } catch (error) {
       console.error("Error deleting combo: ", error);
       toast({ title: 'Erro ao excluir combo', description: 'Ocorreu um erro, por favor tente novamente.', variant: 'destructive' });
    }
  };
  
  const openEditDialog = (combo: Combo) => {
    setEditingCombo(combo);
    setIsFormOpen(true);
  }
  
  const openNewDialog = () => {
    setEditingCombo(undefined);
    setIsFormOpen(true);
  }

  if (!currentBranch && !authLoading) {
    return (
        <Card className="m-auto">
            <CardHeader>
                <CardTitle>Nenhuma Filial Selecionada</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Por favor, selecione uma filial no topo da página para ver os combos.</p>
                <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Configurações</Link>.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Combos Promocionais</h1>
        <div className="flex gap-2">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={openNewDialog}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Combo
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingCombo ? 'Editar Combo' : 'Adicionar Novo Combo'}</DialogTitle>
                    </DialogHeader>
                    <ComboForm 
                        combo={editingCombo} 
                        branchProducts={products}
                        onSave={handleSave} 
                        onDone={() => setIsFormOpen(false)} 
                    />
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Imagem</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Produtos</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
             Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                </TableRow>
            ))
          ) : combos.length > 0 ? (
            combos.map((combo) => (
              <TableRow key={combo.id}>
                <TableCell>
                   <Image src={combo.imageUrl} alt={combo.name} width={40} height={40} className="rounded-md object-cover aspect-square" data-ai-hint="combo offer" />
                </TableCell>
                <TableCell className="font-medium">{combo.name}</TableCell>
                <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {combo.products.map(p => <Badge key={p.productId} variant="secondary">{p.productName}</Badge>)}
                    </div>
                </TableCell>
                <TableCell className="text-right">R${combo.price.toFixed(2).replace('.', ',')}</TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(combo)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(combo.id)}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
             <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                    Nenhum combo encontrado. Comece a criar seus combos promocionais!
                </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
