
'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, writeBatch, doc, getDocs, orderBy, Timestamp, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Sale, PaymentCondition, PaymentDetail, Combo, PaymentConditionType, StockEntry, Kit, Attendance, AttendanceItem, Customer } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, X, Loader2, PlusCircle, Trash2, Gift, Package, History, Minus, Component, DollarSign, UserCheck, Search, UserPlus } from 'lucide-react';
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
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';


type CartItem = 
    | (ProductWithStock & { itemType: 'product'; quantity: number }) 
    | (Combo & { itemType: 'combo'; quantity: number })
    | ({ kit: Kit; chosenProducts: Product[] } & { id: string; name: string; itemType: 'kit'; quantity: number; total: number })
    | (AttendanceItem & { itemType: 'service' | 'product' });

type ProductWithStock = Product & { stock: number };

function CustomerSelector({ onSelect }: { onSelect: (customer: Customer) => void }) {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!user?.organizationId) return;
        const q = query(collection(db, 'customers'), where('organizationId', '==', user.organizationId), where('isActive', '==', true));
        const unsub = onSnapshot(q, snap => {
            const customerData = snap.docs.map(d => ({id: d.id, ...d.data()} as Customer));
            setCustomers(customerData.sort((a,b) => a.name.localeCompare(b.name)));
        });
        return () => unsub();
    }, [user]);

    const handleSelect = (customer: Customer) => {
        onSelect(customer);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                    <UserPlus className="mr-2"/> Adicionar Cliente à Venda
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                            {customers.map((customer) => (
                                <CommandItem key={customer.id} onSelect={() => handleSelect(customer)}>
                                    {customer.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}


function CheckoutModal({
  isOpen,
  onOpenChange,
  cart,
  grandTotal,
  onCheckout,
  paymentConditions,
  attendanceId,
  customerId,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cart: CartItem[];
  grandTotal: number;
  onCheckout: (payments: PaymentDetail[], attendanceId?: string, customerId?: string) => Promise<void>;
  paymentConditions: PaymentCondition[];
  attendanceId?: string;
  customerId?: string;
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
      toast({ title: 'Valor não bate', description: `A soma dos pagamentos deve ser igual ao total. Faltam R$${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    await onCheckout(payments, attendanceId, customerId);
    setIsProcessing(false);
    onOpenChange(false);
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar Compra</DialogTitle>
          <DialogDescription>Selecione as formas de pagamento para o total de <span className="font-bold">R${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {payments.map((payment, index) => {
            const condition = paymentConditions.find(c => c.id === payment.conditionId);
            const maxInstallments = condition?.maxInstallments || 1;

            return (
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
                   <Select
                        value={String(payment.installments)}
                        onValueChange={(val) => handlePaymentChange(index, 'installments', parseInt(val, 10) || 1)}
                    >
                        <SelectTrigger id={`installments-${index}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(i => (
                                <SelectItem key={i} value={String(i)}>
                                    {i}x de R$ {(payment.amount / i).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
          )})}
          {remainingAmount > 0.01 && (
             <Button variant="outline" onClick={handleAddPayment} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4"/> Adicionar Outra Forma de Pagamento
             </Button>
          )}
        </div>
        <DialogFooter className="grid grid-cols-2 gap-4">
            <div className="text-left">
                <p>Total Pago: <span className="font-bold">R${paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                <p className={remainingAmount !== 0 ? 'text-destructive' : ''}>
                    Restante: <span className="font-bold">R${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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

const convertSaleDate = (docData: any): Sale => {
    let date;
    if (docData.date instanceof Timestamp) {
        date = docData.date.toDate();
    } else if (docData.date && typeof docData.date.seconds === 'number') {
        date = new Date(docData.date.seconds * 1000);
    } else {
        date = new Date(); // Fallback
    }
    return { ...docData, date } as Sale;
};

function PendingAttendancesTab({ onSelect }: { onSelect: (attendance: Attendance) => void }) {
    const { currentBranch } = useAuth();
    const [pending, setPending] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentBranch) return;
        const q = query(
            collection(db, 'attendances'),
            where('branchId', '==', currentBranch.id),
            where('status', '==', 'completed'),
            where('paymentStatus', '==', 'pending')
        );
        const unsub = onSnapshot(q, snap => {
            setPending(snap.docs.map(d => ({id: d.id, ...d.data()} as Attendance)));
            setLoading(false);
        });
        return () => unsub();
    }, [currentBranch]);

    return (
        <ScrollArea className="h-[calc(100vh-18rem)]">
            {loading && <Skeleton className="h-full w-full"/>}
            {!loading && pending.length === 0 && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                    Nenhum atendimento com pagamento pendente.
                </div>
            )}
            <div className="space-y-2 p-2">
                {pending.map(att => (
                    <Card key={att.id} className="p-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{att.customerName}</p>
                                <p className="text-sm text-muted-foreground">
                                    Profissional: {att.professionalName}
                                </p>
                                 <p className="text-sm text-muted-foreground">
                                    Data: {att.date && att.date.toDate ? format(att.date.toDate(), 'dd/MM/yyyy') : '...'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-lg">R$ {att.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <Button size="sm" onClick={() => onSelect(att)}>Pagar</Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </ScrollArea>
    );
}

function SalesHistoryTab({ salesHistory }: { salesHistory: Sale[] }) {
    const totalsByPaymentType = useMemo(() => {
        const totals: Record<PaymentConditionType, number> = {
            cash: 0,
            credit: 0,
            debit: 0,
            pix: 0,
        };

        salesHistory.forEach(sale => {
            sale.payments?.forEach(payment => {
                if (totals.hasOwnProperty(payment.type)) {
                    totals[payment.type] += payment.amount;
                }
            });
        });
        return totals;
    }, [salesHistory]);

    return (
        <div className="flex flex-col h-[calc(100vh-18rem)]">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Crédito</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">R$ {totalsByPaymentType.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Débito</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">R$ {totalsByPaymentType.debit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pix</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">R$ {totalsByPaymentType.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dinheiro</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">R$ {totalsByPaymentType.cash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
            </div>
            <ScrollArea className="flex-grow">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Itens</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {salesHistory.length > 0 ? (
                            salesHistory.map(sale => (
                                <TableRow key={sale.id}>
                                    <TableCell>{format(sale.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col gap-1">
                                            {sale.items?.map((item: any, index: number) => (
                                                <div key={item.id + index}>
                                                    <span>{item.name}</span>
                                                    {item.type === 'kit' && item.chosenProducts && (
                                                        <span className="text-xs text-muted-foreground ml-1">
                                                            ({item.chosenProducts.map((p: any) => p.name).join(', ')})
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>{sale.cashier}</TableCell>
                                    <TableCell className="text-right">R${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
        </div>
    );
}

function KitSelectionModal({ kit, products, isOpen, onOpenChange, onConfirm }: { kit: Kit; products: ProductWithStock[]; isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onConfirm: (chosenProducts: Product[]) => void; }) {
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (!isOpen) {
            setSelectedProducts([]);
            setSearchQuery('');
        }
    }, [isOpen]);

    const eligibleProducts = useMemo(() => {
        const baseEligible = products.filter(p => kit.eligibleProductIds.includes(p.id));
        
        const searched = searchQuery
            ? baseEligible.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : baseEligible;

        const mappedProducts = searched.map(p => {
            const stockInCart = selectedProducts.filter(sp => sp.id === p.id).length;
            return {
                ...p,
                availableStock: p.stock - stockInCart,
            };
        });
        // Sort to show items with stock first, then alphabetically
        return mappedProducts.sort((a, b) => {
            if (b.availableStock - a.availableStock !== 0) {
                return b.availableStock - a.availableStock;
            }
            return a.name.localeCompare(b.name);
        });
    }, [kit, products, selectedProducts, searchQuery]);

    const addProduct = (product: Product) => {
        const productWithStock = eligibleProducts.find(p => p.id === product.id);
        if (!productWithStock || productWithStock.availableStock <= 0) {
            toast({ title: `Estoque insuficiente para ${product.name}`, variant: "destructive" });
            return;
        }

        if (selectedProducts.length < kit.numberOfItems) {
            setSelectedProducts(prev => [...prev, product]);
        } else {
            toast({ title: `Limite de ${kit.numberOfItems} produtos atingido.`, variant: "destructive" });
        }
    };

    const removeProduct = (productId: string) => {
        setSelectedProducts(prev => {
            const lastIndex = prev.map(p => p.id).lastIndexOf(productId);
            if (lastIndex === -1) return prev;
            const newProducts = [...prev];
            newProducts.splice(lastIndex, 1);
            return newProducts;
        });
    };

    const handleConfirm = () => {
        if (selectedProducts.length !== kit.numberOfItems) {
            toast({ title: `Você deve selecionar ${kit.numberOfItems} produtos.`, variant: 'destructive' });
            return;
        }
        onConfirm(selectedProducts);
    };

    const groupedSelectedProducts = useMemo(() => {
        return selectedProducts.reduce((acc, product) => {
            if (!acc[product.id]) {
                acc[product.id] = { ...product, count: 0 };
            }
            acc[product.id].count++;
            return acc;
        }, {} as Record<string, Product & { count: number }>);
    }, [selectedProducts]);


    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl grid-rows-[auto_1fr_auto] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Monte seu Kit: {kit.name}</DialogTitle>
                    <DialogDescription>Selecione {kit.numberOfItems} dos produtos abaixo. Você pode selecionar o mesmo produto mais de uma vez.</DialogDescription>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 overflow-y-auto pr-4">
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold">Produtos Disponíveis</h3>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar produto..."
                                className="w-full bg-background pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-full rounded-md border">
                            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                {eligibleProducts.map(p => (
                                    <Card
                                        key={p.id}
                                        onClick={() => addProduct(p)}
                                        className={`cursor-pointer transition-all ${p.availableStock <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                                    >
                                        <CardContent className="p-2 text-center relative">
                                            <Badge className="absolute top-1 right-1" variant={p.availableStock > 0 ? "secondary" : "destructive"}>
                                                {p.availableStock}
                                            </Badge>
                                            <Image src={p.imageUrl} alt={p.name} width={80} height={80} className="mx-auto rounded-md" data-ai-hint="product image"/>
                                            <p className="text-sm font-medium mt-1">{p.name}</p>
                                            <p className="text-xs text-muted-foreground">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                     <div className="flex flex-col gap-4">
                        <h3 className="font-semibold">Sua Seleção ({selectedProducts.length} de {kit.numberOfItems})</h3>
                        <ScrollArea className="h-full rounded-md border p-4">
                           {selectedProducts.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    Selecione produtos da lista ao lado.
                                </div>
                           ) : (
                                <div className="space-y-2">
                                    {Object.values(groupedSelectedProducts).map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <div className="flex items-center gap-2">
                                                <Image src={p.imageUrl} alt={p.name} width={40} height={40} className="rounded-md" data-ai-hint="product image"/>
                                                <div>
                                                    <p className="font-medium">{p.name}</p>
                                                    <p className="text-xs text-muted-foreground">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold">x {p.count}</span>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeProduct(p.id)}>
                                                    <Minus className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                           )}
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="pt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirm}>Confirmar Seleção</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function POSPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [paymentConditions, setPaymentConditions] = useState<PaymentCondition[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [currentAttendanceId, setCurrentAttendanceId] = useState<string | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { user, currentBranch, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !currentBranch || !user?.organizationId) {
        setLoading(true);
        return;
    }

    const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
    const combosQuery = query(collection(db, 'combos'), where('branchId', '==', currentBranch.id));
    const kitsQuery = query(collection(db, 'kits'), where('branchId', '==', currentBranch.id));
    const conditionsQuery = query(collection(db, 'paymentConditions'), where("organizationId", "==", user.organizationId));
    const salesQuery = query(collection(db, 'sales'), where('branchId', '==', currentBranch.id));
    const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));

    const unsubscribeProducts = onSnapshot(productsQuery, (productsSnapshot) => {
        const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        const entriesSub = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
            const entriesData = entriesSnapshot.docs.map(doc => doc.data() as StockEntry);

            const productsWithStock = productsData.map(p => {
                const stock = entriesData
                    .filter(e => e.productId === p.id)
                    .reduce((sum, e) => sum + e.quantity, 0);
                return { ...p, stock: stock };
            });
            setProducts(productsWithStock.sort((a,b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

        return () => entriesSub();
    });

    const unsubscribeSales = onSnapshot(salesQuery, (salesSnapshot) => {
        const salesData = salesSnapshot.docs.map(doc => convertSaleDate({ id: doc.id, ...doc.data() }));
        const sortedSales = salesData.sort((a,b) => b.date.getTime() - a.date.getTime());
        setSalesHistory(sortedSales);
    });

    const unsubscribeCombos = onSnapshot(combosQuery, (querySnapshot) => {
      setCombos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Combo)));
    });

    const unsubscribeKits = onSnapshot(kitsQuery, (querySnapshot) => {
      setKits(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kit)));
    });
    
    const unsubscribeConditions = onSnapshot(conditionsQuery, (snapshot) => {
        setPaymentConditions(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as PaymentCondition));
    });


    return () => {
        unsubscribeProducts();
        unsubscribeCombos();
        unsubscribeKits();
        unsubscribeConditions();
        unsubscribeSales();
    }
  }, [currentBranch, authLoading, user]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.isSalable && p.stock > 0 && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, searchQuery]);
  
  const filteredCombos = useMemo(() => {
    return combos.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [combos, searchQuery]);
  
  const filteredKits = useMemo(() => {
    return kits.filter(k => k.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [kits, searchQuery]);
  
  const handleKitSelection = (kit: Kit, chosenProducts: Product[]) => {
      const originalPrice = chosenProducts.reduce((sum, p) => sum + p.price, 0);
      let finalPrice = originalPrice;
      if (kit.discountType === 'percentage') {
          finalPrice = originalPrice * (1 - kit.discountValue / 100);
      } else {
          finalPrice = originalPrice - kit.discountValue;
      }

      const cartItem: CartItem = {
          id: `${kit.id}-${Date.now()}`, // Unique ID for each kit instance in cart
          name: `${kit.name} (Kit)`,
          itemType: 'kit',
          quantity: 1,
          kit,
          chosenProducts,
          total: finalPrice
      };
      setCart(prev => [...prev, cartItem]);
      setSelectedKit(null);
  };

  const addToCart = (item: ProductWithStock | Combo, type: 'product' | 'combo') => {
    if (currentAttendanceId) {
        toast({ title: 'Ação bloqueada', description: 'Finalize o pagamento do atendimento pendente antes de iniciar uma nova venda.', variant: 'destructive' });
        return;
    }
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
                toast({ title: 'Estoque insuficiente para o combo', description: `O produto ${comboProduct.productName} não tem estoque suficiente para montar o combo ${combo.name}.`, variant: 'destructive'});
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
                         toast({ title: 'Estoque insuficiente para o combo', description: `O produto ${comboProduct.productName} não tem estoque suficiente para adicionar outro combo ${combo.name}.`, variant: 'destructive'});
                         return prev;
                    }
                }
                return prev.map(ci => ci.id === combo.id ? {...ci, quantity: ci.quantity + 1} : ci);
            }
            return [...prev, {...combo, quantity: 1, itemType: 'combo'}];
        });
    }
  };
  
  const removeFromCart = (itemId: string, itemType: CartItem['itemType']) => {
      setCart(cart => cart.filter(item => !(item.id === itemId && item.itemType === itemType)));
  }

  const { subtotal, totalDiscount } = useMemo(() => {
    return cart.reduce(
        (acc, item) => {
            let itemTotal;
            let itemOriginalTotal;

            if (item.itemType === 'product') {
                const price = (item as ProductWithStock).price || (item as AttendanceItem).price || 0;
                itemTotal = price * item.quantity;
                itemOriginalTotal = itemTotal;
            } else if (item.itemType === 'combo') {
                itemTotal = item.finalPrice * item.quantity;
                itemOriginalTotal = item.originalPrice * item.quantity;
            } else if (item.itemType === 'kit') {
                const originalPrice = item.chosenProducts.reduce((sum, p) => sum + p.price, 0);
                itemTotal = item.total * item.quantity;
                itemOriginalTotal = originalPrice * item.quantity;
            } else if (item.itemType === 'service') {
                itemTotal = item.total;
                itemOriginalTotal = itemTotal;
            }
            else {
                itemTotal = 0;
                itemOriginalTotal = 0;
            }
            
            acc.subtotal += itemTotal;
            acc.totalDiscount += (itemOriginalTotal - itemTotal);
            return acc;
        },
        { subtotal: 0, totalDiscount: 0 }
    );
  }, [cart]);

  const tax = subtotal * ((currentBranch?.taxRate || 0) / 100);
  const grandTotal = subtotal + tax;
  
  const handleCheckout = async (payments: PaymentDetail[], attendanceId?: string, customerId?: string) => {
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
        const saleDate = serverTimestamp();
        
        // Create stock entries first for products, combos, and kits
        for (const item of cart) {
            if (item.itemType === 'product') {
                 const entry: Omit<StockEntry, 'id'> = {
                    productId: item.id,
                    productName: item.name,
                    quantity: -item.quantity,
                    type: 'sale',
                    date: saleDate,
                    userId: user.id,
                    userName: user.name,
                    branchId: currentBranch.id,
                    organizationId: user.organizationId,
                };
                batch.set(doc(collection(db, "stockEntries")), entry);
            } else if (item.itemType === 'combo') {
                for(const product of item.products) {
                    const entry: Omit<StockEntry, 'id'> = {
                        productId: product.productId,
                        productName: product.productName,
                        quantity: -product.quantity * item.quantity,
                        type: 'sale',
                        date: saleDate,
                        userId: user.id,
                        userName: user.name,
                        branchId: currentBranch.id,
                        organizationId: user.organizationId,
                        notes: `Venda Combo: ${item.name}`
                    };
                    batch.set(doc(collection(db, "stockEntries")), entry);
                }
            } else if (item.itemType === 'kit') {
                 for(const product of item.chosenProducts) {
                    const entry: Omit<StockEntry, 'id'> = {
                        productId: product.id,
                        productName: product.name,
                        quantity: -1, // Each chosen product is one unit from stock
                        type: 'sale',
                        date: saleDate,
                        userId: user.id,
                        userName: user.name,
                        branchId: currentBranch.id,
                        organizationId: user.organizationId,
                        notes: `Venda Kit: ${item.name}`
                    };
                    batch.set(doc(collection(db, "stockEntries")), entry);
                }
            }
        }

        const saleItems = cart.map(item => {
            const baseItem: any = { id: item.id, name: item.name, quantity: item.quantity, type: item.itemType };
            if (item.itemType === 'product' || item.itemType === 'service') {
                baseItem.price = item.price;
                baseItem.total = item.total;
            }
            if (item.itemType === 'kit') {
                baseItem.chosenProducts = item.chosenProducts.map(p => ({id: p.id, name: p.name, price: p.price}));
                baseItem.total = item.total;
            }
            if (item.itemType === 'combo') {
                baseItem.originalPrice = item.originalPrice;
                baseItem.finalPrice = item.finalPrice;
            }
            return baseItem;
        });

        // Create one consolidated sale document
        const saleRef = doc(collection(db, "sales"));
        const saleData: Omit<Sale, 'id'> = {
            items: saleItems,
            total: grandTotal,
            date: new Date(),
            cashier: user.name,
            branchId: currentBranch.id,
            organizationId: user.organizationId,
            payments: payments,
            ...(attendanceId && { attendanceId: attendanceId }),
            ...(customerId && { customerId: customerId }),
        };
        batch.set(saleRef, { ...saleData, date: saleDate }); // Use server timestamp for sale as well
        
        // If it's a payment for an attendance, update its status
        if (attendanceId) {
            const attendanceRef = doc(db, 'attendances', attendanceId);
            batch.update(attendanceRef, { paymentStatus: 'paid' });
        }

        await batch.commit();

        toast({ title: 'Compra finalizada com sucesso!', description: `Total: R$${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`});
        handleClearCart();

      } catch (error) {
          console.error("Checkout error: ", error);
          toast({ title: 'Erro ao finalizar a compra', description: 'Ocorreu um erro ao atualizar o estoque ou salvar a venda.', variant: 'destructive'});
      }
  }

  const handleSelectAttendance = (attendance: Attendance) => {
    const attendanceCartItems: CartItem[] = attendance.items.map(item => {
        if (item.type === 'product') {
            const product = products.find(p => p.id === item.id);
            return {
                ...(product || {}),
                id: item.id,
                name: item.name,
                price: item.price,
                stock: product?.stock || 0,
                itemType: 'product',
                quantity: item.quantity
            } as CartItem;
        }
        return {
            ...item,
            itemType: 'service'
        } as CartItem
    });
    setCart(attendanceCartItems);
    setCurrentAttendanceId(attendance.id);
  };
  
  const handleClearCart = () => {
    setCart([]);
    setCurrentAttendanceId(undefined);
    setSelectedCustomer(null);
  };

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

  const getCartItemPrice = (item: CartItem) => {
      switch (item.itemType) {
          case 'product': return (item as ProductWithStock).price || (item as AttendanceItem).price || 0;
          case 'combo': return (item as Combo).finalPrice;
          case 'kit': return item.total;
          case 'service': return (item as AttendanceItem).price;
          default: return 0;
      }
  }

  return (
    <>
    <div className="grid h-[calc(100vh-8rem)] md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader>
              <CardTitle>Frente de Caixa</CardTitle>
              <CardDescription>Selecione os produtos, combos ou kits para adicionar ao carrinho.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            <Tabs defaultValue="products" className="flex-grow flex flex-col" onValueChange={() => setSearchQuery('')}>
                 <TabsList className="grid w-full grid-flow-col auto-cols-fr">
                    {user?.enabledModules?.appointments && <TabsTrigger value="pending"><UserCheck className="mr-2 h-4 w-4"/> Atendimentos</TabsTrigger>}
                    <TabsTrigger value="products"><Package className="mr-2 h-4 w-4"/> Produtos</TabsTrigger>
                    {user?.enabledModules?.combos && <TabsTrigger value="combos"><Gift className="mr-2 h-4 w-4"/> Combos</TabsTrigger>}
                    {user?.enabledModules?.kits && <TabsTrigger value="kits"><Component className="mr-2 h-4 w-4"/> Kits</TabsTrigger>}
                    <TabsTrigger value="history"><History className="mr-2 h-4 w-4"/> Histórico</TabsTrigger>
                </TabsList>
                <div className="relative pt-4">
                    <Search className="absolute left-2.5 top-6.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar item..."
                        className="w-full rounded-lg bg-background pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                 <TabsContent value="pending" className="mt-4 flex-grow">
                    <PendingAttendancesTab onSelect={handleSelectAttendance} />
                </TabsContent>
                <TabsContent value="products" className="mt-4 flex-grow">
                    <ScrollArea className="h-[calc(100vh-25rem)]">
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
                            {filteredProducts.map((product) => (
                                <Card 
                                key={product.id} 
                                onClick={() => addToCart(product, 'product')} 
                                className="cursor-pointer hover:shadow-lg transition-shadow relative"
                                >
                                {product.stock <= 0 && <Badge variant="destructive" className="absolute top-1 right-1">Esgotado</Badge>}
                                <CardContent className="p-2 flex flex-col items-center justify-center">
                                    <Image src={product.imageUrl} alt={product.name} width={100} height={100} className="rounded-md object-cover aspect-square" data-ai-hint="product image"/>
                                    <p className="font-semibold text-sm mt-2 text-center">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">R${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </CardContent>
                                </Card>
                            ))}
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="combos" className="mt-4 flex-grow">
                    <ScrollArea className="h-[calc(100vh-25rem)]">
                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {Array.from({ length: 5 }).map((_, i) => ( <Skeleton key={i} className="h-[150px] w-full" /> ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredCombos.map((combo) => (
                                <Card 
                                key={combo.id} 
                                onClick={() => addToCart(combo, 'combo')} 
                                className="cursor-pointer hover:shadow-lg transition-shadow relative"
                                >
                                <CardContent className="p-2 flex flex-col items-center justify-center">
                                    <Image src={combo.imageUrl} alt={combo.name} width={100} height={100} className="rounded-md object-cover aspect-square" data-ai-hint="combo offer"/>
                                    <p className="font-semibold text-sm mt-2 text-center">{combo.name}</p>
                                    <p className="text-xs text-muted-foreground">R${combo.finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </CardContent>
                                </Card>
                            ))}
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="kits" className="mt-4 flex-grow">
                    <ScrollArea className="h-[calc(100vh-25rem)]">
                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {Array.from({ length: 5 }).map((_, i) => ( <Skeleton key={i} className="h-[150px] w-full" /> ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredKits.map((kit) => (
                                <Card 
                                key={kit.id} 
                                onClick={() => setSelectedKit(kit)} 
                                className="cursor-pointer hover:shadow-lg transition-shadow relative"
                                >
                                <CardContent className="p-2 flex flex-col items-center justify-center">
                                    <Image src={kit.imageUrl} alt={kit.name} width={100} height={100} className="rounded-md object-cover aspect-square" data-ai-hint="kit offer"/>
                                    <p className="font-semibold text-sm mt-2 text-center">{kit.name}</p>
                                    <p className="text-xs text-muted-foreground">Monte seu kit!</p>
                                </CardContent>
                                </Card>
                            ))}
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="history" className="mt-4 flex-grow">
                        <SalesHistoryTab salesHistory={salesHistory} />
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      <div className="md:col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader>
             <div className="flex justify-between items-center">
                 <CardTitle>Carrinho</CardTitle>
                 {cart.length > 0 && <Button variant="ghost" size="sm" onClick={handleClearCart}>Limpar</Button>}
             </div>
             {currentAttendanceId && <CardDescription>Pagamento para atendimento</CardDescription>}
             {selectedCustomer && !currentAttendanceId && (
                <CardDescription className="flex items-center gap-1">
                    Venda para: <span className="font-medium">{selectedCustomer.name}</span>
                </CardDescription>
             )}
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className="h-[calc(100vh-25rem)]">
                {cart.length === 0 ? (
                    <div className="text-muted-foreground text-center space-y-4">
                        <p>O carrinho está vazio</p>
                        {!currentAttendanceId && user?.enabledModules?.customers && <CustomerSelector onSelect={setSelectedCustomer} />}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cart.map((item, index) => (
                            <div key={`${item.id}-${index}`} className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium flex items-center gap-2">
                                        {item.name}
                                        {(item.itemType === 'combo' || item.itemType === 'kit' || item.itemType === 'service') && <Badge variant="secondary">{item.itemType}</Badge>}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.itemType === 'kit'
                                            ? `Total do Kit: R$${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : item.itemType === 'service'
                                            ? `Serviço: R$${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : `R$${getCartItemPrice(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} x ${item.quantity}`
                                        }
                                    </p>
                                    {item.itemType === 'kit' && (
                                        <div className="text-xs text-muted-foreground pl-2">
                                            {item.chosenProducts.map(p => p.name).join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold">
                                        R$${(getCartItemPrice(item) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    {!currentAttendanceId && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromCart(item.id, item.itemType)}>
                                        <X className="h-4 w-4 text-destructive"/>
                                    </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex-col !p-6 border-t">
             <div className="w-full space-y-2">
                 {totalDiscount > 0 && (
                     <div className="flex justify-between text-destructive">
                         <p>Descontos</p>
                         <p>-R${totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                     </div>
                 )}
                 <div className="flex justify-between"><p>Subtotal</p><p>R${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                 <div className="flex justify-between"><p>Imposto ({currentBranch?.taxRate || 0}%)</p><p>R${tax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                 <div className="flex justify-between font-bold text-lg"><p>Total</p><p>R${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
             </div>
             <Button className="w-full mt-4" size="lg" onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0}>
                 <CreditCard className="mr-2 h-4 w-4" />
                 Finalizar Compra
             </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
    {selectedKit && (
        <KitSelectionModal
            kit={selectedKit}
            products={products}
            isOpen={!!selectedKit}
            onOpenChange={(isOpen) => !isOpen && setSelectedKit(null)}
            onConfirm={(chosen) => handleKitSelection(selectedKit, chosen)}
        />
    )}
    <CheckoutModal
      isOpen={isCheckoutModalOpen}
      onOpenChange={setIsCheckoutModalOpen}
      cart={cart}
      grandTotal={grandTotal}
      onCheckout={handleCheckout}
      paymentConditions={paymentConditions}
      attendanceId={currentAttendanceId}
      customerId={selectedCustomer?.id}
    />
    </>
  );
}
