

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Expense, Supplier } from '@/lib/types';
import { MoreHorizontal, PlusCircle, ArrowDownCircle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function ExpenseForm({ expense, suppliers, onSave, onDone }: { expense?: Expense; suppliers: Supplier[]; onSave: (data: Partial<Expense>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<Expense>>(
        expense || {
            description: '',
            amount: 0,
            category: expenseCategories[0],
            date: new Date(),
            notes: '',
            supplierId: undefined
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
            setFormData(prev => ({ ...prev, date }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplier = suppliers.find(s => s.id === formData.supplierId);
        onSave({ ...formData, supplierName: supplier?.name || '' });
        onDone();
    };

    const displayDate = formData.date instanceof Timestamp ? formData.date.toDate() : formData.date;

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
            <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" name="description" value={formData.description || ''} onChange={handleInputChange} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Valor (R$)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" value={formData.amount || ''} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {displayDate ? format(displayDate, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={displayDate} onSelect={handleDateChange} initialFocus />
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
                    <Label htmlFor="supplierId">Fornecedor (Opcional)</Label>
                    <Select value={formData.supplierId || 'none'} onValueChange={(value) => handleSelectChange('supplierId', value)}>
                        <SelectTrigger><SelectValue placeholder="Nenhum"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleInputChange} />
            </div>
            <DialogFooter>
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Despesa</Button>
            </DialogFooter>
        </form>
    );
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const { toast } = useToast();
    const { user, currentBranch } = useAuth();
    
    const can = useMemo(() => ({
        view: user?.enabledModules?.expenses?.view ?? false,
        edit: user?.enabledModules?.expenses?.edit ?? false,
        delete: user?.enabledModules?.expenses?.delete ?? false,
    }), [user]);

    useEffect(() => {
        if (!user?.organizationId || !currentBranch) {
            setLoading(false);
            return;
        }

        const expensesQuery = query(collection(db, 'expenses'), where("branchId", "==", currentBranch.id));
        const expensesUnsub = onSnapshot(expensesQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const expenseData = doc.data();
                return { 
                    id: doc.id, 
                    ...expenseData,
                    date: expenseData.date instanceof Timestamp ? expenseData.date.toDate() : new Date()
                } as Expense;
            });
            setExpenses(data.sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime()));
            setLoading(false);
        });

        const suppliersQuery = query(collection(db, 'suppliers'), where("organizationId", "==", user.organizationId));
        const suppliersUnsub = onSnapshot(suppliersQuery, snapshot => {
            setSuppliers(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Supplier)))
        });

        return () => {
            expensesUnsub();
            suppliersUnsub();
        };
    }, [user, currentBranch]);

    const handleSave = async (data: Partial<Expense>) => {
        if (!user?.organizationId || !currentBranch) return;
        
        try {
            if (editingExpense?.id) {
                await updateDoc(doc(db, "expenses", editingExpense.id), data);
                toast({ title: 'Despesa atualizada com sucesso!' });
            } else {
                await addDoc(collection(db, "expenses"), { 
                    ...data, 
                    organizationId: user.organizationId,
                    branchId: currentBranch.id,
                    userId: user.id,
                    userName: user.name,
                });
                toast({ title: 'Despesa adicionada com sucesso!' });
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving expense: ", error);
            toast({ title: 'Erro ao salvar despesa', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, "expenses", id));
            toast({ title: 'Despesa excluída com sucesso!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir despesa', variant: 'destructive' });
        }
    };
    
    const openEditDialog = (expense: Expense) => {
        setEditingExpense(expense);
        setIsFormOpen(true);
    };

    const openNewDialog = () => {
        setEditingExpense(undefined);
        setIsFormOpen(true);
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
                        <h1 className="text-3xl font-bold">Despesas</h1>
                        <p className="text-muted-foreground">
                            Gerencie os custos e despesas da sua filial.
                        </p>
                    </div>
                </div>
                {can.edit && (
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" />Adicionar Despesa</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingExpense ? 'Editar Despesa' : 'Adicionar Nova Despesa'}</DialogTitle>
                            </DialogHeader>
                            <ExpenseForm
                                expense={editingExpense}
                                suppliers={suppliers}
                                onSave={handleSave}
                                onDone={() => setIsFormOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : expenses.length > 0 ? (
                        expenses.map((expense) => (
                            <TableRow key={expense.id}>
                                <TableCell>{format(expense.date as Date, 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="font-medium">{expense.description}</TableCell>
                                <TableCell>{expense.category}</TableCell>
                                <TableCell>{expense.supplierName || 'N/A'}</TableCell>
                                <TableCell className="text-right">R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!can.edit && !can.delete}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {can.edit && <DropdownMenuItem onClick={() => openEditDialog(expense)}>Editar</DropdownMenuItem>}
                                            {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(expense.id)}>Excluir</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                Nenhuma despesa encontrada.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
