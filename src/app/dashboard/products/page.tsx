

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { logUserActivity } from '@/lib/logging';
import CurrencyInput from 'react-currency-input-field';
import { Html5Qrcode } from 'html5-qrcode';


type ProductWithStock = Product & { stock: number };

function BarcodeScannerModal({ isOpen, onOpenChange, onScan }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onScan: (barcode: string) => void; }) {
    const [hasPermission, setHasPermission] = useState(true);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const { toast } = useToast();
    const regionId = "reader-products";

    const playBeep = () => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const audioCtx = audioCtxRef.current;
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1); 
        } catch (e) {
            console.warn("Error playing synthetic beep:", e);
        }
    };

    const toggleTorch = async () => {
        if (!scannerRef.current || !hasTorch) return;
        try {
            const newState = !isTorchOn;
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: newState }] as any
            });
            setIsTorchOn(newState);
        } catch (err) {
            console.error("Error toggling torch:", err);
        }
    };

    useEffect(() => {
        let isMounted = true;

        if (isOpen) {
            setIsTorchOn(false);
            setHasTorch(false);
            setTimeout(() => {
                if (!isMounted || !document.getElementById(regionId)) return;

                const html5QrCode = new Html5Qrcode(regionId, true);
                scannerRef.current = html5QrCode;

                const config = { 
                    fps: 20, 
                    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                        const widthPct = 0.85;
                        const heightPct = 0.35; 
                        const width = Math.max(Math.floor(viewfinderWidth * widthPct), 200);
                        const height = Math.max(Math.floor(viewfinderHeight * heightPct), 100);
                        return { width, height };
                    },
                    aspectRatio: 1.0,
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true
                    },
                    formatsToSupport: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ],
                    videoConstraints: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };

                html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        console.log("Barcode detected successfully (Products Page):", decodedText);
                        playBeep();
                        onScan(decodedText);
                        stopScanner();
                    },
                    () => {} // Empty error callback for stability
                ).then(() => {
                    // Safe way to get the running track
                    let track: MediaStreamTrack | undefined;
                    try {
                        if (typeof (html5QrCode as any).getRunningTrack === 'function') {
                            track = (html5QrCode as any).getRunningTrack();
                        } else {
                            const videoElement = document.querySelector(`#${regionId} video`) as HTMLVideoElement;
                            if (videoElement && videoElement.srcObject) {
                                track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
                            }
                        }

                        if (track) {
                            const capabilities = track.getCapabilities() as any;
                            if (capabilities.torch) {
                                setHasTorch(true);
                            }
                        }
                    } catch (e) {
                        console.warn("Could not detect torch capabilities:", e);
                    }
                }).catch(err => {
                    console.error("Critical error starting scanner (Products Page):", err);
                    if (isMounted) setHasPermission(false);
                });
                console.log("Scanner started on element:", regionId);
            }, 100);
        }

        return () => {
            isMounted = false;
            stopScanner();
        };
    }, [isOpen]);

    const stopScanner = () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
            }).catch(err => console.error("Error stopping scanner:", err));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) stopScanner();
            onOpenChange(open);
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                        Escanear Código de Barras
                        {hasTorch && (
                            <Button 
                                variant={isTorchOn ? "secondary" : "outline"} 
                                size="sm" 
                                onClick={toggleTorch}
                                className="h-8 gap-2"
                            >
                                {isTorchOn ? "Desligar Luz" : "Ligar Luz"}
                            </Button>
                        )}
                    </DialogTitle>
                    <DialogDescription>Aponte a câmera para o código de barras. Se estiver escuro, use a lanterna.</DialogDescription>
                </DialogHeader>
                <div className="p-4 bg-black rounded-md overflow-hidden min-h-[300px] flex items-center justify-center relative">
                    {!hasPermission && (
                        <Alert variant="destructive" className="z-10 absolute inset-4 w-auto">
                            <AlertTitle>Erro na Câmera</AlertTitle>
                            <AlertDescription>
                                Não foi possível acessar a câmera ou o scanner falhou ao iniciar.
                            </AlertDescription>
                        </Alert>
                    )}
                    <div id={regionId} className="w-full h-full"></div>
                    
                    {hasPermission && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-[85%] h-[35%] border-2 border-white/70 rounded-lg relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-[3px] bg-red-500 shadow-[0_0_15px_red] animate-scan-line" />
                            </div>
                        </div>
                    )}
                </div>
                <div className="text-center text-xs text-muted-foreground mt-2">
                    Dica: Mantenha o código centralizado e evite reflexos.
                </div>
                <DialogFooter>
                    <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function ProductForm({ product, suppliers, branches, onSave, onDone }: { product?: Product; suppliers: Supplier[]; branches: Branch[]; onSave: (product: Omit<Product, 'id' | 'organizationId'>) => void; onDone: () => void }) {
  const { currentBranch } = useAuth();
  const [formData, setFormData] = useState<Partial<Product>>(
    product || { 
        name: '', category: '', price: 0, imageUrl: '', lowStockThreshold: 10, isSalable: true, barcode: '', order: undefined,
        purchasePrice: 0, marginValue: 0, marginType: 'percentage', supplierId: undefined, supplierName: '',
        brand: '', model: '', isPerishable: false, branchIds: currentBranch ? [currentBranch.id] : [],
        saleType: 'unit', unitOfMeasure: 'UN'
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
            purchasePrice: 0, marginValue: 0, marginType: 'percentage', supplierId: undefined, supplierName: '',
            brand: '', model: '', isPerishable: false, branchIds: currentBranch ? [currentBranch.id] : [],
            saleType: 'unit', unitOfMeasure: 'UN'
        });
    }, [product, currentBranch]);

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
        return {...prev, [name]: type === 'number' ? (isNaN(numValue) ? 0 : numValue) : value};
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

  const handleBranchSelect = (branchId: string) => {
    setFormData(prev => {
        const newIds = prev.branchIds?.includes(branchId)
            ? prev.branchIds.filter(id => id !== branchId)
            : [...(prev.branchIds || []), branchId];
        return { ...prev, branchIds: newIds };
    });
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find(s => s.id === formData.supplierId);
    await onSave({
      ...formData,
      supplierName: supplier ? supplier.name : '',
      imageUrl: formData.imageUrl || 'https://placehold.co/400x400.png'
    } as Omit<Product, 'id' | 'organizationId'>);
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="saleType">Tipo de Venda</Label>
          <Select value={formData.saleType || 'unit'} onValueChange={(val: 'unit' | 'weight') => setFormData(prev => ({...prev, saleType: val, unitOfMeasure: val === 'weight' ? 'KG' : 'UN'}))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unit">Por Unidade</SelectItem>
              <SelectItem value="weight">Por Peso/Medida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="unitOfMeasure">Unidade de Medida</Label>
          <Input id="unitOfMeasure" name="unitOfMeasure" value={formData.unitOfMeasure || ''} onChange={handleChange} placeholder="Ex: UN, KG, G, L" required />
        </div>
      </div>
       <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="brand">Marca</Label>
          <Input id="brand" name="brand" value={formData.brand || ''} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" name="model" value={formData.model || ''} onChange={handleChange} />
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
                <CurrencyInput
                    id="price"
                    name="price"
                    required
                    value={formData.price}
                    onValueChange={(value) => {
                        const numValue = parseFloat(value || '0');
                        setFormData(prev => {
                            const newForm = {...prev, price: numValue};
                            const { purchasePrice = 0 } = newForm;
                            if (purchasePrice > 0) {
                                const diff = numValue - purchasePrice;
                                if (newForm.marginType === 'percentage') {
                                    newForm.marginValue = (diff / purchasePrice) * 100;
                                } else {
                                    newForm.marginValue = diff;
                                }
                            }
                            return newForm;
                        });
                    }}
                    prefix="R$ "
                    decimalSeparator=","
                    groupSeparator="."
                    decimalsLimit={2}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
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

         <div className="space-y-2">
            <Label>Filiais</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                        {formData.branchIds?.length || 0} filial(is) selecionada(s)
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar filial..." />
                        <CommandList>
                            <CommandEmpty>Nenhuma filial encontrada.</CommandEmpty>
                            <CommandGroup>
                                {branches.map((branch) => (
                                    <CommandItem
                                        key={branch.id}
                                        value={branch.name}
                                        onSelect={() => handleBranchSelect(branch.id)}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", formData.branchIds?.includes(branch.id) ? "opacity-100" : "opacity-0")} />
                                        {branch.name}
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

        <div className="flex items-center justify-between rounded-lg border p-3">
             <div className="space-y-0.5">
                <Label htmlFor="isPerishable">Produto Perecível</Label>
                <p className="text-xs text-muted-foreground">Marque se o produto requer controle de validade.</p>
            </div>
            <Switch 
                id="isPerishable" 
                checked={formData.isPerishable} 
                onCheckedChange={(checked) => setFormData(prev => ({...prev, isPerishable: checked}))}
            />
        </div>
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
  const [sortConfig, setSortConfig] = useState<{ key: keyof ProductWithStock; direction: 'asc' | 'desc' } | null>(null);
  
  const [isChangeCategoryDialogOpen, setIsChangeCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [isChangeStockThresholdDialogOpen, setIsChangeStockThresholdDialogOpen] = useState(false);
  const [newLowStockThreshold, setNewLowStockThreshold] = useState(10);
  const [isCopyProductsDialogOpen, setIsCopyProductsDialogOpen] = useState(false);
  const [branchesToCopyTo, setBranchesToCopyTo] = useState<string[]>([]);
  const [isProcessingBulkAction, setIsProcessingBulkAction] = useState(false);
  const [isChangeSupplierDialogOpen, setIsChangeSupplierDialogOpen] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState("");
  const [isChangePriceDialogOpen, setIsChangePriceDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState<number | ''>('');


  const can = useMemo(() => ({
    edit: user?.enabledModules?.products?.edit ?? false,
    delete: user?.enabledModules?.products?.delete ?? false,
  }), [user]);

  useEffect(() => {
    if (authLoading || !user?.organizationId) {
        setLoading(true);
        return;
    }

    if (!currentBranch) {
        setAllProducts([]);
        setAllStockEntries([]);
        setLoading(false);
        return;
    }
    
    const productsQuery = query(collection(db, 'products'), where("organizationId", "==", user.organizationId));
    const stockEntriesQuery = query(collection(db, 'stockEntries'), where('organizationId', '==', user.organizationId), where('branchId', '==', currentBranch.id));
    const suppliersQuery = query(collection(db, 'suppliers'), where('organizationId', '==', user.organizationId), where("isDeleted", "!=", true));

    setLoading(true);
    const unsubs = [
        onSnapshot(productsQuery, snap => {
            const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            const filtered = products.filter(p => 
                (p.branchIds && p.branchIds.includes(currentBranch.id)) || 
                (p.branchId === currentBranch.id)
            );
            setAllProducts(filtered);
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
  }, [authLoading, user, currentBranch]);


  const productsWithStock = useMemo(() => {
     const productsToDisplay = allProducts.filter(p => !p.isDeleted);
     
     const sortedProducts = [...productsToDisplay].sort((a,b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
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
    let result = productsWithStock;
    
    if (searchQuery) {
        result = result.filter(product => 
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    if (sortConfig) {
        result = [...result].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    return result;
  }, [productsWithStock, searchQuery, sortConfig]);

  const handleSort = (key: keyof ProductWithStock) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  const handleSave = async (productData: Omit<Product, 'id' | 'organizationId'>) => {
    if (!user?.organizationId) {
        toast({ title: 'Nenhuma organização selecionada', variant: 'destructive' });
        return;
    }
    const action = editingProduct?.id ? 'product_updated' : 'product_created';
    const finalProductData = {
        ...productData,
        branchId: productData.branchIds?.[0] || currentBranch?.id || '', // Backward compatibility
    };
    try {
      if (editingProduct?.id) {
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, finalProductData);
        toast({ title: 'Produto atualizado!' });
      } else {
        await addDoc(collection(db, "products"), { 
            ...finalProductData,
            organizationId: user.organizationId,
            isDeleted: false,
        });
        toast({ title: 'Produto adicionado!' });
      }
      logUserActivity({
        userId: user.id,
        userName: user.name,
        organizationId: user.organizationId,
        branchId: currentBranch?.id,
        action,
        details: { productId: editingProduct?.id || 'new', productName: productData.name }
      });
      setIsFormOpen(false);
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

  const handleImport = async (importedData: { product: Omit<Product, 'id' | 'organizationId' | 'branchId'>, stock: number }[]) => {
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
              branchIds: [currentBranch.id],
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
        if (selectedProductIds.length === 0 || branchesToCopyTo.length === 0 || !user?.organizationId) {
            toast({ title: 'Nenhum produto ou filial de destino selecionado', variant: 'destructive' });
            return;
        }
        setIsProcessingBulkAction(true);
        const productsToCopy = allProducts.filter(p => selectedProductIds.includes(p.id));

        const batch = writeBatch(db);
        productsToCopy.forEach(p => {
             const existingBranchIds = p.branchIds || [];
             const newBranchIds = [...new Set([...existingBranchIds, ...branchesToCopyTo])];
             batch.update(doc(db, 'products', p.id), { branchIds: newBranchIds });
        });

        try {
            await batch.commit();
            toast({ title: 'Produtos compartilhados com sucesso!' });
            setSelectedProductIds([]);
            setBranchesToCopyTo([]);
            setIsCopyProductsDialogOpen(false);
        } catch (error) {
            console.error("Error copying products:", error);
            toast({ title: 'Erro ao compartilhar produtos', variant: 'destructive' });
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

    const handleBulkChangePrice = async () => {
        if (selectedProductIds.length === 0 || newPrice === '' || newPrice < 0) {
            toast({ title: 'Nenhum produto selecionado ou preço inválido', variant: 'destructive' });
            return;
        }
        setIsProcessingBulkAction(true);
        const batch = writeBatch(db);
        selectedProductIds.forEach(id => {
            batch.update(doc(db, 'products', id), { price: newPrice });
        });
        try {
            await batch.commit();
            toast({ title: 'Preço atualizado com sucesso!' });
            setSelectedProductIds([]);
            setNewPrice('');
            setIsChangePriceDialogOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao atualizar o preço', variant: 'destructive' });
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
                            <DropdownMenuItem onClick={() => setIsChangePriceDialogOpen(true)}>
                                Alterar Preço de Venda
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => setIsCopyProductsDialogOpen(true)}>
                                Compartilhar com Filial(is)
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
                        <DialogDescription>
                            {editingProduct ? 'Atualize as informações do produto selecionado.' : 'Preencha os dados abaixo para cadastrar um novo produto no catálogo.'}
                        </DialogDescription>
                    </DialogHeader>
                    <ProductForm product={editingProduct} suppliers={suppliers} branches={branches} onSave={handleSave} onDone={() => setIsFormOpen(false)} />
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
            <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                    Nome
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('category')}>
                <div className="flex items-center gap-1">
                    Categoria
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('isSalable')}>
                <div className="flex items-center gap-1">
                    Comerciável
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('purchasePrice')}>
                <div className="flex items-center justify-end gap-1">
                    Preço de Compra
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('marginValue')}>
                <div className="flex items-center justify-end gap-1">
                    Margem
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('price')}>
                <div className="flex items-center justify-end gap-1">
                    Preço de Venda
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('stock')}>
                <div className="flex items-center justify-end gap-1">
                    Estoque
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    {can.edit && <TableCell><Skeleton className="h-5 w-5"/></TableCell>}
                    <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
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
                      {can.edit && <DropdownMenuItem onSelect={() => setTimeout(() => openEditDialog(product), 0)}>Editar</DropdownMenuItem>}
                      {can.edit && <DropdownMenuItem onSelect={() => handleCopy(product)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </DropdownMenuItem>}
                      {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onSelect={() => handleDelete(product)}>Excluir</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
             <TableRow>
                <TableCell colSpan={can.edit ? 10 : 9} className="h-24 text-center">
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
                    <DialogDescription>
                        Esta alteração será aplicada a todos os produtos selecionados ({selectedProductIds.length}).
                    </DialogDescription>
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
                    <DialogDescription>
                        Define o novo limite para disparar alertas de estoque baixo para os itens selecionados.
                    </DialogDescription>
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
                    <DialogDescription>
                        Selecione o novo fornecedor que será atribuído aos produtos selecionados.
                    </DialogDescription>
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
                    <DialogTitle>Compartilhar Produtos com Outras Filiais</DialogTitle>
                    <DialogDescription>
                        Os produtos selecionados ficarão disponíveis nas filiais escolhidas abaixo.
                    </DialogDescription>
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
                        Compartilhar Produtos
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Dialog for Changing Price */}
        <Dialog open={isChangePriceDialogOpen} onOpenChange={setIsChangePriceDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Alterar Preço de Venda em Lote</DialogTitle>
                    <DialogDescription>
                        Define o novo preço de venda para os produtos selecionados. Use com cautela.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="newPrice">Novo Preço de Venda</Label>
                    <Input
                        id="newPrice"
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(parseFloat(e.target.value) || '')}
                        placeholder="Ex: 99.90"
                        step="0.01"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsChangePriceDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBulkChangePrice} disabled={isProcessingBulkAction}>
                        {isProcessingBulkAction && <Loader2 className="mr-2 animate-spin"/>}
                        Alterar Preço
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </div>
  );
}

