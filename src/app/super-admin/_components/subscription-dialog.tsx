
'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Organization, User, Subscription, PaymentRecord, PaymentRecordStatus, PricingPlan } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Loader2, PlusCircle, Calendar as CalendarIcon, File } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Helper to safely convert a Firestore Timestamp or a JS Date to a JS Date
const toDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date instanceof Timestamp) return date.toDate();
    return undefined;
};

function EditRecordForm({record, onSave, onCancel, organizationId}: {record: PaymentRecord, onSave: (r: PaymentRecord, file: File | null) => void, onCancel: () => void, organizationId: string}) {
    const [formData, setFormData] = useState(record);
    const [boletoFile, setBoletoFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        setFormData(record);
        setBoletoFile(null);
    }, [record]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUploading(true);
        await onSave(formData, boletoFile);
        setIsUploading(false);
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Popover>
                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{formData.date ? format(toDate(formData.date)!, 'dd/MM/yyyy') : 'Escolha uma data'}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(formData.date)} onSelect={d => setFormData(p => ({...p, date: d ? Timestamp.fromDate(d) : p.date}))} /></PopoverContent>
                </Popover>
            </div>
             <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: parseFloat(e.target.value) || 0}))} />
            </div>
             <div className="space-y-2">
                <Label>Anexar Novo Boleto/Comprovante (Opcional)</Label>
                <Input type="file" onChange={e => setBoletoFile(e.target.files?.[0] || null)} accept="application/pdf,image/*"/>
                 {formData.boletoUrl && (
                     <a href={formData.boletoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 underline">Ver boleto atual</a>
                 )}
            </div>
             <DialogFooter>
                 <Button type="button" variant="ghost" onClick={onCancel} disabled={isUploading}>Cancelar</Button>
                 <Button type="submit" disabled={isUploading}>
                    {isUploading && <Loader2 className="mr-2 animate-spin"/>}
                    Salvar
                 </Button>
            </DialogFooter>
        </form>
    );
}

