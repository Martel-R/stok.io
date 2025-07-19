
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Product, StockEntry } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Upload, Link as LinkIcon, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

function ProductForm({ product, onSave, onDone }: { product?: Product; onSave: (product: Omit<Product, 'id' | 'branchId'>) => void; onDone: () => void }) {
  const [formData, setFormData] = useState<Partial<Product>>(
    product || { name: '', category: '', price: 0, stock: 0, imageUrl: '' }
  );
  const [isUploading, setIsUploading] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      imageUrl: formData.imageUrl || 'https://placehold.co/400x400.png'
    } as Omit<Product, 'id' | 'branchId'>);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome do Produto</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div>
        <Label htmlFor="category">Categoria</Label>
        <Input id="category" name="category" value={formData.category} onChange={handleChange} required />
      </div>
      <div>
        <Label htmlFor="price">Preço</Label>
        <Input id="price" name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} required />
      </div>
       <div>
        <Label htmlFor="stock">Estoque Inicial</Label>
        <Input id="stock" name="stock" type="number" value={formData.stock} onChange={handleChange} required />
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
                <Image src={formData.imageUrl} alt="Pré-visualização do produto" width={128} height={128} className="rounded-md object-cover aspect-square" data-ai-hint="product image" />
              </div>
          </div>
      )}

      <Button type="submit" disabled={isUploading}>
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salvar Produto
      </Button>
    </form>
  );
}


function AddStockForm({ products, onDone }: { products: Product[]; onDone: () => void }) {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [open, setOpen] = useState(false);
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || quantity <= 0 || !user || !currentBranch) {
            toast({ title: "Dados inválidos", description: "Selecione um produto e informe uma quantidade maior que zero.", variant: "destructive" });
            return;
        }

        const productRef = doc(db, 'products', selectedProduct.id);
        const stockEntryRef = collection(db, 'stockEntries');

        try {
            await runTransaction(db, async (transaction) => {
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) {
                    throw "Produto não encontrado!";
                }

                const currentStock = productDoc.data().stock;
                const newStock = currentStock + quantity;

                transaction.update(productRef, { stock: newStock });

                const newStockEntry: Omit<StockEntry, 'id'> = {
                    productId: selectedProduct.id,
                    productName: selectedProduct.name,
                    quantityAdded: quantity,
                    previousStock: currentStock,
                    newStock: newStock,
                    date: serverTimestamp(),
                    userId: user.id,
                    userName: user.name,
                    branchId: currentBranch.id,
                }
                transaction.set(doc(stockEntryRef), newStockEntry);
            });

            toast({ title: "Estoque atualizado!", description: `${quantity} unidades de ${selectedProduct.name} adicionadas.` });
            onDone();
        } catch (error) {
            console.error("Erro ao adicionar estoque:", error);
            toast({ title: "Erro na transação", description: "Não foi possível atualizar o estoque.", variant: "destructive" });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <Label>Produto</Label>
                 <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between"
                        >
                            <span className="truncate">{selectedProduct?.name || "Selecione o produto..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                        <Command>
                            <CommandInput placeholder="Buscar produto..." />
                            <CommandList>
                                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                <CommandGroup>
                                    {products.map((product) => (
                                        <CommandItem
                                            key={product.id}
                                            value={product.name}
                                            onSelect={() => {
                                                setSelectedProduct(product);
                                                setOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {product.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {selectedProduct && (
                <p className="text-sm text-muted-foreground">Estoque atual: {selectedProduct.stock}</p>
            )}

            <div>
                <Label htmlFor="quantity">Quantidade a Adicionar</Label>
                <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                    required
                />
            </div>
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Entrada</Button>
            </DialogFooter>
        </form>
    );
}


export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const { toast } = useToast();
  const { currentBranch, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !currentBranch) {
        setLoading(true);
        return;
    }
    
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where("branchId", "==", currentBranch.id));

    const seedDatabase = async () => {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        console.log("Nenhum produto encontrado para esta filial. Semeando com dados de exemplo...");
        const batch = writeBatch(db);
        MOCK_PRODUCTS.forEach((product) => {
          const docRef = doc(productsRef);
          batch.set(docRef, {...product, branchId: currentBranch.id });
        });
        await batch.commit();
        toast({ title: 'Bem-vindo à sua nova filial!', description: 'Adicionamos alguns produtos de exemplo para você começar.' });
      }
    };

    seedDatabase();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(productsData.sort((a,b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }, (error) => {
        console.error("Error fetching products:", error);
        toast({title: "Erro ao buscar produtos", variant: "destructive"});
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranch, authLoading, toast]);

  const handleSave = async (productData: Omit<Product, 'id' | 'branchId'>) => {
    if (!currentBranch) {
        toast({ title: 'Nenhuma filial selecionada', description: 'Selecione uma filial para salvar o produto.', variant: 'destructive' });
        return;
    }
    try {
      if (editingProduct?.id) {
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, productData);
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        await addDoc(collection(db, "products"), { ...productData, branchId: currentBranch.id });
        toast({ title: 'Produto adicionado com sucesso!' });
      }
    } catch (error) {
      console.error("Error saving product: ", error);
      toast({ title: 'Erro ao salvar produto', description: 'Ocorreu um erro, por favor tente novamente.', variant: 'destructive' });
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteDoc(doc(db, "products", productId));
      toast({ title: 'Produto excluído com sucesso!', variant: 'destructive' });
    } catch (error) {
       console.error("Error deleting product: ", error);
       toast({ title: 'Erro ao excluir produto', description: 'Ocorreu um erro, por favor tente novamente.', variant: 'destructive' });
    }
  };
  
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  }
  
  const openNewDialog = () => {
    setEditingProduct(undefined);
    setIsFormOpen(true);
  }

  if (!currentBranch && !authLoading) {
    return (
        <Card className="m-auto">
            <CardHeader>
                <CardTitle>Nenhuma Filial Selecionada</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Por favor, selecione uma filial no topo da página para ver os produtos.</p>
                <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Configurações</Link>.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <div className="flex gap-2">
            <Dialog open={isStockFormOpen} onOpenChange={setIsStockFormOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Estoque
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Estoque</DialogTitle>
                    </DialogHeader>
                    <AddStockForm products={products} onDone={() => setIsStockFormOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={openNewDialog}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Produto
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</DialogTitle>
                    </DialogHeader>
                    <ProductForm product={editingProduct} onSave={handleSave} onDone={() => setIsFormOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Imagem</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                </TableRow>
            ))
          ) : (
            products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                   <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover aspect-square" data-ai-hint="product image" />
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell className="text-right">R${product.price.toFixed(2).replace('.', ',')}</TableCell>
                <TableCell className="text-right">{product.stock}</TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(product)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(product.id)}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
