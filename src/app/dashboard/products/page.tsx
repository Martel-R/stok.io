

'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch, getDocs, query, where, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Product, StockEntry, Branch, Supplier } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Upload, Link as LinkIcon, Loader2, ChevronsUpDown, Check, Copy, FileUp, ListChecks, Search, Trash2, Camera, Barcode, Percent, Tag } from 'lucide-react';
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
import { RadioGroup } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { logUserActivity } from '@/lib/logging';


type ProductWithStock = Product & { stock: number };

function BarcodeScannerModal({ isOpen, onOpenChange, onScan }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onScan: (barcode: string) => void; }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasPermission, setHasPermission] = useState(true);
    const isScanningRef = useRef(false);
    const { toast } = useToast();

    useEffect(() => {
        let stream: MediaStream | null = null;
        let animationFrameId: number;

        const startScan = async () => {
            if (!isOpen || !(window as any).BarcodeDetector || isScanningRef.current) {
                return;
            }

            try {
                const barcodeDetector = new (window as any).BarcodeDetector({
                    formats: ['ean_13', 'code_128', 'qr_code', 'upc_a', 'upc_e']
                });
                
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                setHasPermission(true);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                isScanningRef.current = true;

                const detect = async () => {
                    if (!isScanningRef.current) return;
                    try {
                        if (videoRef.current && videoRef.current.readyState === 4) {
                            const barcodes = await barcodeDetector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                isScanningRef.current = false;
                                onScan(barcodes[0].rawValue);
                            }
                        }
                    } catch (error) {
                       console.error("Barcode detection error:", error);
                    }
                    if (isScanningRef.current) {
                       animationFrameId = requestAnimationFrame(detect);
                    }
                };
                detect();

            } catch (err) {
                console.error("Error accessing camera for barcode scanning:", err);
                setHasPermission(false);
                toast({ title: "Permissão da câmera negada", description: "Por favor, permita o acesso à câmera.", variant: 'destructive' });
            }
        };
        
        const stopScan = () => {
             cancelAnimationFrame(animationFrameId);
             isScanningRef.current = false;
             if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };

        if (isOpen) {
            startScan();
        }

        return () => {
           stopScan();
        };
    }, [isOpen, onScan, toast]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) isScanningRef.current = false;
            onOpenChange(open);
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Escanear Código de Barras</DialogTitle>
                    <DialogDescription>Aponte a câmera para o código de barras do produto.</DialogDescription>
                </DialogHeader>
                <div className="p-4 bg-muted rounded-md">
                    {hasPermission ? (
                        <video ref={videoRef} className="w-full rounded-md" playsInline />
                    ) : (
                        <Alert variant="destructive">
                            <AlertTitle>Acesso à Câmera Negado</AlertTitle>
                            <AlertDescription>
                                Você precisa permitir o acesso à câmera para usar esta funcionalidade.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}


function ProductForm({ product, suppliers, onSave, onDone }: { product?: Product; suppliers: Supplier[]; onSave: (product: Omit<Product, 'id' | 'branchId' | 'organizationId'>) => void; onDone: () => void }) {
  const [formData, setFormData] = useState<Partial<Product>>(
    product || { 
        name: '', category: '', price: 0, imageUrl: '', lowStockThreshold: 10, isSalable: true, barcode: '', order: undefined,
        purchasePrice: 0, marginValue: 0, marginType: 'percentage', supplierId: undefined, supplierName: ''
    }
  );
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();

    useEffect(() => {
        setFormData(product || { 
            name: '', category: '', price: 0, imageUrl: '', lowStockThreshold: 10, isSalable: true, barcode: '', order: undefined,
            purchasePrice: 0, marginValue: 0, marginType: 'percentage', supplierId: undefined, supplierName: ''
        });
    }, [product]);

    useEffect(() => {
        const { purchasePrice = 0, marginValue = 0, marginType = 'percentage' } = formData;
        if (purchasePrice > 0) {
            let newPrice = 0;
            if (marginType === 'percentage') {
                newPrice = purchasePrice * (1 + marginValue / 100);
            } else {
                newPrice = purchasePrice + marginValue;
            }
            setFormData(prev => ({...prev, price: newPrice}));
        }
    }, [formData.purchasePrice, formData.marginValue, formData.marginType]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const enableCamera = async () => {
        if (activeTab !== 'camera') {
            if (videoRef.current?.srcObject) {
                const currentStream = videoRef.current.srcObject as MediaStream;
                currentStream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
            return;
        }

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setHasCameraPermission(false);
                toast({ title: 'A câmera não é suportada neste navegador.', variant: 'destructive'});
                return;
            }
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setHasCameraPermission(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setHasCameraPermission(false);
        }
    };
    enableCamera();

    return () => {
         if (stream) {
            stream.getTracks().forEach(track => track.stop());
         }
    }
  }, [activeTab, toast]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const numValue = parseFloat(value);
    
    setFormData(prev => {
        const newForm = {...prev, [name]: type === 'number' ? (isNaN(numValue) ? 0 : numValue) : value};
        
        if (name === 'price') {
             const { purchasePrice = 0 } = newForm;
             if (purchasePrice > 0) {
                 const finalPrice = isNaN(numValue) ? 0 : numValue;
                 const diff = finalPrice - purchasePrice;
                 if (newForm.marginType === 'percentage') {
                     newForm.marginValue = (diff / purchasePrice) * 100;
                 } else {
                     newForm.marginValue = diff;
                 }
             }
        }

        return newForm;
    });
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

  const handleScan = (barcodeValue: string) => {
    setFormData(prev => ({...prev, barcode: barcodeValue}));
    setIsScannerOpen(false);
    toast({ title: "Código de barras lido com sucesso!"});
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find(s => s.id === formData.supplierId);
    onSave({
      ...formData,
      supplierName: supplier ? supplier.name : '',
      imageUrl: formData.imageUrl || 'https://placehold.co/400x400.png'
    } as Omit<Product, 'id' | 'branchId' | 'organizationId'>);
    onDone();
  };

  return (
    <>
    <BarcodeScannerModal isOpen={isScannerOpen} onOpenChange={setIsScannerOpen} onScan={handleScan} />
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
      <div>
        <Label htmlFor="name">Nome do Produto</Label>
        <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
      </div>
       <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Categoria</Label>
          <Input id="category" name="category" value={formData.category || ''} onChange={handleChange} required />
        </div>
         <div>
          <Label htmlFor="barcode">Código de Barras</Label>
           <div className="flex items-center gap-2">
            <Input id="barcode" name="barcode" value={formData.barcode || ''} onChange={handleChange} />
            <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}>
                <Barcode className="h-4 w-4"/>
            </Button>
           </div>
        </div>
      </div>

       <Card>
        <CardHeader><CardTitle>Precificação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 items-start">
                 <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Preço de Compra</Label>
                    <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" value={formData.purchasePrice || ''} onChange={handleChange} required />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="marginValue">Margem de Lucro</Label>
                     <div className="flex items-center gap-2">
                        <Input id="marginValue" name="marginValue" type="number" step="0.01" value={formData.marginValue || ''} onChange={handleChange} />
                         <RadioGroup
                            value={formData.marginType}
                            onValueChange={(val: 'percentage' | 'fixed') => setFormData(prev => ({...prev, marginType: val}))}
                            className="flex"
                        >
                           <Button type="button" variant={formData.marginType === 'percentage' ? 'secondary' : 'outline'} size="icon" onClick={() => setFormData(prev => ({...prev, marginType: 'percentage'}))}><Percent/></Button>
                           <Button type="button" variant={formData.marginType === 'fixed' ? 'secondary' : 'outline'} size="icon" onClick={() => setFormData(prev => ({...prev, marginType: 'fixed'}))}><Tag/></Button>
                        </RadioGroup>
                    </div>
                 </div>
            </div>
             <div>
                <Label htmlFor="price">Preço de Venda (Calculado)</Label>
                <Input id="price" name="price" type="number" step="0.01" value={formData.price || ''} onChange={handleChange} required />
             </div>
        </CardContent>
      </Card>
      
        <div className="space-y-2">
            <Label htmlFor="supplierId">Fornecedor</Label>
            <Select value={formData.supplierId || 'none'} onValueChange={(val) => setFormData(prev => ({...prev, supplierId: val === 'none' ? undefined : val}))}>
                <SelectTrigger>
                    <SelectValue placeholder="Selecione um fornecedor..."/>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lowStockThreshold">Alerta de Estoque Baixo</Label>
          <Input id="lowStockThreshold" name="lowStockThreshold" type="number" value={formData.lowStockThreshold || 0} onChange={handleChange} required />
        </div>
         <div>
          <Label htmlFor="order">Ordem de Exibição</Label>
          <Input id="order" name="order" type="number" value={formData.order || ''} onChange={handleChange} placeholder="Ex: 1" />
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
              <Input id="imageUrl" name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} placeholder="https://exemplo.com/imagem.png" />
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
    </>
  );
}


