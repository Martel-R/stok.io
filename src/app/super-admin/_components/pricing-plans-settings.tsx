
'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, addDoc } from 'firebase/firestore';
import type { PricingPlan } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

function PlanForm({ plan, onSave, onDone }: { plan?: PricingPlan, onSave: (data: Partial<PricingPlan>) => void, onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<PricingPlan>>(plan || { name: '', price: 0, description: '', features: [], maxBranches: 1, maxUsers: 1, isFeatured: false, isDeleted: false });
    const [featureInput, setFeatureInput] = useState('');

    const handleFeatureAdd = () => {
        if(featureInput.trim()) {
            setFormData(prev => ({...prev, features: [...(prev.features || []), featureInput.trim()]}));
            setFeatureInput('');
        }
    }

    const handleFeatureRemove = (index: number) => {
        setFormData(prev => ({...prev, features: prev.features?.filter((_, i) => i !== index)}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Nome do Plano</Label>
                    <Input name="name" value={formData.name || ''} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="Ex: Premium" required />
                </div>
                <div className="space-y-2">
                    <Label>Preço Mensal</Label>
                    <Input name="price" type="number" step="0.01" value={formData.price || ''} onChange={e => setFormData(p => ({...p, price: parseFloat(e.target.value) || 0}))} placeholder="99.90" required />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea name="description" value={formData.description || ''} onChange={e => setFormData(p => ({...p, description: e.target.value}))} placeholder="O que este plano oferece?" required />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Máx. Filiais</Label>
                    <Input name="maxBranches" type="number" value={formData.maxBranches || ''} onChange={e => setFormData(p => ({...p, maxBranches: parseInt(e.target.value, 10) || 1}))} required />
                </div>
                <div className="space-y-2">
                    <Label>Máx. Usuários</Label>
                    <Input name="maxUsers" type="number" value={formData.maxUsers || ''} onChange={e => setFormData(p => ({...p, maxUsers: parseInt(e.target.value, 10) || 1}))} required />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Funcionalidades</Label>
                <div className="flex gap-2">
                    <Input value={featureInput} onChange={e => setFeatureInput(e.target.value)} placeholder="Adicionar funcionalidade"/>
                    <Button type="button" onClick={handleFeatureAdd}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                    {formData.features?.map((feat, i) => (
                        <Badge key={i} variant="secondary" className="pl-2 pr-1 py-1">
                            {feat}
                            <Button type="button" size="icon" variant="ghost" className="h-4 w-4 ml-1 hover:text-destructive" onClick={() => handleFeatureRemove(i)}>
                                <Trash2 className="h-3 w-3"/>
                            </Button>
                        </Badge>
                    ))}
                </div>
            </div>
             <div className="flex items-center space-x-2">
                <Switch id="isFeatured" checked={formData.isFeatured} onCheckedChange={c => setFormData(p => ({...p, isFeatured: c}))} />
                <Label htmlFor="isFeatured">Plano em Destaque</Label>
            </div>
             <div className="flex items-center space-x-2">
                <Switch id="isActive" checked={!formData.isDeleted} onCheckedChange={c => setFormData(p => ({...p, isDeleted: !c}))} />
                <Label htmlFor="isActive">Plano Ativo</Label>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Plano</Button>
            </DialogFooter>
        </form>
    );
}

export function PricingPlansSettings() {
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<PricingPlan | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        const q = query(collection(db, 'pricingPlans'));
        const unsub = onSnapshot(q, snap => {
            setPlans(snap.docs.map(d => ({id: d.id, ...d.data()}) as PricingPlan).sort((a,b) => a.price - b.price));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async (data: Partial<PricingPlan>) => {
        try {
            if(editingPlan?.id) {
                await updateDoc(doc(db, 'pricingPlans', editingPlan.id), data);
                toast({title: 'Plano atualizado!'});
            } else {
                await addDoc(collection(db, 'pricingPlans'), {...data, isDeleted: data.isDeleted === undefined ? false : data.isDeleted });
                toast({title: 'Plano criado!'});
            }
            setIsFormOpen(false);
        } catch(error) {
            toast({title: 'Erro ao salvar o plano', variant: 'destructive'});
        }
    }
    
    const togglePlanStatus = async (plan: PricingPlan) => {
        await updateDoc(doc(db, 'pricingPlans', plan.id), { isDeleted: !plan.isDeleted });
        toast({title: `Plano ${!plan.isDeleted ? 'desativado' : 'ativado'} com sucesso.`});
    }

    return (
        <Card>
            <CardHeader>
                 <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Planos de Preços</CardTitle>
                        <CardDescription>Gerencie os planos de assinatura que serão exibidos publicamente.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingPlan(undefined); setIsFormOpen(true)}}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Adicionar Plano
                    </Button>
                 </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Limites</TableHead>
                            <TableHead>Destaque</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-5 w-full"/></TableCell></TableRow> :
                        plans.map(plan => (
                            <TableRow key={plan.id}>
                                <TableCell className="font-semibold">{plan.name}</TableCell>
                                <TableCell>R$ {plan.price.toLocaleString('pt-br', {minimumFractionDigits: 2})}</TableCell>
                                <TableCell>
                                    <div className='text-sm text-muted-foreground'>
                                        <p>{plan.maxBranches} Filiais</p>
                                        <p>{plan.maxUsers} Usuários</p>
                                    </div>
                                </TableCell>
                                <TableCell>{plan.isFeatured ? <Badge variant="default" className="bg-amber-500">Sim</Badge> : 'Não'}</TableCell>
                                <TableCell>
                                    <Badge variant={!plan.isDeleted ? "secondary" : "outline"} className={cn(!plan.isDeleted && 'bg-green-100 text-green-800')}>
                                        {!plan.isDeleted ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Switch checked={!plan.isDeleted} onCheckedChange={() => togglePlanStatus(plan)} aria-label="Ativar/Desativar Plano" />
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingPlan(plan); setIsFormOpen(true);}}>
                                            <Pencil className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle></DialogHeader>
                    <PlanForm plan={editingPlan} onSave={handleSave} onDone={() => setIsFormOpen(false)} />
                </DialogContent>
            </Dialog>
        </Card>
    );
}
