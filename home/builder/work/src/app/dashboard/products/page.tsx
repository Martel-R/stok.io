

'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch, getDocs, query, where, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Product, StockEntry, Branch } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Upload, Link as LinkIcon, Loader2, ChevronsUpDown, Check, Copy, FileUp, ListChecks, Search, Trash2, Camera } from 'lucide-react';
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
import { fromUnixTime } from 'date-fns';
import { ImportProductsDialog } from '@/components/import-products-dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { StockMovementForm } from '@/components/stock-movement-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type ProductWithStock = Product & { stock: number };

function ProductForm({ product, onSave, onDone }: { product?: Product; onSave: (product: Omit<Product, 'id' | 'branchId' | 'organizationId'>) => void; onDone: () => void }) {
  const [formData, setFormData] = useState<Partial<Product>>(
    product || { name: '', category: '', price: 0, imageUrl: '', lowStockThreshold: 10, isSalable: true }
  );
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const enableCamera = async () => {
        if (activeTab !== 'camera') {
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
            return;
        }

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setHasCameraPermission(false);
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error(err);
            setHasCameraPermission(false);
        }
    };
    enableCamera();

    return () => {
         if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
         }
    }
  }, [activeTab]);


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
  
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    
    const dataUrl = canvas.toDataURL('image/png');
    setFormData(prev => ({...prev, imageUrl: dataUrl}));
    toast({title: "Imagem capturada!"});
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      imageUrl: formData.imageUrl || 'https://placehold.co/400x400.png'
    } as Omit<Product, 'id' | 'branchId' | 'organizationId'>);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
      <div>
        <Label htmlFor="name">Nome do Produto</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div>
        <Label htmlFor="category">Categoria</Label>
        <Input id="category" name="category" value={formData.category} onChange={handleChange} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Preço</Label>
          <Input id="price" name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="lowStockThreshold">Limite para Estoque Baixo</Label>
          <Input id="lowStockThreshold" name="lowStockThreshold" type="number" value={formData.lowStockThreshold} onChange={handleChange} required />
        </div>
      </div>
      
       <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" /> Upload</TabsTrigger>
            <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4" /> URL</TabsTrigger>
            <TabsTrigger value="camera"><Camera className="mr-2 h-4 w-4" /> Câmera</TabsTrigger>
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
           <TabsContent value="camera">
               <div className="space-y-2 mt-4">
                  <video ref={videoRef} className={cn("w-full aspect-video rounded-md bg-muted", !hasCameraPermission && "hidden")} autoPlay muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  {!hasCameraPermission && (
                      <Alert variant="destructive">
                        <Camera className="h-4 w-4" />
                        <AlertTitle>Acesso à câmera negado</AlertTitle>
                        <AlertDescription>
                            Para usar este recurso, permita o acesso à câmera nas configurações do seu navegador.
                        </AlertDescription>
                      </Alert>
                  )}
                  <Button type="button" onClick={handleCapture} disabled={!hasCameraPermission} className="w-full">
                      <Camera className="mr-2 h-4 w-4" /> Capturar Foto
                  </Button>
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

      <div className="flex items-center space-x-2">
        <Switch 
          id="isSalable" 
          checked={formData.isSalable} 
          onCheckedChange={(checked) => setFormData(prev => ({...prev, isSalable: checked}))}
        />
        <Label htmlFor="isSalable">Produto Comerciável</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar Produto
        </Button>
      </DialogFooter>
    </form>
  );
}


