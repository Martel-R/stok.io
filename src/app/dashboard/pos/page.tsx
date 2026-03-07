

'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, where, writeBatch, doc, getDocs, orderBy, Timestamp, serverTimestamp, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Sale, PaymentCondition, PaymentDetail, Combo, PaymentConditionType, StockEntry, Kit, Attendance, AttendanceItem, Customer, SaleStatus } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, X, Loader2, PlusCircle, Trash2, Gift, Package, History, Minus, Component, DollarSign, UserCheck, Search, UserPlus, MoreHorizontal, Ban, Barcode, Play, StopCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
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
import { Check, ChevronsUpDown, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Html5Qrcode } from 'html5-qrcode';
import { OpenSessionDialog, CloseSessionDialog, CashAdjustmentDialog } from '@/components/cash-session-manager';
import { SupervisorAuthorizationDialog } from '@/components/supervisor-authorization-dialog';
import type { CashSession } from '@/lib/types';


const formatCurrency = (value: number | string) => {
    const amount = typeof value === 'string' ? parseFloat(value.replace(/[^\d]/g, '')) / 100 : value;
    if (isNaN(amount)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(amount);
};

const parseCurrencyToNumber = (value: string) => {
    return parseFloat(value.replace(/[^\d]/g, '')) / 100 || 0;
};

type CartItem = 
    | (ProductWithStock & { itemType: 'product'; quantity: number }) 
    | (Combo & { itemType: 'combo'; quantity: number })
    | ({ kit: Kit; chosenProducts: Product[] } & { id: string; name: string; itemType: 'kit'; quantity: number; total: number })
    | (AttendanceItem & { itemType: 'service' | 'product' });

type ProductWithStock = Product & { stock: number };

function BarcodeScannerModal({ isOpen, onOpenChange, onScan }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onScan: (barcode: string) => void; }) {
    const [hasPermission, setHasPermission] = useState(true);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const { toast } = useToast();
    const regionId = "reader";

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
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1); // 100ms duration
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
                        console.log("Barcode detected successfully:", decodedText);
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
                    console.error("Critical error starting scanner:", err);
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
                    <DialogTitle>Escanear Código de Barras</DialogTitle>
                    <DialogDescription>Aponte a câmera para o código de barras do produto.</DialogDescription>
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
                    
                    {/* Scanning Overlay */}
                    {hasPermission && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-[70%] h-[43%] border-2 border-white/50 rounded-lg relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_10px_red] animate-scan-line" />
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
  const totalHandedOver = useMemo(() => payments.reduce((acc, p) => acc + (p.paidAmount || p.amount), 0), [payments]);
  const remainingAmount = useMemo(() => grandTotal - paidAmount, [grandTotal, paidAmount]);
  const totalChange = useMemo(() => payments.reduce((acc, p) => acc + (p.changeAmount || 0), 0), [payments]);

  // Keyboard Shortcuts for Modal
  useEffect(() => {
    if (!isOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
        // Alt + Number (1-9) to select payment condition for the LAST payment entry
        if (e.altKey && /^[1-9]$/.test(e.key)) {
            const index = parseInt(e.key) - 1;
            if (paymentConditions[index]) {
                e.preventDefault();
                const lastIdx = payments.length - 1;
                handlePaymentChange(lastIdx, 'conditionId', paymentConditions[index].id);
                // Safer focus using requestAnimationFrame
                requestAnimationFrame(() => {
                    const el = document.getElementById(payments[lastIdx].type === 'cash' ? `paid-amount-${lastIdx}` : `amount-${lastIdx}`);
                    if (el instanceof HTMLInputElement) {
                        el.focus();
                        el.select();
                    }
                });
            }
        }

        // Enter to submit (if not in a focused input that handles enter differently)
        if (e.key === 'Enter' && !isProcessing && Math.abs(remainingAmount) <= 0.01) {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
            }
        }
        // F1 - Add payment
        if (e.key === 'F1') {
            e.preventDefault();
            e.stopPropagation();
            handleAddPayment();
        }
        // Escape is handled by Dialog but we can ensure it here
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(false);
        }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, isProcessing, remainingAmount, payments, paymentConditions]);

  useEffect(() => {
    if (isOpen) {
      if (grandTotal > 0 && paymentConditions.length > 0) {
        const firstCondition = paymentConditions[0];
        setPayments([{
          conditionId: firstCondition.id,
          conditionName: firstCondition.name,
          amount: grandTotal,
          installments: 1,
          type: firstCondition.type,
          ...(firstCondition.type === 'cash' && { paidAmount: grandTotal, changeAmount: 0 })
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
    const firstCondition = paymentConditions[0];
    setPayments(prev => [...prev, {
      conditionId: firstCondition.id,
      conditionName: firstCondition.name,
      amount: remainingAmount,
      installments: 1,
      type: firstCondition.type,
      ...(firstCondition.type === 'cash' && { paidAmount: remainingAmount, changeAmount: 0 })
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
        
        if (payment.type === 'cash') {
            payment.paidAmount = payment.amount;
            payment.changeAmount = 0;
        } else {
            delete payment.paidAmount;
            delete payment.changeAmount;
        }
      }

      if (field === 'amount' && payment.type === 'cash') {
          payment.paidAmount = Math.max(payment.paidAmount || 0, payment.amount);
          payment.changeAmount = (payment.paidAmount || 0) - payment.amount;
      }

      if (field === 'paidAmount' && payment.type === 'cash') {
          payment.changeAmount = Math.max(0, value - payment.amount);
      }
      
      newPayments[index] = payment;
      return newPayments;
    });
  };

  const handleSubmit = async () => {
    if (Math.abs(remainingAmount) > 0.01) {
      toast({ title: 'Valor não bate', description: `A soma dos pagamentos deve ser igual ao total. Faltam R$${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, variant: 'destructive' });
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
          <DialogDescription>Selecione as formas de pagamento para o total de <span className="font-bold">R${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></DialogDescription>
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
                        {paymentConditions.map((c, i) => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name} {i < 9 && <span className="text-[10px] opacity-50 ml-1">[Alt+{i+1}]</span>}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label htmlFor={`amount-${index}`}>Valor a Cobrar</Label>
                    <Input
                      id={`amount-${index}`}
                      type="text"
                      value={formatCurrency(payment.amount)}
                      onChange={(e) => handlePaymentChange(index, 'amount', parseCurrencyToNumber(e.target.value))}
                    />
                 </div>
              </div>

              {payment.type === 'cash' && (
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md">
                    <div>
                        <Label htmlFor={`paid-amount-${index}`}>Valor Recebido (R$)</Label>
                        <Input
                            id={`paid-amount-${index}`}
                            type="text"
                            value={formatCurrency(payment.paidAmount || 0)}
                            onChange={(e) => handlePaymentChange(index, 'paidAmount', parseCurrencyToNumber(e.target.value))}
                            className="font-bold"
                        />
                    </div>
                    <div>
                        <Label>Troco</Label>
                        <div className="h-10 flex items-center px-3 border rounded-md bg-background font-mono text-green-600 font-bold">
                            {formatCurrency(payment.changeAmount || 0)}
                        </div>
                    </div>
                </div>
              )}

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
                                    {i}x de R$ {(payment.amount / i).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <PlusCircle className="mr-2 h-4 w-4"/> Adicionar Outra Forma de Pagamento [F1]
             </Button>
          )}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
            <div className="flex flex-col text-sm w-full sm:w-auto">
                <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">Total Pago:</span>
                    <span className="font-bold">{formatCurrency(paidAmount)}</span>
                </div>
                {totalChange > 0 && (
                    <div className="flex justify-between gap-8 text-green-600">
                        <span>Total Troco:</span>
                        <span className="font-bold">{formatCurrency(totalChange)}</span>
                    </div>
                )}
                <div className="flex justify-between gap-8 border-t mt-1 pt-1">
                    <span className="text-muted-foreground">Restante:</span>
                    <span className={cn("font-bold", remainingAmount > 0.01 ? 'text-destructive' : 'text-green-600')}>
                        {formatCurrency(remainingAmount)}
                    </span>
                </div>
            </div>
            <Button onClick={handleSubmit} disabled={isProcessing} className="w-full sm:w-auto px-8 h-12 text-lg">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4"/>}
                Finalizar [Enter]
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
                                <p className="font-bold text-lg">R$ {att.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <Button size="sm" onClick={() => onSelect(att)}>Pagar</Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </ScrollArea>
    );
}

function SalesHistoryTab({ salesHistory, onCancelSale }: { salesHistory: Sale[], onCancelSale: (sale: Sale) => void }) {
    const { user } = useAuth();
   
    return (
        <div className="flex flex-col h-[calc(100vh-18rem)]">
            <ScrollArea className="flex-grow">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Itens</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-center w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {salesHistory.length > 0 ? (
                            salesHistory.map(sale => (
                                <TableRow key={sale.id} className={cn(sale.status === 'cancelled' && 'text-muted-foreground line-through')}>
                                    <TableCell>{format(sale.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col gap-1">
                                            {sale.items?.map((item: any, index: number) => (
                                                <div key={item.id + index}>
                                                    <span className="font-semibold">{item.name}</span>
                                                    {item.type === 'kit' && item.chosenProducts && (
                                                        <span className="text-xs text-muted-foreground ml-1">
                                                            ({item.chosenProducts.map((p: any) => p.name).join(', ')})
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                     <TableCell>
                                         <div className="flex flex-col gap-1">
                                            {sale.payments?.map((p, i) => (
                                                <Badge key={i} variant="outline">{p.conditionName}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>{sale.cashier}</TableCell>
                                    <TableCell className="text-right">R${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-center">
                                       {user?.enabledModules?.pos?.delete && sale.status !== 'cancelled' && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => setTimeout(() => onCancelSale(sale), 0)} className="text-destructive focus:text-destructive">
                                                        <Ban className="mr-2"/>
                                                        Cancelar Venda
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                        {sale.status === 'cancelled' && <Badge variant="destructive">Cancelada</Badge>}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Nenhuma venda registrada ainda.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
}

function KitSelectionModal({ kit, products, isOpen, onOpenChange, onConfirm, allowNegative = false }: { kit: Kit; products: ProductWithStock[]; isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onConfirm: (chosenProducts: Product[]) => void; allowNegative?: boolean; }) {
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
        if (!kit) return [];
        const baseEligible = products.filter(p => kit.eligibleProductIds?.includes(p.id));
        
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
        if (!productWithStock || (productWithStock.availableStock <= 0 && !allowNegative)) {
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
            <DialogContent className="sm:max-w-4xl grid grid-rows-[auto_1fr_auto] h-[90vh] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Monte seu Kit: {kit.name}</DialogTitle>
                    <DialogDescription>Selecione {kit.numberOfItems} dos produtos abaixo. Você pode selecionar o mesmo produto mais de uma vez.</DialogDescription>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 min-h-0 flex-grow">
                    <div className="flex flex-col gap-4 min-h-0">
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
                                            <p className="text-xs text-muted-foreground">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                     <div className="flex flex-col gap-4 min-h-0">
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
                                                    <p className="text-xs text-muted-foreground">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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

function WeightInputModal({ product, isOpen, onOpenChange, onConfirm }: { product: ProductWithStock | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onConfirm: (quantity: number, totalValue: number) => void; }) {
    const [quantity, setQuantity] = useState<string>('0');
    const [totalValue, setTotalValue] = useState<number>(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuantity('0');
            setTotalValue(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleQuantityChange = (val: string) => {
        setQuantity(val);
        const num = parseFloat(val.replace(',', '.')) || 0;
        if (product) {
            const calculatedTotal = num * product.price;
            // Round to 2 decimals to match currency expectation
            setTotalValue(Math.round(calculatedTotal * 100) / 100);
        }
    };

    const handleValueChange = (val: string) => {
        const numValue = parseCurrencyToNumber(val);
        setTotalValue(numValue);
        if (product && product.price > 0) {
            const calculatedQty = numValue / product.price;
            setQuantity(calculatedQty.toFixed(3).replace('.', ','));
        }
    };

    const handleConfirm = () => {
        const num = parseFloat(quantity.replace(',', '.'));
        if (num > 0) {
            onConfirm(num, totalValue);
            onOpenChange(false);
        }
    };

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Venda por Peso/Medida: {product.name}</DialogTitle>
                    <DialogDescription>
                        Informe a quantidade ou o valor desejado.
                        <br/>
                        Preço por {product.unitOfMeasure || 'unidade'}: {formatCurrency(product.price)}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="weight-quantity">Quantidade ({product.unitOfMeasure || 'KG'})</Label>
                        <Input
                            id="weight-quantity"
                            ref={inputRef}
                            type="text"
                            inputMode="decimal"
                            value={quantity}
                            onChange={(e) => handleQuantityChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                            className="text-2xl h-14 text-center font-mono"
                        />
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Ou informe o valor</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="weight-value">Valor Total (R$)</Label>
                        <Input
                            id="weight-value"
                            type="text"
                            value={formatCurrency(totalValue)}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                            className="text-2xl h-14 text-center font-mono"
                        />
                    </div>

                    {totalValue > 0 && (
                        <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                            <p className="text-sm text-muted-foreground">Resumo da Inclusão</p>
                            <p className="text-2xl font-bold text-primary">
                                {formatCurrency(totalValue)}
                            </p>
                            <p className="text-xs opacity-70">
                                {quantity} {product.unitOfMeasure || 'unidade'} x {formatCurrency(product.price)}
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirm} size="lg" className="w-full sm:w-auto">Confirmar Inclusão</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function UnitSelectionModal({ product, isOpen, onOpenChange, onConfirm }: { product: ProductWithStock | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onConfirm: (unitId: string | 'base') => void; }) {
    if (!product) return null;
    const saleUnits = product.saleUnits || [];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Escolha a Unidade: {product.name}</DialogTitle>
                    <DialogDescription>Selecione a unidade de venda para este produto.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-1"
                        onClick={() => onConfirm('base')}
                    >
                        <span className="font-bold">{product.unitOfMeasure || 'Unidade Base'}</span>
                        <span className="text-sm text-muted-foreground">{formatCurrency(product.price)}</span>
                    </Button>
                    {saleUnits.map((unit) => (
                        <Button 
                            key={unit.id}
                            variant="outline" 
                            className="h-20 flex flex-col items-center justify-center gap-1"
                            onClick={() => onConfirm(unit.id)}
                        >
                            <span className="font-bold">{unit.name}</span>
                            <span className="text-sm text-muted-foreground">{formatCurrency(unit.price)}</span>
                            <span className="text-[10px] opacity-70">Multiplicador: x{unit.multiplier}</span>
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function POSPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [currentAttendanceId, setCurrentAttendanceId] = useState<string | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [weightProduct, setWeightProduct] = useState<ProductWithStock | null>(null);
  const [unitProduct, setUnitProduct] = useState<ProductWithStock | null>(null);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [globalQuantity, setGlobalQuantity] = useState(1);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isSupervisorAuthOpen, setIsSupervisorAuthOpen] = useState(false);
  const [supervisorAuthAction, setSupervisorAuthAction] = useState<{
      type: 'cart_removal' | 'cash_close' | 'cart_clear' | 'cash_adjustment';
      description: string;
      permission: 'canAuthorizeCartItemRemoval' | 'canAuthorizeCashClose' | 'canAuthorizeCartClear' | 'canAuthorizeCashAdjustment';
      data?: any;
  } | null>(null);
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Barcode Scanner Listener (Physical Device)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Ignorar se algum modal estiver aberto (exceto se for o PDV limpo)
        if (isCheckoutModalOpen || isScannerOpen || !!selectedKit || isWeightModalOpen || isUnitModalOpen || isClosingSession || isSupervisorAuthOpen) return;
        
        // Ignorar se o foco estiver em um input (deixa o input tratar)
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        const now = Date.now();
        const diff = now - lastKeyTimeRef.current;
        lastKeyTimeRef.current = now;

        // Scanners físicos digitam muito rápido (geralmente < 50ms entre teclas)
        if (diff > 100) {
            barcodeBufferRef.current = '';
        }

        if (e.key === 'Enter') {
            if (barcodeBufferRef.current.length >= 3) {
                const code = barcodeBufferRef.current;
                barcodeBufferRef.current = '';
                handleScan(code);
            }
            barcodeBufferRef.current = '';
        } else if (e.key.length === 1 && /[0-9]/.test(e.key)) {
            barcodeBufferRef.current += e.key;
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCheckoutModalOpen, isScannerOpen, selectedKit, isWeightModalOpen, isUnitModalOpen, isClosingSession, isSupervisorAuthOpen, products]);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, currentBranch, loading: authLoading, paymentConditions } = useAuth();
  const router = useRouter();

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Se o caixa estiver fechado, permite abrir com Enter
        if (!activeSession) {
            if (e.key === 'Enter' && !isOpeningSession) {
                e.preventDefault();
                setIsOpeningSession(true);
            }
            return;
        }

        // Ignore if any modal is open
        if (isCheckoutModalOpen || isScannerOpen || !!selectedKit || isWeightModalOpen || isUnitModalOpen || isClosingSession) return;

        // F2 - Focus Search
        if (e.key === 'F2') {
            e.preventDefault();
            searchInputRef.current?.focus();
        }
        // Alt + Q - Focus Quantity
        if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
            e.preventDefault();
            e.stopPropagation();
            quantityInputRef.current?.focus();
            quantityInputRef.current?.select();
        }
        // F8 - Checkout
        if (e.key === 'F8' && cart.length > 0) {
            e.preventDefault();
            setIsCheckoutModalOpen(true);
        }
        // F9 - Clear Cart
        if (e.key === 'F9' && cart.length > 0) {
            e.preventDefault();
            initiateCartClear();
        }
        // Alt + 1-5 - Switch Tabs
        if (e.altKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
            const tabs = ['pending', 'products', 'combos', 'kits', 'history'];
            const index = parseInt(e.key) - 1;
            if (tabs[index]) {
                e.preventDefault();
                setActiveTab(tabs[index]);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCheckoutModalOpen, isScannerOpen, selectedKit, isWeightModalOpen, isUnitModalOpen, cart.length]);

  useEffect(() => {
    if (!user || !currentBranch) return;

    const q = query(
        collection(db, 'cashSessions'),
        where('organizationId', '==', user.organizationId),
        where('branchId', '==', currentBranch.id),
        where('userId', '==', user.id),
        where('status', '==', 'open')
    );

    const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
            setActiveSession({ id: snap.docs[0].id, ...snap.docs[0].data() } as CashSession);
        } else {
            setActiveSession(null);
        }
        setSessionLoading(false);
    });

    return () => unsub();
  }, [user, currentBranch]);

  useEffect(() => {
    if (authLoading || !currentBranch || !user?.organizationId) {
        setLoading(true);
        return;
    }

    const productsQuery = query(collection(db, 'products'), where('organizationId', '==', user.organizationId));
    const combosQuery = query(collection(db, 'combos'), where('organizationId', '==', user.organizationId));
    const kitsQuery = query(collection(db, 'kits'), where('organizationId', '==', user.organizationId));
    const salesQuery = query(collection(db, 'sales'), where('branchId', '==', currentBranch.id));
    const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));

    let allProductsData: Product[] = [];
    let entriesData: StockEntry[] = [];

    const updateCombinedProducts = () => {
        const filteredProducts = allProductsData.filter(p => 
            !p.isDeleted && (
                (p.branchIds && p.branchIds.includes(currentBranch.id)) || 
                (p.branchId === currentBranch.id)
            )
        );

        // Optimization: Use a map to sum stock in O(S) time
        const stockMap = new Map<string, number>();
        entriesData.forEach(e => {
            const current = stockMap.get(e.productId) || 0;
            stockMap.set(e.productId, current + e.quantity);
        });

        const productsWithStock = filteredProducts.map(p => {
            return { ...p, stock: stockMap.get(p.id) || 0 };
        });

        const sortedProducts = productsWithStock.sort((a,b) => {
            if (a.order !== undefined && b.order !== undefined) {
                return a.order - b.order;
            }
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            return a.name.localeCompare(b.name);
        });

        setProducts(sortedProducts);
        setLoading(false);
    };

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
        allProductsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        updateCombinedProducts();
    });

    const unsubscribeStock = onSnapshot(stockEntriesQuery, (snapshot) => {
        entriesData = snapshot.docs.map(doc => doc.data() as StockEntry);
        updateCombinedProducts();
    });

    const unsubscribeSales = onSnapshot(salesQuery, (salesSnapshot) => {
        const salesData = salesSnapshot.docs.map(doc => convertSaleDate({ id: doc.id, ...doc.data() }));
        const sortedSales = salesData.sort((a,b) => b.date.getTime() - a.date.getTime());
        setSalesHistory(sortedSales);
    });

    const unsubscribeCombos = onSnapshot(combosQuery, (querySnapshot) => {
      const allCombos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Combo));
      const filtered = allCombos.filter(c => 
          !c.isDeleted && (
              (c.branchId === currentBranch.id) || 
              ((c as any).branchIds && (c as any).branchIds.includes(currentBranch.id))
          )
      );
      setCombos(filtered);
    });

    const unsubscribeKits = onSnapshot(kitsQuery, (querySnapshot) => {
      const allKits = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kit));
      const filtered = allKits.filter(k => 
          !k.isDeleted && (
              (k.branchId === currentBranch.id) || 
              ((k as any).branchIds && (k as any).branchIds.includes(currentBranch.id))
          )
      );
      setKits(filtered);
    });

    return () => {
        unsubscribeProducts();
        unsubscribeStock();
        unsubscribeCombos();
        unsubscribeKits();
        unsubscribeSales();
    }
  }, [currentBranch, authLoading, user]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.isSalable && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
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

  const handleWeightConfirm = (quantity: number, totalValue: number) => {
    if (!weightProduct) return;
    addToCart(weightProduct, 'product', quantity, totalValue);
    setWeightProduct(null);
  };

  const handleUnitConfirm = (unitId: string | 'base') => {
    if (!unitProduct) return;
    
    if (unitId === 'base') {
        // Pass the current globalQuantity so it doesn't trigger the modal again
        addToCart(unitProduct, 'product', globalQuantity);
    } else {
        const unit = unitProduct.saleUnits?.find(u => u.id === unitId);
        if (unit) {
            // Add as a special cart item representing the unit
            // quantity is the billing quantity (e.g. 1 box)
            // we add a custom property 'stockMultiplier' to handle stock deduction later
            const cartItem: any = {
                ...unitProduct,
                id: `${unitProduct.id}-${unit.id}`,
                name: `${unitProduct.name} (${unit.name})`,
                price: unit.price,
                quantity: globalQuantity,
                stockMultiplier: unit.multiplier,
                itemType: 'product'
            };
            setCart(prev => [...prev, cartItem]);
            setGlobalQuantity(1);
        }
    }
    setUnitProduct(null);
    setIsUnitModalOpen(false);
  };

  const addToCart = (item: ProductWithStock | Combo, type: 'product' | 'combo', forcedQuantity?: number, forcedTotal?: number) => {
    if (currentAttendanceId) {
        toast({ title: 'Ação bloqueada', description: 'Finalize o pagamento do atendimento pendente antes de iniciar uma nova venda.', variant: 'destructive' });
        return;
    }

    const allowNegative = currentBranch?.allowNegativeStock ?? false;
    
    // CRITICAL: We only use globalQuantity if it's NOT a product with units (because unit selection handles it)
    // AND it's NOT a weight-based product (because weight modal handles it)
    // AND forcedQuantity is not provided.
    
    const product = type === 'product' ? item as ProductWithStock : null;
    const hasUnits = product?.saleUnits && product.saleUnits.length > 0;
    const isWeight = product?.saleType === 'weight';

    if (type === 'product' && product) {
        // 1. Handle Unit Selection (Triggers modal)
        if (hasUnits && forcedQuantity === undefined) {
            setUnitProduct(product);
            setIsUnitModalOpen(true);
            return;
        }

        // 2. Handle Weight Selection (Triggers modal)
        if (isWeight && forcedQuantity === undefined) {
            setWeightProduct(product);
            setIsWeightModalOpen(true);
            return;
        }
    }

    const qtyToAdd = forcedQuantity !== undefined ? forcedQuantity : globalQuantity;

    if (type === 'product' && product) {
        if (product.stock <= 0 && !allowNegative) {
            toast({ title: 'Fora de estoque', description: `${product.name} não está disponível.`, variant: 'destructive'});
            return;
        }

         setCart((prev) => {
            // If we have a forcedTotal, we treat it as a unique line item
            if (forcedTotal !== undefined) {
                 return [...prev, { ...product, quantity: qtyToAdd, total: forcedTotal, itemType: 'product', id: `${product.id}-${Date.now()}` } as any];
            }

            const itemKey = product.id; 

            const existingItem = prev.find((cartItem) => cartItem.id === itemKey && cartItem.itemType === 'product');
            if (existingItem) {
                if (existingItem.quantity + qtyToAdd > (existingItem as ProductWithStock).stock && !allowNegative) {
                     toast({ title: 'Limite de estoque atingido', description: `Você não pode adicionar mais de ${(existingItem as ProductWithStock).stock} unidades de ${existingItem.name}.`, variant: 'destructive'});
                    return prev;
                }
                return prev.map((ci) =>
                ci.id === product.id ? { ...ci, quantity: ci.quantity + qtyToAdd } : ci
                );
            }
            return [...prev, { ...product, quantity: qtyToAdd, itemType: 'product' }];
        });
    } else {
        const combo = item as Combo;
        // Check stock for all products in combo
        if (!allowNegative) {
            for (const comboProduct of combo.products) {
                const productInStore = products.find(p => p.id === comboProduct.productId);
                if (!productInStore || productInStore.stock < comboProduct.quantity * qtyToAdd) {
                    toast({ title: 'Estoque insuficiente para o combo', description: `O produto ${comboProduct.productName} não tem estoque suficiente para montar o combo ${combo.name}.`, variant: 'destructive'});
                    return;
                }
            }
        }
        setCart(prev => {
            const existingItem = prev.find(ci => ci.id === combo.id && ci.itemType === 'combo');
            if (existingItem) {
                // Check stock for subsequent additions of the same combo
                if (!allowNegative) {
                    for (const comboProduct of combo.products) {
                        const productInStore = products.find(p => p.id === comboProduct.productId);
                        const cartProduct = cart.find(ci => ci.id === comboProduct.productId && ci.itemType === 'product');
                        const cartComboUsage = cart.filter(ci => ci.itemType === 'combo').reduce((acc, c) => {
                            const pInCombo = (c as Combo).products.find(p => p.productId === comboProduct.productId);
                            return acc + (pInCombo ? pInCombo.quantity * c.quantity : 0);
                        }, 0);

                        if (!productInStore || productInStore.stock < (cartProduct?.quantity || 0) + cartComboUsage + (comboProduct.quantity * qtyToAdd)) {
                            toast({ title: 'Estoque insuficiente para o combo', description: `O produto ${comboProduct.productName} não tem estoque suficiente para adicionar outro combo ${combo.name}.`, variant: 'destructive'});
                            return prev;
                        }
                    }
                }
                return prev.map(ci => ci.id === combo.id ? {...ci, quantity: ci.quantity + qtyToAdd} : ci);
            }
            return [...prev, {...combo, quantity: qtyToAdd, itemType: 'combo'}];
        });
    }

    // Reset global quantity to 1 after adding
    if (forcedQuantity === undefined) {
        setGlobalQuantity(1);
    }
  };
  
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, activeTab]);

  const filteredItemsInTab = useMemo(() => {
    if (activeTab === 'products') return filteredProducts;
    if (activeTab === 'combos') return filteredCombos;
    if (activeTab === 'kits') return filteredKits;
    return [];
  }, [activeTab, filteredProducts, filteredCombos, filteredKits]);

  const handleScan = (barcode: string) => {
    setIsScannerOpen(false);
    
    // Check if barcode belongs to an alternative unit
    for (const p of products) {
        const unit = p.saleUnits?.find(u => u.barcode === barcode);
        if (unit) {
            const cartItem: any = {
                ...p,
                id: `${p.id}-${unit.id}`,
                name: `${p.name} (${unit.name})`,
                price: unit.price,
                quantity: globalQuantity,
                stockMultiplier: unit.multiplier,
                itemType: 'product'
            };
            setCart(prev => [...prev, cartItem]);
            setGlobalQuantity(1);
            toast({ title: "Unidade adicionada!", description: `${p.name} (${unit.name}) adicionado.` });
            return;
        }
    }

    const product = products.find(p => p.barcode === barcode);
    if (product) {
        addToCart(product, 'product');
        toast({ title: "Produto adicionado!", description: `${product.name} foi adicionado ao carrinho.` });
    } else {
        toast({ title: "Produto não encontrado", description: "Nenhum produto com este código de barras foi encontrado.", variant: 'destructive' });
    }
  };
  
  const handleAuthorizedAction = useCallback(async (supervisorId: string, supervisorName: string) => {
      if (!supervisorAuthAction) return;

      if (supervisorAuthAction.type === 'cart_removal') {
          const { itemId, itemType } = supervisorAuthAction.data;
          const itemToRemove = cart.find(i => i.id === itemId && i.itemType === itemType);
          
          if (itemToRemove && user && currentBranch) {
              // Record the audit log in Firestore
              try {
                  const logRef = doc(collection(db, 'auditLogs'));
                  await setDoc(logRef, {
                      id: logRef.id,
                      organizationId: user.organizationId,
                      branchId: currentBranch.id,
                      timestamp: serverTimestamp(),
                      itemId: itemToRemove.id,
                      itemName: itemToRemove.name,
                      itemType: itemToRemove.itemType,
                      itemPrice: getCartItemPrice(itemToRemove),
                      operatorId: user.id,
                      operatorName: user.name,
                      supervisorId: supervisorId,
                      supervisorName: supervisorName,
                      sessionId: activeSession?.id,
                      actionType: 'item_removal'
                  });
              } catch (error) {
                  console.error("Error recording audit log:", error);
              }
          }

          setCart(cart => cart.filter(item => !(item.id === itemId && item.itemType === itemType)));
          toast({ title: 'Item removido', description: `Ação autorizada por ${supervisorName}` });
      } else if (supervisorAuthAction.type === 'cart_clear') {
          setCart([]);
          setCurrentAttendanceId(undefined);
          setSelectedCustomer(null);
          toast({ title: 'Carrinho limpo', description: `Ação autorizada por ${supervisorName}` });
      }
      
      setSupervisorAuthAction(null);
  }, [supervisorAuthAction, cart, user, currentBranch, activeSession, toast]);

  const initiateCashClose = () => {
      setIsClosingSession(true);
  };

  const initiateCartClear = () => {
    if (user?.canAuthorizeCartClear || user?.role === 'admin' || user?.role === 'manager') {
        setCart([]);
        setCurrentAttendanceId(undefined);
        setSelectedCustomer(null);
        return;
    }

    setSupervisorAuthAction({
        type: 'cart_clear',
        description: 'Limpar Carrinho Inteiro',
        permission: 'canAuthorizeCartClear'
    });
    setIsSupervisorAuthOpen(true);
  };

  const initiateCashAdjustment = () => {
      setIsAdjustmentOpen(true);
  };

  const removeFromCart = (itemId: string, itemType: CartItem['itemType']) => {
      // Check if current user has permission
      if (user?.canAuthorizeCartItemRemoval || user?.role === 'admin' || user?.role === 'manager') {
          setCart(cart => cart.filter(item => !(item.id === itemId && item.itemType === itemType)));
          return;
      }

      // Need supervisor authorization
      const item = cart.find(i => i.id === itemId && i.itemType === itemType);
      setSupervisorAuthAction({
          type: 'cart_removal',
          description: `Remover item: ${item?.name}`,
          permission: 'canAuthorizeCartItemRemoval',
          data: { itemId, itemType }
      });
      setIsSupervisorAuthOpen(true);
  }

  const { subtotal, totalDiscount } = useMemo(() => {
    return cart.reduce(
        (acc, item) => {
            let itemTotal;
            let itemOriginalTotal;

            if (item.itemType === 'product') {
                const price = (item as ProductWithStock).price || (item as AttendanceItem).price || 0;
                itemTotal = (item as any).total !== undefined ? (item as any).total : price * item.quantity;
                itemOriginalTotal = (item as any).total !== undefined ? (item as any).total : price * item.quantity;
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
                 const multiplier = (item as any).stockMultiplier || 1;
                 const entry: Omit<StockEntry, 'id'> = {
                    productId: (item as any).id.split('-')[0], // Get original product ID
                    productName: item.name,
                    quantity: -(item.quantity * multiplier),
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
                const price = (item as any).price || 0;
                baseItem.price = price;
                baseItem.total = (item as any).total !== undefined ? (item as any).total : price * item.quantity;
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
        const saleId = saleRef.id;
        const saleData: Omit<Sale, 'id'> = {
            items: saleItems,
            total: grandTotal,
            date: new Date(),
            cashier: user.name,
            branchId: currentBranch.id,
            organizationId: user.organizationId,
            payments: payments,
            status: 'completed',
            sessionId: activeSession?.id,
            ...(attendanceId && { attendanceId: attendanceId }),
            ...(customerId && { customerId: customerId }),
        };
        batch.set(saleRef, { ...saleData, date: saleDate }); // Use server timestamp for sale as well
        
        // Handle Cash Transactions and Session Totals
        if (activeSession) {
            let cashInflow = 0;
            const sessionUpdates: Record<string, any> = {};

            payments.forEach(p => {
                const key = `paymentTotals.${p.conditionName.replace(/\./g, '_')}`;
                sessionUpdates[key] = increment(p.amount);

                if (p.type === 'cash') {
                    cashInflow += p.amount;
                    
                    const transactionRef = doc(collection(db, 'cashTransactions'));
                    batch.set(transactionRef, {
                        id: transactionRef.id,
                        sessionId: activeSession.id,
                        organizationId: user.organizationId,
                        branchId: currentBranch.id,
                        type: 'sale',
                        amount: p.amount,
                        date: saleDate,
                        description: `Venda ${saleId.substring(0, 5)}...`,
                        saleId: saleId,
                    });
                }
            });

            const sessionRef = doc(db, 'cashSessions', activeSession.id);
            batch.update(sessionRef, {
                ...sessionUpdates,
                totalSales: increment(cashInflow),
            });
        }
        
        // If it's a payment for an attendance, update its status
        if (attendanceId) {
            const attendanceRef = doc(db, 'attendances', attendanceId);
            batch.update(attendanceRef, { paymentStatus: 'paid' });
        }

        await batch.commit();

        toast({ title: 'Compra finalizada com sucesso!', description: `Total: R$${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`});
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

    const handleCancelSale = async (sale: Sale) => {
        if (!user || !currentBranch) return;

        const batch = writeBatch(db);
        const saleDate = serverTimestamp();

        // Revert stock
        for (const item of sale.items) {
            if (item.type === 'product') {
                 const entry: Omit<StockEntry, 'id'> = {
                    productId: item.id,
                    productName: item.name,
                    quantity: item.quantity,
                    type: 'cancellation',
                    date: saleDate,
                    userId: user.id,
                    userName: user.name,
                    branchId: currentBranch.id,
                    organizationId: user.organizationId,
                    notes: `Cancelamento Venda: ${sale.id}`,
                };
                batch.set(doc(collection(db, "stockEntries")), entry);
            } else if (item.type === 'combo') {
                const comboDoc = combos.find(c => c.id === item.id);
                if (comboDoc) {
                    for (const product of comboDoc.products) {
                         const entry: Omit<StockEntry, 'id'> = {
                            productId: product.productId,
                            productName: product.productName,
                            quantity: product.quantity * item.quantity,
                            type: 'cancellation',
                            date: saleDate,
                            userId: user.id,
                            userName: user.name,
                            branchId: currentBranch.id,
                            organizationId: user.organizationId,
                            notes: `Cancelamento Venda: ${sale.id} (Combo: ${item.name})`,
                        };
                        batch.set(doc(collection(db, "stockEntries")), entry);
                    }
                }
            } else if (item.type === 'kit') {
                for (const product of item.chosenProducts) {
                     const entry: Omit<StockEntry, 'id'> = {
                        productId: product.id,
                        productName: product.name,
                        quantity: 1 * item.quantity, // Each chosen product is one unit
                        type: 'cancellation',
                        date: saleDate,
                        userId: user.id,
                        userName: user.name,
                        branchId: currentBranch.id,
                        organizationId: user.organizationId,
                        notes: `Cancelamento Venda: ${sale.id} (Kit: ${item.name})`,
                    };
                    batch.set(doc(collection(db, "stockEntries")), entry);
                }
            }
        }

        // Update sale status
        const saleRef = doc(db, 'sales', sale.id);
        batch.update(saleRef, { status: 'cancelled' as SaleStatus });

        // Revert Cash Session Totals if applicable
        if (sale.sessionId) {
            let cashToRevert = 0;
            const sessionUpdates: Record<string, any> = {};

            sale.payments.forEach(p => {
                const key = `paymentTotals.${p.conditionName.replace(/\./g, '_')}`;
                sessionUpdates[key] = increment(-p.amount);
                if (p.type === 'cash') cashToRevert += p.amount;
            });

            if (cashToRevert > 0 || Object.keys(sessionUpdates).length > 0) {
                const sessionRef = doc(db, 'cashSessions', sale.sessionId);
                batch.update(sessionRef, {
                    ...sessionUpdates,
                    totalSales: increment(-cashToRevert)
                });
            }

            if (cashToRevert > 0) {
                const transactionRef = doc(collection(db, 'cashTransactions'));
                batch.set(transactionRef, {
                    id: transactionRef.id,
                    sessionId: sale.sessionId,
                    organizationId: user.organizationId,
                    branchId: currentBranch.id,
                    type: 'adjustment',
                    amount: -cashToRevert,
                    date: saleDate,
                    description: `Estorno Venda ${sale.id.substring(0, 5)}...`,
                    saleId: sale.id,
                });
            }
        }

        try {
            await batch.commit();
            toast({ title: 'Venda cancelada e estoque revertido!' });
        } catch (error) {
            console.error("Error cancelling sale:", error);
            toast({ title: 'Erro ao cancelar venda', variant: 'destructive' });
        }
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

  if (sessionLoading || authLoading) {
    return (
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <>
    {!activeSession ? (
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Caixa Fechado</CardTitle>
                    <CardDescription>Você precisa abrir o caixa para começar a vender.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-6">
                    <div className="rounded-full bg-primary/10 p-6">
                        <DollarSign className="h-12 w-12 text-primary" />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full h-12 text-lg" onClick={() => setIsOpeningSession(true)}>
                        <Play className="mr-2 h-5 w-5" /> Abrir Caixa Agora [Enter]
                    </Button>
                </CardFooter>
            </Card>
            <OpenSessionDialog isOpen={isOpeningSession} onOpenChange={setIsOpeningSession} />
        </div>
    ) : (
        <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden -mt-4">
            <div className="flex justify-between items-center mb-2 shrink-0">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs py-0.5 px-2 bg-green-50 text-green-700 border-green-200">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                        Caixa: {activeSession.userName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        Início: {activeSession.openedAt?.toDate ? format(activeSession.openedAt.toDate(), 'HH:mm') : '...'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="xs" onClick={initiateCashAdjustment} className="h-7 text-xs py-0 px-2">
                        <ArrowDownCircle className="mr-1 h-3 w-3 text-orange-500" /> Ajuste de Caixa
                    </Button>
                    <Button variant="outline" size="xs" onClick={initiateCashClose} className="h-7 text-xs text-destructive hover:text-destructive py-0 px-2">
                        <StopCircle className="mr-1 h-3 w-3" /> Fechar Caixa
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
              <div className="md:col-span-2 flex flex-col min-h-0">
                <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <CardHeader className="py-2 px-4 shrink-0">
                      <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-base">Frente de Caixa</CardTitle>
                            <CardDescription className="text-xs">Selecione itens para vender.</CardDescription>
                        </div>
                      </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col min-h-0 p-2 pt-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                         <TabsList className="grid w-full grid-flow-col auto-cols-fr h-8 shrink-0">
                            {user?.enabledModules?.appointments?.view && <TabsTrigger value="pending" className="text-xs px-1"><UserCheck className="mr-1 h-3 w-3"/><span className="hidden sm:inline">Atend.</span></TabsTrigger>}
                            <TabsTrigger value="products" className="text-xs px-1"><Package className="mr-1 h-3 w-3"/><span className="hidden sm:inline">Prod.</span></TabsTrigger>
                            {user?.enabledModules?.combos?.view && <TabsTrigger value="combos" className="text-xs px-1"><Gift className="mr-1 h-3 w-3"/><span className="hidden sm:inline">Combos</span></TabsTrigger>}
                            {user?.enabledModules?.kits?.view && <TabsTrigger value="kits" className="text-xs px-1"><Component className="mr-1 h-3 w-3"/><span className="hidden sm:inline">Kits</span></TabsTrigger>}
                            <TabsTrigger value="history" className="text-xs px-1"><History className="mr-1 h-3 w-3"/><span className="hidden sm:inline">Hist.</span></TabsTrigger>
                        </TabsList>
                        <div className="relative py-2 flex gap-2 shrink-0">
                            <div className="w-16">
                                <Input
                                    ref={quantityInputRef}
                                    type="number"
                                    min="1"
                                    value={globalQuantity}
                                    onChange={(e) => setGlobalQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="text-center font-bold h-8 text-sm px-1"
                                    title="Qtd [Alt+Q]"
                                />
                            </div>
                            <div className="relative flex-grow">
                                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    ref={searchInputRef}
                                    type="search"
                                    placeholder="Buscar... [F2]"
                                    className="w-full h-8 rounded-lg bg-background pl-8 text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setHighlightedIndex(prev => Math.min(prev + 1, filteredItemsInTab.length - 1));
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setHighlightedIndex(prev => Math.max(prev - 1, 0));
                                        } else if (e.key === 'Enter' && searchQuery.trim() !== '') {
                                            e.preventDefault();
                                            const items = filteredItemsInTab;
                                            if (items.length > 0 && highlightedIndex < items.length) {
                                                const item = items[highlightedIndex];
                                                if (activeTab === 'products') {
                                                    addToCart(item as ProductWithStock, 'product');
                                                } else if (activeTab === 'combos') {
                                                    addToCart(item as Combo, 'combo');
                                                } else if (activeTab === 'kits') {
                                                    setSelectedKit(item as Kit);
                                                }
                                                toast({ title: "Item adicionado!", description: `${item.name} adicionado ao carrinho.` });
                                                setSearchQuery('');
                                                setHighlightedIndex(0);
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <Button variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} className="h-8 w-8">
                                <Barcode className="h-4 w-4" />
                            </Button>
                        </div>

                         <TabsContent value="pending" className="mt-0 flex-1 min-h-0 overflow-hidden">
                            <PendingAttendancesTab onSelect={handleSelectAttendance} />
                        </TabsContent>
                        <TabsContent value="products" className="mt-0 flex-1 min-h-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                {loading ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-1">
                                    {Array.from({ length: 10 }).map((_, i) => (
                                        <Card key={i} className="h-28">
                                        <CardContent className="p-1 flex flex-col items-center justify-center h-full">
                                            <Skeleton className="h-16 w-16 rounded-md" />
                                            <Skeleton className="h-3 w-14 mt-1"/>
                                        </CardContent>
                                        </Card>
                                    ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-1">
                                    {filteredProducts.map((product, index) => (
                                        <Card 
                                        key={product.id} 
                                        onClick={() => addToCart(product, 'product')} 
                                        className={cn(
                                            "cursor-pointer hover:shadow-md transition-all relative h-32 flex flex-col",
                                            index === highlightedIndex && activeTab === 'products' && "ring-2 ring-primary shadow-md bg-accent/10 z-10"
                                        )}
                                        >
                                        <Badge className="absolute top-0.5 right-0.5 text-[10px] px-1 h-4" variant={product.stock > 0 ? "secondary" : "destructive"}>
                                            {product.stock > 0 ? product.stock : '0'}
                                        </Badge>
                                        <CardContent className="p-1 flex-1 flex flex-col items-center justify-center overflow-hidden">
                                            <div className="relative w-12 h-12 flex-shrink-0">
                                                <Image src={product.imageUrl} alt={product.name} fill className="rounded-md object-cover" data-ai-hint="product image"/>
                                            </div>
                                            <p className="font-semibold text-[11px] mt-1 text-center line-clamp-2 leading-tight">{product.name}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">R${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </CardContent>
                                        </Card>
                                    ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="combos" className="mt-0 flex-1 min-h-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-1">
                                {filteredCombos.map((combo, index) => (
                                    <Card 
                                    key={combo.id} 
                                    onClick={() => addToCart(combo, 'combo')} 
                                    className={cn(
                                        "cursor-pointer hover:shadow-md transition-all relative h-32 flex flex-col",
                                        index === highlightedIndex && activeTab === 'combos' && "ring-2 ring-primary shadow-md bg-accent/10 z-10"
                                    )}
                                    >
                                    <CardContent className="p-1 flex-1 flex flex-col items-center justify-center overflow-hidden">
                                        <div className="relative w-12 h-12 flex-shrink-0">
                                            <Image src={combo.imageUrl} alt={combo.name} fill className="rounded-md object-cover" data-ai-hint="combo offer"/>
                                        </div>
                                        <p className="font-semibold text-[11px] mt-1 text-center line-clamp-2 leading-tight">{combo.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">R${combo.finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </CardContent>
                                    </Card>
                                ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="kits" className="mt-0 flex-1 min-h-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-1">
                                {filteredKits.map((kit, index) => (
                                    <Card 
                                    key={kit.id} 
                                    onClick={() => setSelectedKit(kit)} 
                                    className={cn(
                                        "cursor-pointer hover:shadow-md transition-all relative h-32 flex flex-col",
                                        index === highlightedIndex && activeTab === 'kits' && "ring-2 ring-primary shadow-md bg-accent/10 z-10"
                                    )}
                                    >
                                    <CardContent className="p-1 flex-1 flex flex-col items-center justify-center overflow-hidden">
                                        <div className="relative w-12 h-12 flex-shrink-0">
                                            <Image src={kit.imageUrl} alt={kit.name} fill className="rounded-md object-cover" data-ai-hint="kit offer"/>
                                        </div>
                                        <p className="font-semibold text-[11px] mt-1 text-center line-clamp-2 leading-tight">{kit.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Monte seu kit!</p>
                                    </CardContent>
                                    </Card>
                                ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="history" className="mt-0 flex-1 min-h-0 overflow-hidden">
                                <SalesHistoryTab salesHistory={salesHistory} onCancelSale={handleCancelSale} />
                        </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-1 flex flex-col min-h-0">
                <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <CardHeader className="py-2 px-4 shrink-0">
                     <div className="flex justify-between items-center">
                         <CardTitle className="text-base">Carrinho</CardTitle>
                         {cart.length > 0 && <Button variant="ghost" size="xs" onClick={initiateCartClear} className="h-7 text-xs px-2">Limpar [F9]</Button>}

                     </div>
                     {currentAttendanceId && <CardDescription className="text-[10px]">Atendimento pendente</CardDescription>}
                     {selectedCustomer && !currentAttendanceId && (
                        <CardDescription className="flex items-center gap-1 text-[10px] truncate">
                            Para: <span className="font-medium truncate">{selectedCustomer.name}</span>
                        </CardDescription>
                     )}
                  </CardHeader>
                  <CardContent className="flex-1 p-2 pt-0 min-h-0 overflow-hidden">
                    <ScrollArea className="h-full">
                        {cart.length === 0 ? (
                            <div className="text-muted-foreground text-center space-y-2 py-4">
                                <p className="text-xs">Carrinho vazio</p>
                                {!currentAttendanceId && user?.enabledModules?.customers?.view && <CustomerSelector onSelect={setSelectedCustomer} />}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cart.map((item, index) => (
                                    <div key={`${item.id}-${index}`} className="flex justify-between items-start gap-2 border-b pb-1 last:border-0">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-xs truncate leading-none">
                                                {item.name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {item.itemType === 'kit'
                                                    ? `R$${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : `R$${getCartItemPrice(item).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${item.quantity}`
                                                }
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <p className="font-semibold text-xs">
                                                R$${(getCartItemPrice(item) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                            {!currentAttendanceId && (
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFromCart(item.id, item.itemType)}>
                                                <X className="h-3 w-3 text-destructive"/>
                                            </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="flex-col !p-4 border-t shrink-0">
                     <div className="w-full space-y-1">
                         {totalDiscount > 0 && (
                             <div className="flex justify-between text-destructive text-[10px]">
                                 <p>Descontos</p>
                                 <p>-R${totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                             </div>
                         )}
                         <div className="flex justify-between text-[11px]"><p>Subtotal</p><p>R${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                         <div className="flex justify-between text-[11px] font-bold"><p>Total</p><p className="text-base text-primary">R${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                     </div>
                     <Button className="w-full mt-2 h-10 text-base" size="sm" onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0}>
                         <CreditCard className="mr-2 h-4 w-4" />
                         Finalizar [F8]
                     </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
        </div>
    )}
    
    <KitSelectionModal
        kit={selectedKit}
        products={products}
        isOpen={!!selectedKit}
        onOpenChange={(isOpen) => !isOpen && setSelectedKit(null)}
        onConfirm={(chosen) => handleKitSelection(selectedKit!, chosen)}
        allowNegative={currentBranch?.allowNegativeStock}
    />
    <WeightInputModal
        product={weightProduct}
        isOpen={isWeightModalOpen}
        onOpenChange={setIsWeightModalOpen}
        onConfirm={handleWeightConfirm}
    />
    <UnitSelectionModal
        product={unitProduct}
        isOpen={isUnitModalOpen}
        onOpenChange={setIsUnitModalOpen}
        onConfirm={handleUnitConfirm}
    />
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
    <BarcodeScannerModal
        isOpen={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleScan}
    />
    <CloseSessionDialog
        isOpen={isClosingSession}
        onOpenChange={setIsClosingSession}
        session={activeSession}
    />
    <CashAdjustmentDialog
        isOpen={isAdjustmentOpen}
        onOpenChange={setIsAdjustmentOpen}
        session={activeSession!}
    />
    <SupervisorAuthorizationDialog
        isOpen={isSupervisorAuthOpen}
        onOpenChange={setIsSupervisorAuthOpen}
        onAuthorized={handleAuthorizedAction}
        actionDescription={supervisorAuthAction?.description || ''}
        permissionRequired={supervisorAuthAction?.permission || 'canAuthorizeCartItemRemoval'}
        requesterName={user?.name || ''}
        itemName={supervisorAuthAction?.type === 'cart_removal' ? cart.find(i => i.id === supervisorAuthAction.data?.itemId)?.name : undefined}
        totalAmount={subtotal}
    />
    </>
  );
}