export default function ProductsPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allStockEntries, setAllStockEntries] = useState<StockEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, currentBranch, branches, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isChangeCategoryDialogOpen, setIsChangeCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [isChangeStockThresholdDialogOpen, setIsChangeStockThresholdDialogOpen] = useState(false);
  const [newLowStockThreshold, setNewLowStockThreshold] = useState(10);
  const [isCopyProductsDialogOpen, setIsCopyProductsDialogOpen] = useState(false);
  const [branchesToCopyTo, setBranchesToCopyTo] = useState<string[]>([]);
  const [isProcessingBulkAction, setIsProcessingBulkAction] = useState(false);
  const [isChangeSupplierDialogOpen, setIsChangeSupplierDialogOpen] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState("");


  const can = useMemo(() => ({
    edit: user?.enabledModules?.products?.edit ?? false,
    delete: user?.enabledModules?.products?.delete ?? false,
  }), [user]);

  useEffect(() => {
    if (authLoading || !currentBranch) {
        setLoading(true);
        return;
    }
    
    const productsQuery = query(collection(db, 'products'), where("branchId", "==", currentBranch.id));
    const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));
    const suppliersQuery = query(collection(db, 'suppliers'), where('organizationId', '==', user?.organizationId), where("isDeleted", "!=", true));

    const unsubs = [
        onSnapshot(productsQuery, snap => {
            setAllProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            setLoading(false);
        }, err => {
            console.error("Error fetching products:", err);
            setLoading(false);
        }),
        onSnapshot(stockEntriesQuery, snap => {
            setAllStockEntries(snap.docs.map(doc => doc.data() as StockEntry));
        }),
        onSnapshot(suppliersQuery, snap => {
            setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
        }),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [currentBranch, authLoading, user]);


  const productsWithStock = useMemo(() => {
     const productsToDisplay = allProducts.filter(p => !p.isDeleted);
     const sortedProducts = [...productsToDisplay].sort((a,b) => {
        if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return a.name.localeCompare(b.name);
    });

    return sortedProducts.map(product => {
        const stock = allStockEntries
            .filter(e => e.productId === product.id)
            .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
        return { ...product, stock };
    });
  }, [allProducts, allStockEntries]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) {
        return productsWithStock;
    }
    return productsWithStock.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [productsWithStock, searchQuery]);


  const handleSave = async (productData: Omit<Product, 'id' | 'branchId' | 'organizationId'>) => {
    if (!currentBranch || !user?.organizationId) {
        toast({ title: 'Nenhuma filial selecionada', variant: 'destructive' });
        return;
    }
    const action = editingProduct?.id ? 'product_updated' : 'product_created';
    try {
      if (editingProduct?.id) {
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, productData);
        toast({ title: 'Produto atualizado!' });
      } else {
        await addDoc(collection(db, "products"), { 
            ...productData, 
            branchId: currentBranch.id, 
            organizationId: user.organizationId,
            isDeleted: false,
        });
        toast({ title: 'Produto adicionado!' });
      }
      logUserActivity({
        userId: user.id,
        userName: user.name,
        organizationId: user.organizationId,
        branchId: currentBranch.id,
        action,
        details: { productId: editingProduct?.id || 'new', productName: productData.name }
      });
    } catch (error) {
      console.error("Error saving product: ", error);
      toast({ title: 'Erro ao salvar produto', variant: 'destructive' });
    }
  };

  const handleDelete = async (product: Product) => {
    if(!user || !currentBranch) return;
    try {
      await updateDoc(doc(db, "products", product.id), { isDeleted: true });
      toast({ title: 'Produto excluído!', variant: 'destructive' });
      logUserActivity({
        userId: user.id,
        userName: user.name,
        organizationId: user.organizationId,
        branchId: currentBranch.id,
        action: 'product_deleted',
        details: { productId: product.id, productName: product.name }
      });
    } catch (error) {
       console.error("Error deleting product: ", error);
       toast({ title: 'Erro ao excluir produto', variant: 'destructive' });
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

  const handleImport = async (importedData: { product: Omit<Product, 'id' | 'branchId' | 'organizationId'>, stock: number }[]) => {
      if (!currentBranch || !user?.organizationId) {
          toast({ title: 'Nenhuma filial selecionada', variant: 'destructive' });
          return;
      }
      const batch = writeBatch(db);
      
      importedData.forEach(({ product, stock }) => {
          const productRef = doc(collection(db, "products"));
          batch.set(productRef, {
              ...product,
              branchId: currentBranch.id,
              organizationId: user.organizationId,
              isDeleted: false,
          });

          if (stock > 0) {
              const stockEntryRef = doc(collection(db, 'stockEntries'));
              const stockEntry: Omit<StockEntry, 'id'> = {
                  productId: productRef.id,
                  productName: product.name,
                  quantity: stock,
                  type: 'entry',
                  date: serverTimestamp(),
                  userId: user!.id,
                  userName: user!.name,
                  branchId: currentBranch.id,
                  organizationId: user!.organizationId,
                  notes: 'Entrada inicial via importação'
              };
              batch.set(stockEntryRef, stockEntry);
          }
      });
      try {
          await batch.commit();
          toast({ title: `${importedData.length} produtos importados com sucesso!` });
          setIsImportOpen(false);
      } catch (error) {
          console.error("Error importing products:", error);
          toast({ title: 'Erro ao importar produtos', variant: 'destructive' });
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
        if (selectedProductIds.length === 0 || !user || !currentBranch) return;
        setIsProcessingBulkAction(true);
        const batch = writeBatch(db);
        selectedProductIds.forEach(id => {
            const product = allProducts.find(p => p.id === id);
            if (product) {
                batch.update(doc(db, 'products', id), { isDeleted: true });
                logUserActivity({
                    userId: user.id,
                    userName: user.name,
                    organizationId: user.organizationId,
                    branchId: currentBranch.id,
                    action: 'product_deleted_bulk',
                    details: { productId: product.id, productName: product.name }
                });
            }
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
        const productsToCopy = allProducts.filter(p => selectedProductIds.includes(p.id));

        const batch = writeBatch(db);
        branchesToCopyTo.forEach(branchId => {
            productsToCopy.forEach(p => {
                const { id, ...productData } = p;
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

     const handleBulkChangeStockThreshold = async () => {
        if (selectedProductIds.length === 0 || newLowStockThreshold < 0) {
            toast({ title: 'Nenhum produto selecionado ou valor inválido', variant: 'destructive' });
            return;
        }
        setIsProcessingBulkAction(true);
        const batch = writeBatch(db);
        selectedProductIds.forEach(id => {
            batch.update(doc(db, 'products', id), { lowStockThreshold: newLowStockThreshold });
        });
        try {
            await batch.commit();
            toast({ title: 'Limite de estoque atualizado com sucesso!' });
            setSelectedProductIds([]);
            setIsChangeStockThresholdDialogOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao atualizar limite de estoque', variant: 'destructive' });
        } finally {
            setIsProcessingBulkAction(false);
        }
    };

    const handleBulkChangeSupplier = async () => {
        if (selectedProductIds.length === 0) {
            toast({ title: 'Nenhum produto selecionado', variant: 'destructive' });
            return;
        }
        setIsProcessingBulkAction(true);
        const batch = writeBatch(db);
        const newSupplier = suppliers.find(s => s.id === newSupplierId);

        selectedProductIds.forEach(id => {
            const productRef = doc(db, 'products', id);
            batch.update(productRef, { 
                supplierId: newSupplierId === 'none' ? undefined : newSupplierId,
                supplierName: newSupplierId === 'none' ? '' : (newSupplier?.name || '')
             });
        });

        try {
            await batch.commit();
            toast({ title: 'Fornecedor atualizado com sucesso para os produtos selecionados!' });
            setSelectedProductIds([]);
            setNewSupplierId("");
            setIsChangeSupplierDialogOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao atualizar fornecedor', variant: 'destructive' });
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
  
    const getMarginDisplay = (product: Product) => {
        const margin = product.marginValue || 0;
        if (product.marginType === 'percentage') {
            return `${margin.toFixed(2)}%`;
        }
        return `R$ ${margin.toFixed(2)}`;
    }

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <div className="flex flex-wrap gap-2">
            {can.edit && selectedProductIds.length > 0 && (
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
                             <DropdownMenuItem onClick={() => setIsChangeStockThresholdDialogOpen(true)}>
                                Alterar Limite de Estoque
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => setIsChangeSupplierDialogOpen(true)}>
                                Alterar Fornecedor
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => setIsCopyProductsDialogOpen(true)}>
                                Copiar para Filial(is)
                            </DropdownMenuItem>
                            {can.delete && <>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2" /> Excluir Selecionados
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </>}
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

            {can.edit && <ImportProductsDialog
                isOpen={isImportOpen}
                onOpenChange={setIsImportOpen}
                onImport={handleImport}
            />}

            {can.edit && <Dialog open={isStockFormOpen} onOpenChange={setIsStockFormOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" disabled={allProducts.length === 0}>
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
                        products={allProducts}
                        onDone={() => setIsStockFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>}

            {can.edit && <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={openNewDialog}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Produto
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</DialogTitle>
                    </DialogHeader>
                    <ProductForm product={editingProduct} suppliers={suppliers} onSave={handleSave} onDone={() => setIsFormOpen(false)} />
                </DialogContent>
            </Dialog>}
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
            {can.edit && <TableHead className="w-[50px]">
                <Checkbox
                    checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todas as linhas"
                />
            </TableHead>}
            <TableHead className="w-[80px]">Imagem</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Comerciável</TableHead>
            <TableHead className="text-right">Preço de Compra</TableHead>
            <TableHead className="text-right">Margem</TableHead>
            <TableHead className="text-right">Preço de Venda</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    {can.edit && <TableCell><Skeleton className="h-5 w-5"/></TableCell>}
                    <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                </TableRow>
            ))
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <TableRow key={product.id} data-state={selectedProductIds.includes(product.id) && "selected"}>
                {can.edit && <TableCell>
                    <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked)}
                        aria-label={`Selecionar ${product.name}`}
                    />
                </TableCell>}
                <TableCell>
                   <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover aspect-square" data-ai-hint="product image" />
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.supplierName || '-'}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>
                    <Badge variant={product.isSalable ? "secondary" : "outline"}>
                        {product.isSalable ? "Sim" : "Não"}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">{(product.purchasePrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                <TableCell className="text-right">{getMarginDisplay(product)}</TableCell>
                <TableCell className="text-right font-semibold">{(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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
                      {can.edit && <DropdownMenuItem onClick={() => openEditDialog(product)}>Editar</DropdownMenuItem>}
                      {can.edit && <DropdownMenuItem onClick={() => handleCopy(product)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </DropdownMenuItem>}
                      {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(product)}>Excluir</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
             <TableRow>
                <TableCell colSpan={can.edit ? 11 : 10} className="h-24 text-center">
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
        
        {/* Dialog for Changing Stock Threshold */}
        <Dialog open={isChangeStockThresholdDialogOpen} onOpenChange={setIsChangeStockThresholdDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Alterar Limite de Estoque Baixo em Lote</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="newLowStockThreshold">Novo Limite</Label>
                    <Input
                        id="newLowStockThreshold"
                        type="number"
                        value={newLowStockThreshold}
                        onChange={(e) => setNewLowStockThreshold(parseInt(e.target.value, 10) || 0)}
                        placeholder="Ex: 10"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsChangeStockThresholdDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBulkChangeStockThreshold} disabled={isProcessingBulkAction}>
                        {isProcessingBulkAction && <Loader2 className="mr-2 animate-spin"/>}
                        Alterar Limite
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Dialog for Changing Supplier */}
        <Dialog open={isChangeSupplierDialogOpen} onOpenChange={setIsChangeSupplierDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Alterar Fornecedor em Lote</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="newSupplier">Novo Fornecedor</Label>
                     <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um fornecedor..."/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsChangeSupplierDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBulkChangeSupplier} disabled={isProcessingBulkAction}>
                        {isProcessingBulkAction && <Loader2 className="mr-2 animate-spin"/>}
                        Alterar Fornecedor
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

