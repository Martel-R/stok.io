'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import type { Expense, Supplier, ExpenseStatus, User } from '@/lib/types';
import { MoreHorizontal, PlusCircle, ArrowDownCircle, Lock, Calendar as CalendarIcon, CheckCircle2, Receipt, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const expenseCategories = [
    "Aluguel",
    "Salários",
    "Fornecedores",
    "Marketing",
    "Impostos",
    "Contas (Água, Luz, Internet)",
    "Manutenção",
    "Outros"
];

const statusConfig: Record<ExpenseStatus, { label: string, color: string, icon: any }> = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    paid: { label: 'Pago', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
    overdue: { label: 'Atrasado', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
    cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle },
};

function ExpenseForm({ expense, suppliers, users, onSave, onDone }: { expense?: Expense; suppliers: Supplier[]; users: User[]; onSave: (data: Partial<Expense>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<Expense>>(
        expense || {
            description: '',
            amount: 0,
            category: expenseCategories[0],
            dueDate: new Date(),
            notes: '',
            supplierId: undefined,
            linkedUserId: undefined,
            status: 'pending'
        }
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value,
        }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value === 'none' ? undefined : value }));
    };
    
    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData(prev => ({ ...prev, dueDate: date }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplier = suppliers.find(s => s.id === formData.supplierId);
        const linkedUser = users.find(u => u.id === formData.linkedUserId);
        onSave({ 
            ...formData, 
            supplierName: supplier?.name || '',
            linkedUserName: linkedUser?.name || ''
        });
        onDone();
    };

    const displayDueDate = formData.dueDate instanceof Timestamp ? formData.dueDate.toDate() : formData.dueDate;

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
            <div className="space-y-2">
                <Label htmlFor="description">Descrição do Lançamento</Label>
                <Input id="description" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Ex: Aluguel Fevereiro" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Valor Previsto (R$)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" value={formData.amount || ''} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dueDate">Data de Vencimento</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {displayDueDate ? format(displayDueDate, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={displayDueDate} onSelect={handleDateChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={formData.category} onValueChange={(value) => handleSelectChange('category', value)}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {expenseCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    {formData.category === 'Salários' ? (
                        <>
                            <Label htmlFor="linkedUserId">Funcionário / Profissional</Label>
                            <Select value={formData.linkedUserId || 'none'} onValueChange={(value) => handleSelectChange('linkedUserId', value)}>
                                <SelectTrigger><SelectValue placeholder="Selecione o beneficiário"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {users.filter(u => !u.isDeleted).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </>
                    ) : (
                        <>
                            <Label htmlFor="supplierId">Fornecedor (Opcional)</Label>
                            <Select value={formData.supplierId || 'none'} onValueChange={(value) => handleSelectChange('supplierId', value)}>
                                <SelectTrigger><SelectValue placeholder="Nenhum"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </>
                    )}
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Observações Iniciais</Label>
                <Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleInputChange} placeholder="Detalhes sobre a despesa..." />
            </div>
            <DialogFooter>
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Lançar Despesa</Button>
            </DialogFooter>
        </form>
    );
}

