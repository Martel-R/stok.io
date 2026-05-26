
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { Printer, X, CreditCard, Banknote, User, Calendar, Receipt, Package, Gift, Component, Info, ShieldCheck } from 'lucide-react';
import type { Sale } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SaleDetailsDialogProps {
    sale: Sale | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    organizationName?: string;
    branchName?: string;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export function SaleDetailsDialog({ sale, isOpen, onOpenChange, organizationName, branchName }: SaleDetailsDialogProps) {
    if (!sale) return null;

    const displayDiscount = (sale.discount && sale.discount > 0) ? sale.discount : sale.items.reduce((acc, item: any) => {
        if (item.type === 'combo') {
            return acc + Math.max(0, ((item.originalPrice || 0) - (item.finalPrice || 0)) * (item.quantity || 1));
        }
        if (item.type === 'kit' && item.chosenProducts) {
            const originalTotal = item.chosenProducts.reduce((sum: number, p: any) => sum + (p.price || 0), 0) * (item.quantity || 1);
            const kitTotal = item.total || ((item.price || 0) * (item.quantity || 1));
            return acc + Math.max(0, originalTotal - kitTotal);
        }
        return acc;
    }, 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-muted print:block print:max-w-none print:max-h-none print:p-0 print:border-none print:shadow-none">
                
                {/* --- ÁREA DE IMPRESSÃO (Otimizada para Térmica 80mm) --- */}
                <div className="hidden print:block thermal-receipt-print text-black font-mono">
                    <div className="text-center space-y-1 border-b border-black pb-2 mb-4 uppercase">
                        <h2 className="text-md font-bold">{organizationName || 'STOK.IO'}</h2>
                        {branchName && <p className="text-[10px]">{branchName}</p>}
                        <p className="text-[10px] pt-1">COMPROVANTE DE VENDA</p>
                    </div>

                    <div className="text-[9px] space-y-0.5 border-b border-black pb-2 mb-2 uppercase font-bold">
                        <div className="flex justify-between"><span>DATA:</span><span>{format(sale.date, "dd/MM/yy HH:mm")}</span></div>
                        <div className="flex justify-between"><span>VENDEDOR:</span><span className="truncate ml-2">{sale.cashier}</span></div>
                        <div className="flex justify-between border-t border-black/10 mt-1 pt-1"><span>CLIENTE:</span><span className="truncate ml-2">{sale.customerName ? sale.customerName.toUpperCase() : 'CONSUMIDOR'}</span></div>
                    </div>

                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between border-b border-black font-bold pb-0.5 uppercase">
                            <span>ITEM</span>
                            <div className="flex gap-4 w-24 justify-end">
                                <span>QTD</span>
                                <span className="w-12 text-right">TOTAL</span>
                            </div>
                        </div>
                        {sale.items.map((item: any, idx: number) => {
                            const itemTotal = item.type === 'combo' ? (item.finalPrice * item.quantity) : (item.total || item.finalPrice);
                            return (
                                <div key={idx} className="space-y-0.5 border-b border-black/5 pb-1">
                                    <div className="flex justify-between font-bold">
                                        <span className="truncate max-w-[150px] uppercase">{item.name}</span>
                                        <div className="flex gap-4 w-24 justify-end">
                                            <span>{item.quantity}</span>
                                            <span className="w-12 text-right">{formatCurrency(itemTotal).replace('R$', '')}</span>
                                        </div>
                                    </div>
                                    {( (item.type === 'kit' && item.chosenProducts) || (item.type === 'combo' && item.products) ) && (
                                        <div className="text-[8px] pl-2 border-l border-black ml-1 mt-0.5 space-y-0.5 pb-1 uppercase opacity-80">
                                            {item.type === 'kit' 
                                                ? item.chosenProducts.map((p:any) => p.name).join(', ') 
                                                : item.products.map((p:any) => p.productName).join(', ')}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="text-[9px] space-y-0.5 border-t border-black pt-2 mb-2 font-bold uppercase text-black">
                        <div className="flex justify-between font-normal opacity-70"><span>SUBTOTAL BRUTO:</span><span>{formatCurrency(sale.total + displayDiscount).replace('R$', '')}</span></div>
                        <div className="flex justify-between"><span>TOTAL DESCONTOS:</span><span>-{formatCurrency(displayDiscount).replace('R$', '')}</span></div>
                        <div className="flex justify-between text-[11px] font-black border-t border-black pt-1.5 mt-1.5 uppercase">
                            <span>TOTAL A PAGAR:</span>
                            <span>{formatCurrency(sale.total)}</span>
                        </div>
                    </div>

                    <div className="text-[9px] space-y-0.5 pt-1 border-t border-black mb-4 uppercase">
                        <div className="font-bold mb-1 mt-1 underline">Forma de Pagamento:</div>
                        {sale.payments.map((p, pIdx) => (
                            <div key={pIdx} className="flex justify-between border-b border-black/5 pb-0.5 last:border-0">
                                <span>{p.conditionName} {p.installments > 1 ? `(${p.installments}X)` : ''}</span>
                                <span>{formatCurrency(p.amount).replace('R$', '')}</span>
                            </div>
                        ))}
                    </div>

                    <div className="text-[9px] text-center font-bold border-t border-black pt-4 uppercase pb-10">
                        OBRIGADO PELA PREFERENCIA!<br/>www.stok.io
                    </div>
                </div>

                {/* --- CONTEUDO DE TELA (no-print) --- */}
                <div className="no-print flex flex-col h-full overflow-hidden bg-background">
                    <DialogHeader className="p-6 pb-4 border-b bg-muted/10">
                        <div className="flex justify-between items-center text-black">
                            <DialogTitle className="text-xl font-black flex items-center gap-2 tracking-tighter">
                                <Receipt className="h-5 w-5 text-primary" />
                                DETALHES DA VENDA
                            </DialogTitle>
                            <Badge variant={sale.status === 'cancelled' ? 'destructive' : 'secondary'} className="font-bold uppercase text-[10px]">
                                {sale.status === 'cancelled' ? 'Cancelada' : 'Finalizada'}
                            </Badge>
                        </div>
                        <DialogDescription className="flex gap-4 mt-1 font-bold text-muted-foreground uppercase text-[10px]">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(sale.date, "dd/MM/yyyy HH:mm")}</span>
                            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {sale.cashier}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                        {/* Resumo de Valores */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-muted/20 rounded-xl border border-muted/60 text-center shadow-sm">
                                <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest mb-1">Total Bruto</p>
                                <p className="text-md font-bold text-black">{formatCurrency(sale.total + displayDiscount)}</p>
                            </div>
                            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center shadow-sm">
                                <p className="text-[9px] uppercase font-black text-red-600 tracking-widest mb-1">Descontos</p>
                                <p className="text-md font-bold text-red-700">-{formatCurrency(displayDiscount)}</p>
                            </div>
                            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-center shadow-sm">
                                <p className="text-[9px] uppercase font-black text-primary tracking-widest mb-1">Total Líquido</p>
                                <p className="text-lg font-black text-primary tracking-tight">{formatCurrency(sale.total)}</p>
                            </div>
                        </div>

                        {/* Itens com composição rica */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Package className="h-4 w-4" /> Itens da Venda
                            </h3>
                            <div className="border rounded-xl overflow-hidden shadow-sm bg-background">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="h-9 text-[10px] font-black uppercase text-black">Descrição do Item</TableHead>
                                            <TableHead className="h-9 text-center text-[10px] font-black uppercase text-black w-16">Qtd</TableHead>
                                            <TableHead className="h-9 text-right text-[10px] font-black uppercase text-black">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sale.items.map((item: any, idx: number) => (
                                            <React.Fragment key={idx}>
                                                <TableRow className="group transition-colors border-b-0 hover:bg-muted/5">
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{item.name}</span>
                                                            <span className="text-[8px] text-muted-foreground font-black uppercase">{item.type || 'Produto'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-center">
                                                        <span className="font-mono text-xs font-bold bg-muted px-1.5 py-0.5 rounded">{item.quantity}</span>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-right text-xs font-black text-black">
                                                        {formatCurrency(item.total || (item.finalPrice * item.quantity))}
                                                    </TableCell>
                                                </TableRow>
                                                
                                                {/* Detalhamento de Componentes Rico na Tela */}
                                                {( (item.type === 'kit' && item.chosenProducts) || (item.type === 'combo' && item.products) ) && (
                                                    <TableRow className="border-t-0 hover:bg-transparent">
                                                        <TableCell colSpan={3} className="pt-0 pb-4 px-8">
                                                            <div className="bg-muted/40 rounded-xl p-3 border border-muted/60 flex flex-col gap-2 shadow-inner">
                                                                <div className="flex justify-between items-center border-b border-muted/60 pb-1.5 mb-1 text-black">
                                                                    <div className="text-[9px] uppercase font-black text-muted-foreground/80 tracking-widest flex items-center gap-1.5">
                                                                        <Info className="h-3 w-3" /> Composição
                                                                    </div>
                                                                    <div className="flex gap-2 text-[9px] font-black uppercase tracking-tighter text-black">
                                                                        {item.type === 'kit' ? (
                                                                            <>
                                                                                <span className="text-muted-foreground font-bold">Original: {formatCurrency(item.chosenProducts.reduce((sum: number, p: any) => sum + (p.price || 0), 0) * item.quantity)}</span>
                                                                                <span className="text-red-700 font-bold">Desc: -{formatCurrency((item.chosenProducts.reduce((sum: number, p: any) => sum + (p.price || 0), 0) * item.quantity) - item.total)}</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-muted-foreground font-bold">Original: {formatCurrency(item.originalPrice * item.quantity)}</span>
                                                                                <span className="text-red-700 font-bold">Desc: -{formatCurrency((item.originalPrice - item.finalPrice) * item.quantity)}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {item.type === 'kit' && item.chosenProducts.map((p: any, pIdx: number) => (
                                                                        <div key={pIdx} className="flex justify-between items-center text-[10px] leading-tight pl-2 border-l-2 border-primary/30 font-bold uppercase text-black">
                                                                            <span>{p.name}</span>
                                                                            <span className="font-mono text-[9px] opacity-60">{formatCurrency(p.price)}</span>
                                                                        </div>
                                                                    ))}
                                                                    {item.type === 'combo' && item.products.map((p: any, pIdx: number) => (
                                                                        <div key={pIdx} className="flex justify-between items-center text-[10px] leading-tight pl-2 border-l-2 border-orange-400/40 font-bold uppercase text-black">
                                                                            <div className="flex gap-2 items-center">
                                                                                <span className="font-mono bg-muted px-1 rounded text-[9px] font-bold">{p.quantity}x</span>
                                                                                <span>{p.productName}</span>
                                                                            </div>
                                                                            <span className="font-mono text-[9px] opacity-60">{formatCurrency(p.productPrice)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Pagamento com Cards */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <CreditCard className="h-4 w-4" /> Fluxo Financeiro
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {sale.payments.map((p, pIdx) => (
                                    <Card key={pIdx} className="shadow-none border-muted/80 hover:border-primary/40 transition-all bg-background group">
                                        <CardContent className="p-4 space-y-1.5">
                                            <span className="text-[9px] uppercase font-black text-muted-foreground truncate block tracking-widest">{p.conditionName}</span>
                                            <div className="flex justify-between items-end">
                                                <span className="text-lg font-black block text-primary tracking-tighter group-hover:scale-105 transition-transform">{formatCurrency(p.amount)}</span>
                                                {p.installments > 1 && (
                                                    <Badge variant="secondary" className="text-[9px] font-black uppercase shadow-none bg-muted/50">{p.installments}x Parc.</Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {sale.notes && (
                            <div className="bg-muted/10 p-4 rounded-xl border border-dashed border-muted-foreground/30">
                                <span className="text-[9px] uppercase font-black text-muted-foreground mb-1 block tracking-widest">Notas do Vendedor</span>
                                <p className="text-xs italic text-foreground/70">{sale.notes}</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t bg-muted/20 no-print">
                        <div className="flex w-full justify-between items-center px-2">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase italic flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" /> Registro imutável
                            </p>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="font-bold text-xs uppercase" onClick={() => onOpenChange(false)}>Sair</Button>
                                <Button size="sm" className="font-black gap-2 uppercase text-xs shadow-lg hover:scale-[1.02] transition-transform" onClick={handlePrint}>
                                    <Printer className="h-4 w-4" /> Imprimir Recibo
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>

            <style jsx global>{`
                @media print {
                    @page { 
                        size: 80mm auto; 
                        margin: 0; 
                    }
                    
                    /* Nuclear Hide */
                    body * {
                        visibility: hidden !important;
                    }

                    /* Forcing the Portal and Dialog content only */
                    [data-radix-portal], 
                    [data-radix-portal] *,
                    [role="dialog"],
                    [role="dialog"] * {
                        visibility: visible !important;
                        overflow: visible !important;
                        height: auto !important;
                        max-height: none !important;
                    }

                    /* Posiciona o recibo no topo absoluto da fita */
                    .thermal-receipt-print { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 72mm !important; 
                        padding: 10px !important;
                        margin: 0 !important;
                        display: block !important;
                        background: white !important;
                        color: black !important;
                        z-index: 9999999 !important;
                        border: none !important;
                    }

                    /* Remove ABSOLUTAMENTE tudo o que é de tela dentro da modal */
                    .no-print, 
                    [role="dialog"] > button,
                    [role="dialog"] [class*="DialogHeader"],
                    [role="dialog"] [class*="DialogFooter"],
                    [role="dialog"] [class*="p-6"] { 
                        display: none !important; 
                        visibility: hidden !important;
                    }

                    /* Flatten dialog background */
                    [role="dialog"] {
                        background: white !important;
                        box-shadow: none !important;
                        border: none !important;
                        transform: none !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                    }

                    /* Remove overlays pretos */
                    [data-radix-overlay] {
                        display: none !important;
                    }
                }
            `}</style>
        </Dialog>
    );
}
