
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import type { Product, Combo, ComboProduct, ComboDiscountRule, PaymentCondition, DiscountType } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Upload, Link as LinkIcon, Loader2, Trash2, Check, ChevronsUpDown, Percent, Tag } from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';


const calculatePrices = (products: ComboProduct[], rules: ComboDiscountRule[]): { originalPrice: number, finalPrice: number } => {
    const originalPrice = products.reduce((acc, p) => acc + (p.productPrice * p.quantity), 0);
    // Find the default rule (no specific payment conditions) to display a representative final price.
    const defaultRule = rules.find(r => !r.paymentConditionIds || r.paymentConditionIds.length === 0);
    let finalPrice = originalPrice;

    if (defaultRule) {
        if (defaultRule.discountType === 'percentage') {
            finalPrice = originalPrice * (1 - (defaultRule.discountValue || 0) / 100);
        } else {
            finalPrice = originalPrice - (defaultRule.discountValue || 0);
        }
    }
    
    return { originalPrice, finalPrice: Math.max(0, finalPrice) };
};

function ComboForm({ combo, branchProducts, paymentConditions, onSave, onDone }: { combo?: Combo; branchProducts: Product[]; paymentConditions: PaymentCondition[]; onSave: (combo: Omit<Combo, 'id' | 'branchId' | 'organizationId'>) => void; onDone: () => void }) {
  const [formData, setFormData] = useState<Partial<Combo>>(
    combo || { name: '', products: [], discountRules: [], imageUrl: '' }
  );
  const [isUploading, setIsUploading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { originalPrice, finalPrice } = useMemo(
    () => calculatePrices(formData.products || [], formData.discountRules || []), 
    [formData.products, formData.discountRules]
  );

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
            return prev;
        }
        const newProduct: ComboProduct = { productId: product.id, productName: product.name, productPrice: product.price, quantity: 1 };
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
  
  const updateDiscountRule = (index: number, field: keyof ComboDiscountRule, value: any) => {
    setFormData(prev => {
        const newRules = [...(prev.discountRules || [])];
        (newRules[index] as any)[field] = value;
        return { ...prev, discountRules: newRules };
    });
  };

  const addDiscountRule = () => {
      setFormData(prev => ({
          ...prev,
          discountRules: [...(prev.discountRules || []), { paymentConditionIds: [], discountType: 'percentage', discountValue: 0 }]
      }));
  }
  
  const removeDiscountRule = (index: number) => {
      setFormData(prev => ({
          ...prev,
          discountRules: prev.discountRules?.filter((_, i) => i !== index)
      }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.products || formData.products.length === 0) {
        alert("Por favor, preencha o nome do kit e adicione pelo menos um produto.");
        return;
    }
    const prices = calculatePrices(formData.products, formData.discountRules || []);
    onSave({
      ...formData,
      originalPrice: prices.originalPrice,
      finalPrice: prices.finalPrice,
      imageUrl: formData.imageUrl || 'https://placehold.co/400x400.png'
    } as Omit<Combo, 'id' | 'branchId' | 'organizationId'>);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
      <div>
        <Label htmlFor="name">Nome do Kit</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>

       <div>
        <Label>Produtos no Kit</Label>
         <div className="space-y-2 rounded-md border p-2">
            {formData.products?.map(p => (
                <div key={p.productId} className="flex items-center justify-between">
                    <span className="text-sm">{p.productName} (R$ {p.productPrice.toFixed(2)})</span>
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

      <Card>
        <CardHeader>
            <CardTitle>Preço e Descontos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex justify-between items-baseline">
                <Label>Preço Original</Label>
                <span className="text-muted-foreground text-lg line-through">R$ {originalPrice.toFixed(2)}</span>
            </div>
             <div className="flex justify-between items-baseline">
                <Label>Preço Final (Padrão)</Label>
                <span className="font-bold text-xl text-primary">R$ {finalPrice.toFixed(2)}</span>
            </div>
            
            <Separator />
            
            <Label>Regras de Desconto</Label>
            <div className="space-y-3">
                {formData.discountRules?.map((rule, index) => (
                    <div key={index} className="border p-3 rounded-md space-y-3 relative">
                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeDiscountRule(index)}>
                             <Trash2 className="h-4 w-4 text-destructive"/>
                         </Button>

                        <div className="space-y-2">
                          <Label>Condição de Pagamento</Label>
                           <Select 
                              value={(rule.paymentConditionIds && rule.paymentConditionIds[0]) || 'default'} 
                              onValueChange={(val) => updateDiscountRule(index, 'paymentConditionIds', val === 'default' ? [] : [val])}
                            >
                               <SelectTrigger>
                                  <SelectValue placeholder="Selecione..."/>
                               </SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="default">Desconto Padrão (Qualquer Pagamento)</SelectItem>
                                   {paymentConditions.map(pc => (
                                      <SelectItem key={pc.id} value={pc.id}>{pc.name}</SelectItem>
                                   ))}
                               </SelectContent>
                           </Select>
                           <p className="text-xs text-muted-foreground">"Padrão" se aplica se nenhuma outra regra específica for encontrada.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Valor do Desconto</Label>
                                <Input type="number" value={rule.discountValue} onChange={(e) => updateDiscountRule(index, 'discountValue', parseFloat(e.target.value) || 0)} />
                            </div>
                            <RadioGroup 
                                value={rule.discountType} 
                                onValueChange={(val: DiscountType) => updateDiscountRule(index, 'discountType', val)}
                                className="flex space-x-2"
                            >
                               <Button type="button" variant={rule.discountType === 'percentage' ? 'secondary' : 'outline'} size="icon" onClick={() => updateDiscountRule(index, 'discountType', 'percentage')}><Percent/></Button>
                               <Button type="button" variant={rule.discountType === 'fixed' ? 'secondary' : 'outline'} size="icon" onClick={() => updateDiscountRule(index, 'discountType', 'fixed')}><Tag/></Button>
                            </RadioGroup>
                        </div>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" onClick={addDiscountRule} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Regra de Desconto
            </Button>
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
              <Input id="imageUrl" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://exemplo.com/imagem.png" />
            </div>
          </TabsContent>
        </Tabs>
      
      {formData.imageUrl && (
          <div>
              <Label>Pré-visualização da Imagem</Label>
              <div className="mt-2 rounded-md border p-2 flex justify-center items-center">
                <Image src={formData.imageUrl} alt="Pré-visualização do kit" width={128} height={128} className="rounded-md object-cover aspect-square" data-ai-hint="combo offer" />
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

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentConditions, setPaymentConditions] = useState<PaymentCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | undefined>(undefined);
  const { toast } = useToast();
  const { user, currentBranch, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !currentBranch || !user?.organizationId) {
        setLoading(true);
        return;
    }
    
    const combosRef = collection(db, 'combos');
    const qCombos = query(combosRef, where("branchId", "==", currentBranch.id));

    const productsRef = collection(db, 'products');
    const qProducts = query(productsRef, where("branchId", "==", currentBranch.id));
    
    const conditionsQuery = query(collection(db, 'paymentConditions'), where("organizationId", "==", user.organizationId));

    const unsubscribeCombos = onSnapshot(qCombos, (snapshot) => {
      const combosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Combo[];
      setCombos(combosData);
      setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
        setProducts(productsData);
    });
    
    const unsubscribeConditions = onSnapshot(conditionsQuery, (snapshot) => {
        const conditionsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as PaymentCondition);
        setPaymentConditions(conditionsData);
    });


    return () => {
        unsubscribeCombos();
        unsubscribeProducts();
        unsubscribeConditions();
    };
  }, [currentBranch, authLoading, user]);

  const handleSave = async (comboData: Omit<Combo, 'id' | 'branchId' | 'organizationId'>) => {
    if (!currentBranch || !user?.organizationId) {
        toast({ title: 'Nenhuma filial ou organização selecionada', description: 'Selecione uma filial para salvar o kit.', variant: 'destructive' });
        return;
    }
    try {
      if (editingCombo?.id) {
        const comboRef = doc(db, "combos", editingCombo.id);
        await updateDoc(comboRef, comboData);
        toast({ title: 'Kit atualizado com sucesso!' });
      } else {
        await addDoc(collection(db, "combos"), { 
            ...comboData, 
            branchId: currentBranch.id,
            organizationId: user.organizationId,
        });
        toast({ title: 'Kit adicionado com sucesso!' });
      }
    } catch (error) {
      console.error("Error saving combo: ", error);
      toast({ title: 'Erro ao salvar kit', description: 'Ocorreu um erro, por favor tente novamente.', variant: 'destructive' });
    }
  };

  const handleDelete = async (comboId: string) => {
    try {
      await deleteDoc(doc(db, "combos", comboId));
      toast({ title: 'Kit excluído com sucesso!', variant: 'destructive' });
    } catch (error) {
       console.error("Error deleting combo: ", error);
       toast({ title: 'Erro ao excluir kit', description: 'Ocorreu um erro, por favor tente novamente.', variant: 'destructive' });
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
                <p>Por favor, selecione uma filial no topo da página para ver os kits.</p>
                <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Ajustes</Link>.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Kits Promocionais</h1>
        <div className="flex gap-2">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={openNewDialog}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Kit
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingCombo ? 'Editar Kit' : 'Adicionar Novo Kit'}</DialogTitle>
                    </DialogHeader>
                    <ComboForm 
                        combo={editingCombo} 
                        branchProducts={products}
                        paymentConditions={paymentConditions}
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
            <TableHead className="text-right">Preço Original</TableHead>
            <TableHead className="text-right">Preço Final</TableHead>
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
                <TableCell className="text-right line-through text-muted-foreground">R$ {combo.originalPrice.toFixed(2).replace('.', ',')}</TableCell>
                <TableCell className="text-right font-semibold">R$ {combo.finalPrice.toFixed(2).replace('.', ',')}</TableCell>
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
                <TableCell colSpan={6} className="h-24 text-center">
                    Nenhum kit encontrado. Comece a criar seus kits promocionais!
                </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

    