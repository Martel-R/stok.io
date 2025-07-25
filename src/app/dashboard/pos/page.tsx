

'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, writeBatch, doc, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Sale, PaymentCondition, PaymentDetail, Combo, PaymentConditionType, StockEntry } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, X, Loader2, PlusCircle, Trash2, Gift, Package, History, TrendingUp, TrendingDown, Minus, Archive } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, getMonth, getYear, subMonths, startOfDay, fromUnixTime } from 'date-fns';


type CartItem = (ProductWithStock & { itemType: 'product'; quantity: number }) | (ComboWithStock & { itemType: 'combo'; quantity: number });
type ProductWithStock = Product & { stock: number };
type ComboWithStock = Combo & { stock: number };


interface AggregatedDailySale {
    date: string;
    totalQuantity: number;
    totalAmount: number;
}

interface MonthlyPaymentSummary {
    [key: string]: {
        currentMonthTotal: number;
        previousMonthTotal: number;
        change: number;
    }
}


function CheckoutModal({
  isOpen,
  onOpenChange,
  cart,
  grandTotal,
  onCheckout,
  paymentConditions
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cart: CartItem[];
  grandTotal: number;
  onCheckout: (payments: PaymentDetail[]) => Promise<void>;
  paymentConditions: PaymentCondition[];
}) {
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const paidAmount = useMemo(() => payments.reduce((acc, p) => acc + p.amount, 0), [payments]);
  const remainingAmount = useMemo(() => grandTotal - paidAmount, [grandTotal, paidAmount]);

  useEffect(() => {
    if (isOpen) {
      if (grandTotal > 0 && paymentConditions.length > 0) {
        setPayments([{
          conditionId: paymentConditions[0]?.id || '',
          conditionName: paymentConditions[0]?.name || '',
          amount: grandTotal,
          installments: 1,
          type: paymentConditions[0]?.type || 'cash',
        }]);
      } else {
        setPayments([]);
      }
    } else {
      setPayments([]);
    }
  }, [isOpen, grandTotal, paymentConditions]);


  const handleAddPayment = () => {
    if (remainingAmount <= 0) return;
    setPayments(prev => [...prev, {
      conditionId: paymentConditions[0]?.id || '',
      conditionName: paymentConditions[0]?.name || '',
      amount: remainingAmount,
      installments: 1,
      type: paymentConditions[0]?.type || 'cash',
    }]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaymentChange = (index: number, field: keyof PaymentDetail, value: any) => {
    setPayments(prev => {
      const newPayments = [...prev];
      const payment = { ...newPayments[index] };
      (payment[field] as any) = value;

      if (field === 'conditionId') {
        const condition = paymentConditions.find(c => c.id === value);
        payment.conditionName = condition?.name || '';
        payment.type = condition?.type || 'cash';
        if (payment.type !== 'credit') {
            payment.installments = 1;
        }
      }
      
      newPayments[index] = payment;
      return newPayments;
    });
  };

  const handleSubmit = async () => {
    if (Math.abs(remainingAmount) > 0.01) {
      toast({ title: 'Valor não bate', description: `A soma dos pagamentos deve ser igual ao total. Faltam R$${remainingAmount.toFixed(2)}`, variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    await onCheckout(payments);
    setIsProcessing(false);
    onOpenChange(false);
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar Compra</DialogTitle>
          <DialogDescription>Selecione as formas de pagamento para o total de <span className="font-bold">R${grandTotal.toFixed(2).replace('.', ',')}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {payments.map((payment, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3 relative">
              {payments.length > 1 && (
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemovePayment(index)}>
                      <Trash2 className="h-4 w-4 text-destructive"/>
                  </Button>
              )}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Label>Forma de Pagamento</Label>
                    <Select
                      value={payment.conditionId}
                      onValueChange={(val) => handlePaymentChange(index, 'conditionId', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentConditions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label htmlFor={`amount-${index}`}>Valor</Label>
                    <Input
                      id={`amount-${index}`}
                      type="number"
                      value={payment.amount}
                      onChange={(e) => handlePaymentChange(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="text-right"
                    />
                 </div>
              </div>
              {payment.type === 'credit' && (
                <div>
                  <Label htmlFor={`installments-${index}`}>Parcelas</Label>
                  <Input
                    id={`installments-${index}`}
                    type="number"
                    min={1}
                    value={payment.installments}
                    onChange={(e) => handlePaymentChange(index, 'installments', parseInt(e.target.value) || 1)}
                  />
                </div>
              )}
               {(payment.type === 'credit' || payment.type === 'debit') && (
                <div>
                  <Label htmlFor={`receiptCode-${index}`}>Código do Comprovante</Label>
                  <Input
                    id={`receiptCode-${index}`}
                    type="text"
                    value={payment.receiptCode || ''}
                    onChange={(e) => handlePaymentChange(index, 'receiptCode', e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              )}
            </div>
          ))}
          {remainingAmount > 0.01 && (
             <Button variant="outline" onClick={handleAddPayment} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4"/> Adicionar Outra Forma de Pagamento
             </Button>
          )}
        </div>
        <DialogFooter className="grid grid-cols-2 gap-4">
            <div className="text-left">
                <p>Total Pago: <span className="font-bold">R${paidAmount.toFixed(2).replace('.',',')}</span></p>
                <p className={remainingAmount !== 0 ? 'text-destructive' : ''}>
                    Restante: <span className="font-bold">R${remainingAmount.toFixed(2).replace('.',',')}</span>
                </p>
            </div>
            <Button onClick={handleSubmit} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4"/>}
                Confirmar Pagamento
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const convertSaleDoc = (doc: any): Sale => {
    const data = doc.data();
    let date;
    if (data.date instanceof Timestamp) {
        date = data.date.toDate();
    } else if (data.date && typeof data.date.seconds === 'number') {
        date = fromUnixTime(data.date.seconds);
    } else {
        date = new Date(); // Fallback
    }
    return { ...data, id: doc.id, date } as Sale;
};


function SalesHistoryTab({ salesHistory }: { salesHistory: Sale[] }) {
    return (
        <ScrollArea className="h-[calc(100vh-18rem)]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {salesHistory.length > 0 ? (
                        salesHistory.map(sale => (
                            <TableRow key={sale.id}>
                                <TableCell>{format(sale.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell className="font-medium">{sale.productName}</TableCell>
                                <TableCell className="text-right">{sale.quantity}</TableCell>
                                <TableCell className="text-right">R${sale.total.toFixed(2)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">Nenhuma venda registrada ainda.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}


export default function POSPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [paymentConditions, setPaymentConditions] = useState<PaymentCondition[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const { toast } = useToast();
  const { user, currentBranch, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !currentBranch || !user?.organizationId) {
        setProducts([]);
        setCombos([]);
        setSalesHistory([]);
        setLoading(true);
        return;
    }

    const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
    const combosQuery = query(collection(db, 'combos'), where('branchId', '==', currentBranch.id));
    const conditionsQuery = query(collection(db, 'paymentConditions'), where("organizationId", "==", user.organizationId));
    const salesQuery = query(collection(db, 'sales'), where('branchId', '==', currentBranch.id), orderBy('date', 'desc'));
    const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));

    const unsubscribeProducts = onSnapshot(productsQuery, (productsSnapshot) => {
        const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        const unsubscribeSales = onSnapshot(salesQuery, (salesSnapshot) => {
            const salesData = salesSnapshot.docs.map(convertSaleDoc);
            setSalesHistory(salesData);

            const unsubscribeEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
                const entriesData = entriesSnapshot.docs.map(doc => doc.data() as StockEntry);

                const productsWithStock = productsData.map(p => {
                    const totalEntries = entriesData.filter(e => e.productId === p.id).reduce((sum, e) => sum + e.quantityAdded, 0);
                    const totalSales = salesData.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
                    return { ...p, stock: totalEntries - totalSales };
                });
                setProducts(productsWithStock);
                setLoading(false);
            });
            return () => unsubscribeEntries();
        });
        return () => unsubscribeSales();
    });

    const unsubscribeCombos = onSnapshot(combosQuery, (querySnapshot) => {
      const combosData: Combo[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Combo));
      setCombos(combosData);
    });
    
    const unsubscribeConditions = onSnapshot(conditionsQuery, (snapshot) => {
        const conditionsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as PaymentCondition);
        setPaymentConditions(conditionsData);
    });


    return () => {
        unsubscribeProducts();
        unsubscribeCombos();
        unsubscribeConditions();
    }
  }, [currentBranch, authLoading, user]);

  const addToCart = (item: ProductWithStock | Combo, type: 'product' | 'combo') => {
    if (type === 'product') {
        const product = item as ProductWithStock;
        if (product.stock <= 0) {
            toast({ title: 'Fora de estoque', description: `${product.name} não está disponível.`, variant: 'destructive'});
            return;
        }
         setCart((prev) => {
            const existingItem = prev.find((cartItem) => cartItem.id === product.id && cartItem.itemType === 'product');
            if (existingItem) {
                if (existingItem.quantity >= (existingItem as ProductWithStock).stock) {
                     toast({ title: 'Limite de estoque atingido', description: `Você não pode adicionar mais de ${(existingItem as ProductWithStock).stock} unidades de ${existingItem.name}.`, variant: 'destructive'});
                    return prev;
                }
                return prev.map((ci) =>
                ci.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci
                );
            }
            return [...prev, { ...product, quantity: 1, itemType: 'product' }];
        });
    } else {
        const combo = item as Combo;
        // Check stock for all products in combo
        for (const comboProduct of combo.products) {
            const productInStore = products.find(p => p.id === comboProduct.productId);
            if (!productInStore || productInStore.stock < comboProduct.quantity) {
                toast({ title: 'Estoque insuficiente para o kit', description: `O produto ${comboProduct.productName} não tem estoque suficiente para montar o kit ${combo.name}.`, variant: 'destructive'});
                return;
            }
        }
        setCart(prev => {
            const existingItem = prev.find(ci => ci.id === combo.id && ci.itemType === 'combo');
            if (existingItem) {
                // Check stock for subsequent additions of the same combo
                for (const comboProduct of combo.products) {
                    const productInStore = products.find(p => p.id === comboProduct.productId);
                    const cartProduct = cart.find(ci => ci.id === comboProduct.productId && ci.itemType === 'product');
                    const cartComboUsage = cart.filter(ci => ci.itemType === 'combo').reduce((acc, c) => {
                        const pInCombo = (c as Combo).products.find(p => p.productId === comboProduct.productId);
                        return acc + (pInCombo ? pInCombo.quantity * c.quantity : 0);
                    }, 0);

                    if (!productInStore || productInStore.stock < (cartProduct?.quantity || 0) + cartComboUsage + comboProduct.quantity) {
                         toast({ title: 'Estoque insuficiente para o kit', description: `O produto ${comboProduct.productName} não tem estoque suficiente para adicionar outro kit ${combo.name}.`, variant: 'destructive'});
                         return prev;
                    }
                }
                return prev.map(ci => ci.id === combo.id ? {...ci, quantity: ci.quantity + 1} : ci);
            }
            return [...prev, {...combo, quantity: 1, itemType: 'combo'}];
        });
    }
  };
  
  const removeFromCart = (itemId: string, itemType: 'product' | 'combo') => {
      setCart(cart => cart.filter(item => !(item.id === itemId && item.itemType === itemType)));
  }

  const total = cart.reduce((acc, item) => {
      const price = item.itemType === 'product' ? item.price : item.finalPrice;
      return acc + price * item.quantity
  }, 0);
  const tax = total * ((currentBranch?.taxRate || 0) / 100);
  const grandTotal = total + tax;
  
  const handleCheckout = async (payments: PaymentDetail[]) => {
      if (cart.length === 0) {
          toast({ title: 'Carrinho Vazio', description: 'Adicione itens ao carrinho antes de finalizar.', variant: 'destructive'});
          return;
      }
      if (!currentBranch || !user || !user.organizationId) {
          toast({ title: 'Erro de sessão', description: 'Usuário ou filial não encontrados. Faça login novamente.', variant: 'destructive'});
          return;
      }

      try {
        const batch = writeBatch(db);
        
        for (const item of cart) {
             const productsToUpdate: { id: string, quantity: number }[] = [];
             if (item.itemType === 'product') {
                productsToUpdate.push({ id: item.id, quantity: item.quantity });
             } else { // It's a combo
                 item.products.forEach(p => {
                    productsToUpdate.push({ id: p.productId, quantity: p.quantity * item.quantity });
                 });
             }

            const saleData: Omit<Sale, 'id'> = {
                productId: item.id, // Can be product or combo id
                productName: item.name,
                quantity: item.quantity,
                total: (item.itemType === 'product' ? item.price : item.finalPrice) * item.quantity,
                date: new Date(),
                cashier: user.name,
                branchId: currentBranch.id,
                organizationId: user.organizationId,
                payments: payments
            };
            const saleRef = doc(collection(db, "sales"));
            batch.set(saleRef, saleData);
        }
        
        await batch.commit();

        toast({ title: 'Compra finalizada com sucesso!', description: `Total: R$${grandTotal.toFixed(2).replace('.', ',')}`});
        setCart([]);

      } catch (error) {
          console.error("Checkout error: ", error);
          toast({ title: 'Erro ao finalizar a compra', description: 'Ocorreu um erro ao atualizar o estoque ou salvar a venda.', variant: 'destructive'});
      }
  }

  if (!currentBranch && !authLoading) {
    return (
        <Card className="m-auto">
            <CardHeader>
                <CardTitle>Nenhuma Filial Selecionada</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Por favor, selecione uma filial no topo da página para usar a Frente de Caixa.</p>
                 <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Ajustes</Link>.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <>
    <div className="grid h-[calc(100vh-8rem)] md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader>
             <Tabs defaultValue="products">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="products"><Package className="mr-2 h-4 w-4"/> Produtos</TabsTrigger>
                <TabsTrigger value="combos"><Gift className="mr-2 h-4 w-4"/> Kits</TabsTrigger>
                <TabsTrigger value="history"><History className="mr-2 h-4 w-4"/> Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="products" className="mt-4">
                 <ScrollArea className="h-[calc(100vh-18rem)]">
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Card key={i}>
                            <CardContent className="p-2 flex flex-col items-center justify-center">
                                <Skeleton className="h-[100px] w-[100px] rounded-md" />
                                <Skeleton className="h-4 w-24 mt-2"/>
                                <Skeleton className="h-3 w-16 mt-1"/>
                            </CardContent>
                            </Card>
                        ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {products.map((product) => (
                            <Card 
                            key={product.id} 
                            onClick={() => addToCart(product, 'product')} 
                            className="cursor-pointer hover:shadow-lg transition-shadow relative"
                            >
                            {product.stock <= 0 && <Badge variant="destructive" className="absolute top-1 right-1">Esgotado</Badge>}
                            <CardContent className="p-2 flex flex-col items-center justify-center">
                                <Image src={product.imageUrl} alt={product.name} width={100} height={100} className="rounded-md object-cover aspect-square" data-ai-hint="product image"/>
                                <p className="font-semibold text-sm mt-2 text-center">{product.name}</p>
                                <p className="text-xs text-muted-foreground">R${product.price.toFixed(2).replace('.', ',')}</p>
                            </CardContent>
                            </Card>
                        ))}
                        </div>
                    )}
                 </ScrollArea>
              </TabsContent>
               <TabsContent value="combos" className="mt-4">
                 <ScrollArea className="h-[calc(100vh-18rem)]">
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                           {Array.from({ length: 5 }).map((_, i) => ( <Skeleton key={i} className="h-[150px] w-full" /> ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {combos.map((combo) => (
                            <Card 
                            key={combo.id} 
                            onClick={() => addToCart(combo, 'combo')} 
                            className="cursor-pointer hover:shadow-lg transition-shadow relative"
                            >
                            <CardContent className="p-2 flex flex-col items-center justify-center">
                                <Image src={combo.imageUrl} alt={combo.name} width={100} height={100} className="rounded-md object-cover aspect-square" data-ai-hint="combo offer"/>
                                <p className="font-semibold text-sm mt-2 text-center">{combo.name}</p>
                                <p className="text-xs text-muted-foreground">R${combo.finalPrice.toFixed(2).replace('.', ',')}</p>
                            </CardContent>
                            </Card>
                        ))}
                        </div>
                    )}
                 </ScrollArea>
              </TabsContent>
               <TabsContent value="history" className="mt-4">
                    <SalesHistoryTab salesHistory={salesHistory} />
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
      
      <div className="md:col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Carrinho</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className="h-[calc(100vh-25rem)]">
                {cart.length === 0 ? (
                    <p className="text-muted-foreground text-center">O carrinho está vazio</p>
                ) : (
                    <div className="space-y-4">
                        {cart.map(item => (
                            <div key={`${item.id}-${item.itemType}`} className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium flex items-center gap-2">
                                        {item.name}
                                        {item.itemType === 'combo' && <Badge variant="secondary">Kit</Badge>}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        R${(item.itemType === 'product' ? item.price : item.finalPrice).toFixed(2).replace('.', ',')} x {item.quantity}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold">R${((item.itemType === 'product' ? item.price : item.finalPrice) * item.quantity).toFixed(2).replace('.', ',')}</p>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromCart(item.id, item.itemType)}>
                                        <X className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex-col !p-6 border-t">
             <div className="w-full space-y-2">
                 <div className="flex justify-between"><p>Subtotal</p><p>R${total.toFixed(2).replace('.', ',')}</p></div>
                 <div className="flex justify-between"><p>Imposto ({currentBranch?.taxRate || 0}%)</p><p>R${tax.toFixed(2).replace('.', ',')}</p></div>
                 <Separator />
                 <div className="flex justify-between font-bold text-lg"><p>Total</p><p>R${grandTotal.toFixed(2).replace('.', ',')}</p></div>
             </div>
             <Button className="w-full mt-4" size="lg" onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0}>
                 <CreditCard className="mr-2 h-4 w-4" />
                 Finalizar Compra
             </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
    <CheckoutModal
      isOpen={isCheckoutModalOpen}
      onOpenChange={setIsCheckoutModalOpen}
      cart={cart}
      grandTotal={grandTotal}
      onCheckout={handleCheckout}
      paymentConditions={paymentConditions}
    />
    </>
  );
}