function RegisterPaymentDialog({
    record, isOpen, onOpenChange, onSave
}: {
    record: PaymentRecord | null,
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    onSave: (record: PaymentRecord) => void,
}) {
    const [formData, setFormData] = useState<Partial<PaymentRecord>>({});

    useEffect(() => {
        if (record) {
            setFormData({
                ...record,
                paidDate: new Date(),
                paidAmount: record.amount,
                paymentMethod: '',
                notes: '',
            });
        }
    }, [record]);


    if (!isOpen || !record) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as PaymentRecord);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Pagamento de Parcela</DialogTitle>
                     <DialogDescription>
                        Vencimento em {format(toDate(record.date)!, 'dd/MM/yyyy')} no valor de R$ {record.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Data do Pagamento</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{formData.paidDate ? format(toDate(formData.paidDate)!, 'dd/MM/yyyy') : 'Selecione'}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={toDate(formData.paidDate)} onSelect={(d) => setFormData(p => ({...p, paidDate: d}))} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Valor Pago (R$)</Label>
                            <Input type="number" value={formData.paidAmount || ''} onChange={e => setFormData(p => ({...p, paidAmount: parseFloat(e.target.value) || 0}))}/>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label>Forma de Pagamento</Label>
                        <Input value={formData.paymentMethod || ''} onChange={e => setFormData(p => ({...p, paymentMethod: e.target.value}))} placeholder="Ex: PIX, Boleto, Cartão..."/>
                     </div>
                     <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea value={formData.notes || ''} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} />
                     </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Confirmar Pagamento</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function SubscriptionDialog({ organization, isOpen, onOpenChange, adminUser }: { organization: Organization, isOpen: boolean, onOpenChange: (open: boolean) => void, adminUser: User | null }) {
    const { toast } = useToast();
    const [subDetails, setSubDetails] = useState<Partial<Subscription>>(organization.subscription || {});
    const [editingRecord, setEditingRecord] = useState<PaymentRecord | null>(null);
    const [payingRecord, setPayingRecord] = useState<PaymentRecord | null>(null);
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    
    useEffect(() => {
        const q = query(collection(db, 'pricingPlans'), where('isDeleted', '!=', true));
        const unsub = onSnapshot(q, snap => {
            setPlans(snap.docs.map(d => ({id: d.id, ...d.data()}) as PricingPlan));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        setSubDetails(organization.subscription || {});
    }, [organization.subscription]);
    
    const handlePlanChange = (planId: string) => {
        const selectedPlan = plans.find(p => p.id === planId);
        if (selectedPlan) {
            setSubDetails(prev => ({
                ...prev,
                planId: selectedPlan.id,
                planName: selectedPlan.name,
                price: selectedPlan.price,
                maxBranches: selectedPlan.maxBranches,
                maxUsers: selectedPlan.maxUsers,
            }));
        }
    };

    const handleCreateOrUpdateSubscription = async () => {
        if (!adminUser || !subDetails.planName || !subDetails.price) {
            toast({title: 'Dados incompletos', description: 'Plano e preço são obrigatórios.', variant: 'destructive'});
            return;
        };

        const startDate = toDate(subDetails.startDate);
        const endDate = toDate(subDetails.endDate);

        const paymentRecords = (subDetails.paymentRecords || []);
        if (startDate && endDate) {
             const months = eachMonthOfInterval({ start: startDate, end: endDate });
             months.forEach((monthDate) => {
                const alreadyExists = paymentRecords.some(p => {
                    const pDate = toDate(p.date);
                    return pDate && pDate.getMonth() === monthDate.getMonth() && pDate.getFullYear() === monthDate.getFullYear();
                });
                if (!alreadyExists) {
                    paymentRecords.push({
                        id: doc(collection(db, 'dummy')).id, // Temporary unique ID
                        date: Timestamp.fromDate(startOfMonth(monthDate)),
                        amount: subDetails.price || 0,
                        status: 'pending',
                    });
                }
            });
        }

        const newSubscriptionData: Subscription = {
            ...subDetails,
            planName: subDetails.planName!,
            price: subDetails.price!,
            startDate: subDetails.startDate || null,
            endDate: subDetails.endDate || null,
            maxBranches: subDetails.maxBranches || 1,
            maxUsers: subDetails.maxUsers || 1,
            paymentRecords,
        };
        try {
            await updateDoc(doc(db, 'organizations', organization.id), {
                subscription: newSubscriptionData
            });
            toast({ title: 'Assinatura salva e parcelas geradas com sucesso!' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao salvar assinatura', variant: 'destructive' });
        }
    }
    
    const handleRegisterPayment = async (updatedRecord: PaymentRecord) => {
        if (!organization.subscription || !adminUser) return;
    
        const updatedRecords = organization.subscription.paymentRecords.map(record => {
            if (record.id === updatedRecord.id) {
                return { 
                    ...updatedRecord, 
                    status: 'paid' as PaymentRecordStatus, 
                    recordedBy: adminUser.id,
                    paidDate: new Date(),
                };
            }
            return record;
        });

        try {
            await updateDoc(doc(db, 'organizations', organization.id), {
                'subscription.paymentRecords': updatedRecords
            });
            toast({ title: 'Pagamento registrado com sucesso!' });
            setPayingRecord(null);
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao registrar pagamento', variant: 'destructive' });
        }
    };

    const handleSaveRecord = async (recordToSave: PaymentRecord, boletoFile: File | null) => {
        if (!organization.subscription) return;

        let updatedRecord = { ...recordToSave };

        if (boletoFile) {
            try {
                const filePath = `organizations/${organization.id}/boletos/${recordToSave.id}-${boletoFile.name}`;
                const storageRef = ref(storage, filePath);
                const snapshot = await uploadBytes(storageRef, boletoFile);
                updatedRecord.boletoUrl = await getDownloadURL(snapshot.ref);
            } catch (error) {
                toast({ title: 'Erro ao fazer upload do boleto', variant: 'destructive' });
                return;
            }
        }
    
        let updatedRecords;
        const existingRecordIndex = organization.subscription.paymentRecords.findIndex(r => r.id === updatedRecord.id);
    
        if (existingRecordIndex > -1) {
            updatedRecords = [...organization.subscription.paymentRecords];
            updatedRecords[existingRecordIndex] = updatedRecord;
            toast({ title: 'Parcela atualizada!' });
        } else {
            updatedRecords = [...(organization.subscription.paymentRecords || []), updatedRecord];
            toast({ title: 'Nova parcela criada!' });
        }
    
        try {
            await updateDoc(doc(db, 'organizations', organization.id), { 'subscription.paymentRecords': updatedRecords });
            setEditingRecord(null);
        } catch (error) {
            toast({ title: 'Erro ao salvar parcela', variant: 'destructive' });
        }
    };
    
    const handleDeleteRecord = async (recordId: string) => {
        if (!organization.subscription) return;
        const updatedRecords = organization.subscription.paymentRecords.filter(r => r.id !== recordId);
        try {
            await updateDoc(doc(db, 'organizations', organization.id), { 'subscription.paymentRecords': updatedRecords });
            toast({ title: 'Parcela excluída!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir parcela', variant: 'destructive' });
        }
    };

    const openNewRecordForm = () => {
        setEditingRecord({
            id: doc(collection(db, 'dummy')).id,
            date: Timestamp.now(),
            amount: subDetails.price || 0,
            status: 'pending'
        });
    };
    
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Gerenciar Assinatura: {organization.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4 overflow-y-auto pr-2">
                    <div className="space-y-4 p-4 border rounded-lg bg-card">
                        <h3 className="font-semibold text-lg">Detalhes do Contrato</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="planName">Plano</Label>
                                <Select value={subDetails.planId} onValueChange={handlePlanChange}>
                                    <SelectTrigger><SelectValue placeholder="Selecione um plano..." /></SelectTrigger>
                                    <SelectContent>
                                        {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (R$ {p.price.toFixed(2)})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Data de Início</Label>
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{subDetails.startDate ? format(toDate(subDetails.startDate)!, 'dd/MM/yyyy') : 'Escolha uma data'}</Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(subDetails.startDate)} onSelect={d => setSubDetails(p => ({...p, startDate: d}))} /></PopoverContent>
                                </Popover>
                             </div>
                             <div className="space-y-2">
                                <Label>Data de Fim</Label>
                                 <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{subDetails.endDate ? format(toDate(subDetails.endDate)!, 'dd/MM/yyyy') : 'Escolha uma data'}</Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(subDetails.endDate)} onSelect={d => setSubDetails(p => ({...p, endDate: d}))} /></PopoverContent>
                                </Popover>
                             </div>
                         </div>
                         <Button onClick={handleCreateOrUpdateSubscription} className="w-full md:w-auto">Salvar Contrato e Gerar Parcelas</Button>
                    </div>

                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-lg">Histórico de Parcelas</h3>
                            <Button variant="outline" size="sm" onClick={openNewRecordForm}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Criar Parcela
                            </Button>
                        </div>
                        <div className="rounded-md border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Data Pag.</TableHead>
                                        <TableHead>Valor Pago</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subDetails.paymentRecords && subDetails.paymentRecords.length > 0 ? (
                                        subDetails.paymentRecords.sort((a,b) => toDate(a.date)!.getTime() - toDate(b.date)!.getTime()).map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell>{p.date ? format(toDate(p.date)!, 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                                <TableCell>R$ {p.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell>{p.paidDate ? format(toDate(p.paidDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                                <TableCell>{p.paidAmount ? `R$ ${p.paidAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`: '-'}</TableCell>
                                                <TableCell>
                                                     <Badge className={cn(p.status === 'paid' && 'bg-green-100 text-green-800')} variant={p.status === 'paid' ? 'secondary' : 'destructive'}>
                                                        {p.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal/></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                {p.boletoUrl && <DropdownMenuItem asChild><a href={p.boletoUrl} target="_blank" rel="noopener noreferrer"><File className="mr-2 h-4 w-4" />Ver Boleto</a></DropdownMenuItem>}
                                                                {p.status === 'pending' && <DropdownMenuItem onSelect={() => setPayingRecord(p)}>Registrar Pagamento</DropdownMenuItem>}
                                                                <DropdownMenuItem onSelect={() => setEditingRecord(p)}>Editar</DropdownMenuItem>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Excluir Parcela?</AlertDialogTitle>
                                                                <AlertDialogDescription>Deseja realmente excluir a parcela com vencimento em {p.date ? format(toDate(p.date)!, 'dd/MM/yyyy') : 'N/A'}?</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteRecord(p.id)} className={buttonVariants({ variant: "destructive" })}>Sim, Excluir</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Nenhuma parcela gerada.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                     </div>
                </div>
            </DialogContent>

            {/* Sub-diálogos movidos para fora do DialogContent principal */}
            {editingRecord && (
                <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Editar Parcela</DialogTitle></DialogHeader>
                        <EditRecordForm record={editingRecord} onSave={handleSaveRecord} onCancel={() => setEditingRecord(null)} organizationId={organization.id} />
                    </DialogContent>
                </Dialog>
            )}

            <RegisterPaymentDialog 
                record={payingRecord}
                isOpen={!!payingRecord}
                onOpenChange={(open) => !open && setPayingRecord(null)}
                onSave={handleRegisterPayment}
            />
        </Dialog>
    )
}
