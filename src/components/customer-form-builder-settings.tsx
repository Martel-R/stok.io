'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import type { CustomerFormTemplate, CustomerFormField, CustomerFormFieldType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Loader2, Trash2, GripVertical, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const fieldTypeNames: Record<CustomerFormFieldType, string> = {
    text: 'Texto Curto',
    textarea: 'Texto Longo',
    number: 'Número',
    date: 'Data',
    checkbox: 'Caixa de Seleção',
    select: 'Menu de Opções',
    radio: 'Múltipla Escolha (única)',
};

function CustomerFieldFormDialog({ 
    field, 
    isOpen, 
    onOpenChange, 
    onSave 
}: { 
    field?: CustomerFormField, 
    isOpen: boolean, 
    onOpenChange: (isOpen: boolean) => void, 
    onSave: (field: CustomerFormField) => void 
}) {
    const [formData, setFormData] = useState<CustomerFormField>(
        field || { id: `field_${Date.now()}`, label: '', type: 'text', required: false, order: 0 }
    );

    useEffect(() => {
        setFormData(field || { id: `field_${Date.now()}`, label: '', type: 'text', required: false, order: 0 });
    }, [field, isOpen]);

    const handleSave = () => {
        if (!formData.label) {
            alert("O nome do campo é obrigatório.");
            return;
        }
        onSave(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{field ? 'Editar Campo' : 'Adicionar Novo Campo'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="field-label">Nome do Campo</Label>
                        <Input id="field-label" value={formData.label} onChange={(e) => setFormData(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Profissão" />
                    </div>
                    <div>
                        <Label htmlFor="field-type">Tipo do Campo</Label>
                        <Select value={formData.type} onValueChange={(v: CustomerFormFieldType) => setFormData(f => ({ ...f, type: v }))}>
                            <SelectTrigger id="field-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(fieldTypeNames).map(([key, name]) => (
                                    <SelectItem key={key} value={key}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {(formData.type === 'select' || formData.type === 'radio') && (
                        <div>
                            <Label htmlFor="field-options">Opções (separadas por vírgula)</Label>
                            <Input id="field-options" value={formData.options?.join(',') || ''} onChange={(e) => setFormData(f => ({ ...f, options: e.target.value.split(',') }))} placeholder="Opção 1,Opção 2" />
                        </div>
                    )}
                    <div>
                        <Label htmlFor="field-placeholder">Texto de Ajuda (Placeholder)</Label>
                        <Input id="field-placeholder" value={formData.placeholder || ''} onChange={(e) => setFormData(f => ({ ...f, placeholder: e.target.value }))} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="field-required" checked={formData.required} onCheckedChange={(checked) => setFormData(f => ({ ...f, required: !!checked }))} />
                        <Label htmlFor="field-required">Campo Obrigatório</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave}>Salvar Campo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function CustomerFormBuilder({ template, onSave, onDone }: { template?: Partial<CustomerFormTemplate>, onSave: (data: Partial<CustomerFormTemplate>) => void, onDone: () => void }) {
    const [name, setName] = useState(template?.name || 'Formulário Padrão do Cliente');
    const [fields, setFields] = useState<CustomerFormField[]>(template?.fields || []);
    const [isFieldFormOpen, setIsFieldFormOpen] = useState(false);
    const [editingField, setEditingField] = useState<CustomerFormField | undefined>(undefined);

    useEffect(() => {
        setName(template?.name || 'Formulário Padrão do Cliente');
        setFields(template?.fields?.sort((a, b) => a.order - b.order) || []);
    }, [template]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...template, name, fields });
    };

    const handleSaveField = (field: CustomerFormField) => {
        const existingFieldIndex = fields.findIndex(f => f.id === field.id);
        if (existingFieldIndex > -1) {
            // Update existing field
            const updatedFields = [...fields];
            updatedFields[existingFieldIndex] = field;
            setFields(updatedFields);
        } else {
            // Add new field
            setFields([...fields, { ...field, order: fields.length }]);
        }
        setIsFieldFormOpen(false);
    };

    const handleDeleteField = (fieldId: string) => {
        setFields(fields.filter(f => f.id !== fieldId));
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div>
                    <Label htmlFor="template-name">Nome do Formulário</Label>
                    <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Formulário Padrão do Cliente" required />
                </div>
                <div className="pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Campos do Formulário</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditingField(undefined); setIsFieldFormOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Campo
                        </Button>
                    </div>
                    <div className="mt-2 rounded-lg border border-gray-200 p-4 space-y-2">
                        {fields.length > 0 ? (
                            fields.map(field => (
                                <div key={field.id} className="flex items-center justify-between rounded-md border p-3 bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <span className="font-medium">{field.label}</span>
                                            <span className="text-sm text-muted-foreground ml-2">({fieldTypeNames[field.type]})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingField(field); setIsFieldFormOpen(true); }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Excluir este campo?</AlertDialogTitle></AlertDialogHeader>
                                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteField(field.id)}>Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center">
                                <p className="text-sm text-muted-foreground">Nenhum campo adicionado.</p>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="pt-4">
                    <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
                    <Button type="submit">Salvar Formulário</Button>
                </DialogFooter>
            </form>
            <CustomerFieldFormDialog 
                isOpen={isFieldFormOpen}
                onOpenChange={setIsFieldFormOpen}
                field={editingField}
                onSave={handleSaveField}
            />
        </>
    );
}


export function CustomerFormBuilderSettings() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [template, setTemplate] = useState<CustomerFormTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false); // This dialog is for the template itself

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'customerFormTemplates'),
            where('organizationId', '==', user.organizationId),
            where('isDeleted', '!=', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Assuming only one customer form template per organization
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerFormTemplate));
            setTemplate(data[0] || null); // Get the first one, or null
            setLoading(false);
        }, (error) => {
            console.error("Error fetching customer form template:", error);
            toast({ title: "Erro ao buscar modelo de formulário de cliente", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    const handleSave = async (data: Partial<CustomerFormTemplate>) => {
        if (!user?.organizationId) {
            toast({ title: "Organização não encontrada", variant: "destructive" });
            return;
        }

        try {
            if (template?.id) {
                await updateDoc(doc(db, 'customerFormTemplates', template.id), data);
                toast({ title: "Formulário de cliente atualizado com sucesso!" });
            } else {
                await addDoc(collection(db, 'customerFormTemplates'), {
                    name: data.name || 'Formulário Padrão do Cliente',
                    fields: data.fields || [],
                    organizationId: user.organizationId,
                    isDeleted: false,
                });
                toast({ title: "Formulário de cliente criado com sucesso!" });
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving customer form template:", error);
            toast({ title: "Erro ao salvar formulário de cliente", variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!template?.id) return;
        try {
            await updateDoc(doc(db, 'customerFormTemplates', template.id), { isDeleted: true });
            toast({ title: "Formulário de cliente excluído com sucesso", variant: "destructive" });
            setTemplate(null); // Clear the template from state
        } catch (error) {
            console.error("Error deleting customer form template:", error);
            toast({ title: "Erro ao excluir formulário de cliente", variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader><CardTitle>Carregando Formulário do Cliente...</CardTitle></CardHeader>
                <CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Formulário de Cadastro de Cliente</CardTitle>
                        <CardDescription>
                            Defina os campos adicionais que aparecerão no formulário de cadastro e edição de clientes.
                        </CardDescription>
                    </div>
                    {!template && (
                        <Button onClick={() => setIsFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Criar Formulário</Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {template ? (
                    <CustomerFormBuilder
                        template={template}
                        onSave={handleSave}
                        onDone={() => setIsFormOpen(false)}
                    />
                ) : (
                    <div className="py-12 text-center">
                        <p className="text-muted-foreground">Nenhum formulário de cliente configurado. Clique em "Criar Formulário" para começar.</p>
                    </div>
                )}
            </CardContent>
            {template && (
                <CardFooter className="flex justify-end gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir Formulário
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir Formulário de Cliente?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogDescription>
                                Esta ação irá remover o modelo de formulário e todos os dados personalizados associados a ele nos clientes. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            )}
        </Card>
    );
}