function PaymentRegistrationForm({ expense, onSave, onDone }: { expense: Expense; onSave: (data: Partial<Expense>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<Expense>>({
        paymentDate: new Date(),
        paidAmount: expense.amount,
        receiptUrl: '',
        notes: expense.notes || '',
        status: 'paid'
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value,
        }));
    };

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData(prev => ({ ...prev, paymentDate: date }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onDone();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1 mb-4">
                <p><strong>Despesa:</strong> {expense.description}</p>
                {expense.linkedUserName && <p><strong>Beneficiário:</strong> {expense.linkedUserName}</p>}
                <p><strong>Valor Lançado:</strong> R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>Vencimento:</strong> {format(expense.dueDate instanceof Timestamp ? expense.dueDate.toDate() : expense.dueDate, 'dd/MM/yyyy')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="paidAmount">Valor Pago (R$)</Label>
                    <Input id="paidAmount" name="paidAmount" type="number" step="0.01" value={formData.paidAmount || ''} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="paymentDate">Data de Pagamento</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.paymentDate ? format(formData.paymentDate as Date, 'dd/MM/yyyy') : <span>Escolha uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={formData.paymentDate as Date} onSelect={handleDateChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="receiptUrl">Link do Comprovante (URL)</Label>
                <Input id="receiptUrl" name="receiptUrl" value={formData.receiptUrl || ''} onChange={handleInputChange} placeholder="https://..." />
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Observações do Pagamento</Label>
                <Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleInputChange} placeholder="Detalhes adicionais sobre o pagamento..." />
            </div>

            <DialogFooter>
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">Confirmar Pagamento</Button>
            </DialogFooter>
        </form>
    );
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [payingExpense, setPayingExpense] = useState<Expense | undefined>(undefined);
    
    const { toast } = useToast();
    const { user, currentBranch } = useAuth();
    
    const can = useMemo(() => ({
        view: user?.enabledModules?.expenses?.view ?? false,
        edit: user?.enabledModules?.expenses?.edit ?? false,
        delete: user?.enabledModules?.expenses?.delete ?? false,
    }), [user]);

    const toDate = (val: any) => {
        if (!val) return undefined;
        if (val instanceof Timestamp) return val.toDate();
        if (val instanceof Date) return val;
        if (typeof val === 'object' && val.seconds) return new Date(val.seconds * 1000);
        return undefined;
    };

    useEffect(() => {
        if (!user?.organizationId || !currentBranch) {
            setLoading(false);
            return;
        }

        const expensesQuery = query(collection(db, 'expenses'), where("branchId", "==", currentBranch.id), where('isDeleted', '!=', true));
        const expensesUnsub = onSnapshot(expensesQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const expenseData = doc.data();
                const dueDate = toDate(expenseData.dueDate) || new Date();
                let status = expenseData.status as ExpenseStatus || 'pending';
                
                // Auto-update overdue status if not paid
                if (status === 'pending' && isBefore(startOfDay(dueDate), startOfDay(new Date()))) {
                    status = 'overdue';
                }

                return { 
                    id: doc.id, 
                    ...expenseData,
                    date: toDate(expenseData.date) || new Date(),
                    dueDate,
                    paymentDate: toDate(expenseData.paymentDate),
                    status
                } as Expense;
            });
            setExpenses(data.sort((a, b) => (b.dueDate as Date).getTime() - (a.dueDate as Date).getTime()));
            setLoading(false);
        });

        const suppliersQuery = query(collection(db, 'suppliers'), where("organizationId", "==", user.organizationId), where('isDeleted', '!=', true));
        const suppliersUnsub = onSnapshot(suppliersQuery, snapshot => {
            setSuppliers(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Supplier)))
        });

        const usersQuery = query(collection(db, 'users'), where("organizationId", "==", user.organizationId), where('isDeleted', '!=', true));
        const usersUnsub = onSnapshot(usersQuery, snapshot => {
            setUsers(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as User)))
        });

        return () => {
            expensesUnsub();
            suppliersUnsub();
            usersUnsub();
        };
    }, [user, currentBranch]);

    const handleSave = async (data: Partial<Expense>) => {
        if (!user?.organizationId || !currentBranch) return;
        
        try {
            if (editingExpense?.id) {
                await updateDoc(doc(db, "expenses", editingExpense.id), data);
                toast({ title: 'Lançamento atualizado!' });
            } else {
                await addDoc(collection(db, "expenses"), { 
                    ...data, 
                    date: new Date(), // Lançamento hoje
                    organizationId: user.organizationId,
                    branchId: currentBranch.id,
                    userId: user.id,
                    userName: user.name,
                    isDeleted: false,
                });
                toast({ title: 'Despesa lançada com sucesso!' });
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving expense: ", error);
            toast({ title: 'Erro ao salvar lançamento', variant: 'destructive' });
        }
    };

    const handleRegisterPayment = async (data: Partial<Expense>) => {
        if (!payingExpense?.id) return;
        try {
            await updateDoc(doc(db, "expenses", payingExpense.id), data);
            toast({ title: 'Pagamento registrado com sucesso!', className: 'bg-green-600 text-white' });
            setIsPaymentDialogOpen(false);
        } catch (error) {
            toast({ title: 'Erro ao registrar pagamento', variant: 'destructive' });
        }
    };

    const handleCancel = async (id: string) => {
        try {
            await updateDoc(doc(db, "expenses", id), { status: 'cancelled' });
            toast({ title: 'Lançamento cancelado' });
        } catch (error) {
            toast({ title: 'Erro ao cancelar', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await updateDoc(doc(db, "expenses", id), { isDeleted: true });
            toast({ title: 'Lançamento excluído!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir', variant: 'destructive' });
        }
    };
    
    const openEditDialog = (expense: Expense) => {
        setEditingExpense(expense);
        setIsFormOpen(true);
    };

    const openPaymentDialog = (expense: Expense) => {
        setPayingExpense(expense);
        setIsPaymentDialogOpen(true);
    };

    if (!can.view) {
        return (
            <div className="flex h-full items-center justify-center">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2"><Lock /> Acesso Negado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Você não tem permissão para acessar o módulo de Despesas.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <ArrowDownCircle className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">Gestão de Despesas</h1>
                        <p className="text-muted-foreground">
                            Controle de lançamentos, vencimentos e pagamentos.
                        </p>
                    </div>
                </div>
                {can.edit && (
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setEditingExpense(undefined)}><PlusCircle className="mr-2 h-4 w-4" />Lançar Despesa</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingExpense ? 'Editar Lançamento' : 'Novo Lançamento de Despesa'}</DialogTitle>
                            </DialogHeader>
                            <ExpenseForm
                                expense={editingExpense}
                                suppliers={suppliers}
                                users={users}
                                onSave={handleSave}
                                onDone={() => setIsFormOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : expenses.length > 0 ? (
                            expenses.map((expense) => {
                                const config = statusConfig[expense.status];
                                const StatusIcon = config.icon;
                                
                                return (
                                    <TableRow key={expense.id} className={cn(expense.status === 'cancelled' && 'opacity-50')}>
                                        <TableCell className="font-medium">
                                            {format(expense.dueDate as Date, 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("gap-1 font-semibold", config.color)}>
                                                <StatusIcon className="h-3 w-3" />
                                                {config.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{expense.description}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {expense.category === 'Salários' ? (
                                                        expense.linkedUserName ? `Ref: ${expense.linkedUserName}` : 'Sem beneficiário'
                                                    ) : (
                                                        expense.supplierName || 'Sem fornecedor'
                                                    )}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{expense.category}</TableCell>
                                        <TableCell className="text-right font-semibold text-destructive">
                                            R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell>
                                            {expense.status === 'paid' ? (
                                                <div className="flex flex-col text-xs">
                                                    <span className="text-green-600 font-medium">{format(expense.paymentDate as Date, 'dd/MM/yyyy')}</span>
                                                    <span className="text-muted-foreground">Pago: R$ {expense.paidAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {expense.status !== 'paid' && expense.status !== 'cancelled' && (
                                                        <DropdownMenuItem onClick={() => openPaymentDialog(expense)} className="text-green-600 font-semibold focus:text-green-700">
                                                            <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar Pagamento
                                                        </DropdownMenuItem>
                                                    )}
                                                    {expense.receiptUrl && (
                                                        <DropdownMenuItem onClick={() => window.open(expense.receiptUrl, '_blank')}>
                                                            <Receipt className="mr-2 h-4 w-4" /> Ver Comprovante
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => openEditDialog(expense)}>Editar Lançamento</DropdownMenuItem>
                                                    {expense.status !== 'cancelled' && (
                                                        <DropdownMenuItem onClick={() => handleCancel(expense.id)} className="text-amber-600">Cancelar Despesa</DropdownMenuItem>
                                                    )}
                                                    {can.delete && (
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(expense.id)}>
                                                            Excluir Permanente
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Nenhuma despesa encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Payment Registration Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Pagamento</DialogTitle>
                    </DialogHeader>
                    {payingExpense && (
                        <PaymentRegistrationForm
                            expense={payingExpense}
                            onSave={handleRegisterPayment}
                            onDone={() => setIsPaymentDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}