export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, currentBranch, branches, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  // States for new bulk actions
  const [isChangeCategoryDialogOpen, setIsChangeCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [isCopyProductsDialogOpen, setIsCopyProductsDialogOpen] = useState(false);
  const [branchesToCopyTo, setBranchesToCopyTo] = useState<string[]>([]);
  const [isProcessingBulkAction, setIsProcessingBulkAction] = useState(false);


  useEffect(() => {
    if (authLoading || !currentBranch || !user?.organizationId) {
        setLoading(true);
        return;
    }
    
    const productsRef = collection(db, 'products');
    const qProducts = query(productsRef, where("branchId", "==", currentBranch.id));

    const unsubscribeProducts = onSnapshot(qProducts, (productsSnapshot) => {
      const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      
      const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));
      
      const unsubEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
          const entriesData = entriesSnapshot.docs.map(doc => doc.data() as StockEntry);

          const productsWithStock = productsData.map(product => {
              const stock = entriesData
                  .filter(e => e.productId === product.id)
                  .reduce((sum, e) => {
                      const quantity = e.quantity || 0; // Ensure quantity is a number
                      return sum + quantity;
                  }, 0);
              return { ...product, stock };
          });
          
          setProducts(productsWithStock.sort((a,b) => a.name.localeCompare(b.name)));
          setLoading(false);
      });
      return () => unsubEntries();
    }, (error) => {
        console.error("Error fetching products:", error);
        toast({title: "Erro ao buscar produtos", variant: "destructive"});
        setLoading(false);
    });

    return () => unsubscribeProducts();
  }, [currentBranch, authLoading, toast, user]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) {
        return products;
    }
    return products.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);


  const handleSave = async (productData: Omit<Product, 'id' | 'branchId' | 'organizationId'>) => {
    if (!currentBranch || !user?.organizationId) {
        toast({ title: 'Nenhuma filial selecionada', description: 'Selecione uma filial para salvar o produto.', variant: 'destructive' });
        return;
    }
    try {
      if (editingProduct?.id) {
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, productData);
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        await addDoc(collection(db, "products"), { 
            ...productData, 
            branchId: currentBranch.id, 
            organizationId: user.organizationId
        });
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

  const handleCopy = async (product: ProductWithStock) => {
    const { id, stock, ...productToCopy } = product;
    const newProductData = {
        ...productToCopy,
        name: `${product.name} (Cópia)`,
    };
    await handleSave(newProductData);
  }

  const handleImport = async (importedProducts: Omit<Product, 'id' | 'branchId' | 'organizationId'>[]) => {
      if (!currentBranch || !user?.organizationId) {
          toast({ title: 'Nenhuma filial selecionada', description: 'Selecione uma filial para importar os produtos.', variant: 'destructive' });
          return;
      }
      const batch = writeBatch(db);
      importedProducts.forEach(productData => {
          const productRef = doc(collection(db, "products"));
          batch.set(productRef, {
              ...productData,
              branchId: currentBranch.id,
              organizationId: user.organizationId
          });
      });
      try {
          await batch.commit();
          toast({ title: `${importedProducts.length} produtos importados com sucesso!` });
          setIsImportOpen(false);
      } catch (error) {
          console.error("Error importing products:", error);
          toast({ title: 'Erro ao importar produtos', description: 'Não foi possível salvar os produtos. Verifique o arquivo e tente novamente.', variant: 'destructive' });
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
  
  const handleSelectProduct = (productId: string, checked: boolean | 'indeterminate') => {
    setSelectedProductIds(prev => 
        checked ? [...prev, productId] : prev.filter(id => id !== productId)
    );
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked) {
        setSelectedProductIds(filteredProducts.map(p => p.id));
    } else {
        setSelectedProductIds([]);
    }
  };
  
    const handleBulkDelete = async () => {
        if (selectedProductIds.length === 0) return;
        setIsProcessingBulkAction(true);
        const batch = writeBatch(db);
        selectedProductIds.forEach(id => {
            batch.delete(doc(db, 'products', id));
        });
        try {
            await batch.commit();
            toast({ title: 'Produtos selecionados foram excluídos!' });
            setSelectedProductIds([]);
        } catch (error) {
            toast({ title: 'Erro ao excluir produtos', variant: 'destructive' });
        } finally {
            setIsProcessingBulkAction(false);
        }
    };
    
    const handleBulkChangeCategory = async () => {
        if (selectedProductIds.length === 0 || !newCategory.trim()) {
            toast({ title: 'Nenhuma categoria ou produto selecionado', variant: 'destructive' });
            return;
        }
        setIsProcessingBulkAction(true);
        const batch = writeBatch(db);
        selectedProductIds.forEach(id => {
            batch.update(doc(db, 'products', id), { category: newCategory });
        });
        try {
            await batch.commit();
            toast({ title: 'Categorias atualizadas com sucesso!' });
            setSelectedProductIds([]);
            setNewCategory("");
            setIsChangeCategoryDialogOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao atualizar categorias', variant: 'destructive' });
        } finally {
            setIsProcessingBulkAction(false);
        }
    };

    const handleBulkCopy = async () => {
        if (selectedProductIds.length === 0 || branchesToCopyTo.length === 0) {
            toast({ title: 'Nenhum produto ou filial de destino selecionado', variant: 'destructive' });
            return;
        }
        setIsProcessingBulkAction(true);
        const productsToCopy = products.filter(p => selectedProductIds.includes(p.id));

        branchesToCopyTo.forEach(branchId => {
            productsToCopy.forEach(p => {
                const { id, stock, branchId: sourceBranchId, ...productData } = p;
                const newProductRef = doc(collection(db, 'products'));
                batch.set(newProductRef, {
                    ...productData,
                    branchId: branchId,
                    organizationId: user?.organizationId
                });
            });
        });

        try {
            await batch.commit();
            toast({ title: 'Produtos copiados com sucesso!' });
            setSelectedProductIds([]);
            setBranchesToCopyTo([]);
            setIsCopyProductsDialogOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao copiar produtos', variant: 'destructive' });
        } finally {
            setIsProcessingBulkAction(false);
        }
    };
  
    const handleBulkUpdateSalable = async (isSalable: boolean) => {
        if (selectedProductIds.length === 0) {
            toast({ title: 'Nenhum produto selecionado', variant: 'destructive' });
            return;
        }
        setIsProcessingBulkAction(true);
        const batch = writeBatch(db);
        selectedProductIds.forEach(id => {
            const productRef = doc(db, 'products', id);
            batch.update(productRef, { isSalable });
        });

        try {
            await batch.commit();
            toast({ title: `${selectedProductIds.length} produtos atualizados com sucesso!` });
            setSelectedProductIds([]);
        } catch (error) {
            toast({ title: 'Erro ao atualizar produtos', variant: 'destructive' });
        } finally {
            setIsProcessingBulkAction(false);
        }
    };


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
       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <div className="flex flex-wrap gap-2">
            {selectedProductIds.length > 0 && (
                 <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <ListChecks className="mr-2" />
                                Ações em Lote ({selectedProductIds.length})
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleBulkUpdateSalable(true)}>
                                Marcar como Comerciável
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkUpdateSalable(false)}>
                                Marcar como Não Comerciável
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsChangeCategoryDialogOpen(true)}>
                                Alterar Categoria
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => setIsCopyProductsDialogOpen(true)}>
                                Copiar para Filial(is)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                 <DropdownMenuItem className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2" /> Excluir Selecionados
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Produtos</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir os {selectedProductIds.length} produtos selecionados? Esta ação é irreversível.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkDelete} disabled={isProcessingBulkAction} className={buttonVariants({variant: 'destructive'})}>
                                {isProcessingBulkAction && <Loader2 className="mr-2 animate-spin"/>}
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            <ImportProductsDialog
                isOpen={isImportOpen}
                onOpenChange={setIsImportOpen}
                onImport={handleImport}
            />

            <Dialog open={isStockFormOpen} onOpenChange={setIsStockFormOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" disabled={products.length === 0}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Estoque
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Estoque</DialogTitle>
                    </DialogHeader>
                     <StockMovementForm 
                        type="entry"
                        products={products}
                        onDone={() => setIsStockFormOpen(false)}
                    />
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
      
       <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome ou categoria..."
            className="w-full rounded-lg bg-background pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>


      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
                <Checkbox
                    checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todas as linhas"
                />
            </TableHead>
            <TableHead className="w-[80px]">Imagem</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Comerciável</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-5"/></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                </TableRow>
            ))
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <TableRow key={product.id} data-state={selectedProductIds.includes(product.id) && "selected"}>
                <TableCell>
                    <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked)}
                        aria-label={`Selecionar ${product.name}`}
                    />
                </TableCell>
                <TableCell>
                   <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover aspect-square" data-ai-hint="product image" />
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>
                    <Badge variant={product.isSalable ? "secondary" : "outline"}>
                        {product.isSalable ? "Sim" : "Não"}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">R${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
                       <DropdownMenuItem onClick={() => handleCopy(product)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(product.id)}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
             <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                    Nenhum produto encontrado. Adicione produtos para começar.
                </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      
       {/* Dialog for Changing Category */}
        <Dialog open={isChangeCategoryDialogOpen} onOpenChange={setIsChangeCategoryDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Alterar Categoria em Lote</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="newCategory">Nova Categoria</Label>
                    <Input
                        id="newCategory"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Digite a nova categoria"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsChangeCategoryDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBulkChangeCategory} disabled={isProcessingBulkAction}>
                        {isProcessingBulkAction && <Loader2 className="mr-2 animate-spin"/>}
                        Alterar Categoria
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Dialog for Copying Products */}
        <Dialog open={isCopyProductsDialogOpen} onOpenChange={setIsCopyProductsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Copiar Produtos para Outras Filiais</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label>Filiais de Destino</Label>
                    <Command>
                       <CommandInput placeholder="Buscar filial..." />
                       <CommandList>
                            <CommandEmpty>Nenhuma filial encontrada.</CommandEmpty>
                            <CommandGroup>
                                {branches.filter(b => b.id !== currentBranch?.id).map((branch) => (
                                    <CommandItem
                                        key={branch.id}
                                        value={branch.name}
                                        onSelect={() => {
                                            setBranchesToCopyTo(prev => 
                                                prev.includes(branch.id) 
                                                    ? prev.filter(id => id !== branch.id) 
                                                    : [...prev, branch.id]
                                            );
                                        }}
                                    >
                                        <Checkbox
                                            className="mr-2"
                                            checked={branchesToCopyTo.includes(branch.id)}
                                        />
                                        {branch.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsCopyProductsDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBulkCopy} disabled={isProcessingBulkAction || branchesToCopyTo.length === 0}>
                         {isProcessingBulkAction && <Loader2 className="mr-2 animate-spin"/>}
                        Copiar Produtos
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </div>
  );
}
