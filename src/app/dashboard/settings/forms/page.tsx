'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import type { FormTemplate, FormField, FormFieldType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Loader2, Trash2, GripVertical, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const fieldTypeNames: Record<FormFieldType, string> = {
    text: 'Texto Curto',
    textarea: 'Texto Longo',
    number: 'Número',
    date: 'Data',
    checkbox: 'Caixa de Seleção',
    select: 'Menu de Opções',
    radio: 'Múltipla Escolha (única)',
};

function FieldFormDialog({ 
    field, 
    isOpen, 
    onOpenChange, 
    onSave 
}: { 
    field?: FormField, 
    isOpen: boolean, 
    onOpenChange: (isOpen: boolean) => void, 
    onSave: (field: FormField) => void 
}) {
    const [formData, setFormData] = useState<FormField>(
        field || { id: `field_${Date.now()}`, label: '', type: 'text', required: false, order: 0 }
    );

    useEffect(() => {
        setFormData(field || { id: `field_${Date.now()}`, label: '', type: 'text', required: false, order: 0 });
    }, [field, isOpen]);

    const handleSave = () => {
        if (!formData.label) {
            // Basic validation
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
                        <Input id="field-label" value={formData.label} onChange={(e) => setFormData(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Nome Completo" />
                    </div>
                    <div>
                        <Label htmlFor="field-type">Tipo do Campo</Label>
                        <Select value={formData.type} onValueChange={(v: FormFieldType) => setFormData(f => ({ ...f, type: v }))}>
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


function FormBuilder({ template, onSave, onDone }: { template?: Partial<FormTemplate>, onSave: (data: Partial<FormTemplate>) => void, onDone: () => void }) {
    const [name, setName] = useState(template?.name || '');
    const [fields, setFields] = useState<FormField[]>(template?.fields || []);
    const [isFieldFormOpen, setIsFieldFormOpen] = useState(false);
    const [editingField, setEditingField] = useState<FormField | undefined>(undefined);

    useEffect(() => {
        setName(template?.name || '');
        setFields(template?.fields?.sort((a, b) => a.order - b.order) || []);
    }, [template]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...template, name, fields });
    };

    const handleSaveField = (field: FormField) => {
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
                    <Label htmlFor="template-name">Nome do Modelo</Label>
                    <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ficha de Atendimento Padrão" required />
                </div>
                <div className="pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Campos da Ficha</h3>
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
                    <Button type="submit">Salvar Modelo</Button>
                </DialogFooter>
            </form>
            <FieldFormDialog 
                isOpen={isFieldFormOpen}
                onOpenChange={setIsFieldFormOpen}
                field={editingField}
                onSave={handleSaveField}
            />
        </>
    );
}


export default function FormTemplatesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<FormTemplate> | undefined>(undefined);

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'formTemplates'),
            where('organizationId', '==', user.organizationId),
            where('isDeleted', '!=', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormTemplate));
            setTemplates(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching form templates:", error);
            toast({ title: "Erro ao buscar modelos", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    const openNewDialog = () => {
        setEditingTemplate({});
        setIsFormOpen(true);
    };

    const openEditDialog = (template: FormTemplate) => {
        setEditingTemplate(template);
        setIsFormOpen(true);
    };

    const handleSave = async (data: Partial<FormTemplate>) => {
        if (!user?.organizationId) {
            toast({ title: "Organização não encontrada", variant: "destructive" });
            return;
        }

        try {
            if (editingTemplate?.id) {
                await updateDoc(doc(db, 'formTemplates', editingTemplate.id), data);
                toast({ title: "Modelo atualizado com sucesso!" });
            } else {
                await addDoc(collection(db, 'formTemplates'), {
                    name: data.name,
                    fields: data.fields || [],
                    organizationId: user.organizationId,
                    isDeleted: false,
                });
                toast({ title: "Modelo criado com sucesso!" });
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving template:", error);
            toast({ title: "Erro ao salvar modelo", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await updateDoc(doc(db, 'formTemplates', id), { isDeleted: true });
            toast({ title: "Modelo excluído com sucesso", variant: "destructive" });
        } catch (error) {
            console.error("Error deleting template:", error);
            toast({ title: "Erro ao excluir modelo", variant: "destructive" });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Modelos de Ficha de Atendimento</CardTitle>
                        <CardDescription>
                            Crie e gerencie os modelos de ficha que serão usados no módulo de Atendimentos.
                        </CardDescription>
                    </div>
                    <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" /> Criar Novo Modelo</Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Modelo</TableHead>
                            <TableHead>Nº de Campos</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : templates.length > 0 ? (
                            templates.map(template => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">{template.name}</TableCell>
                                    <TableCell>{template.fields?.length || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(template)}>
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(template.id)} className="text-destructive">
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    Nenhum modelo de ficha encontrado. Comece criando um novo.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate?.id ? 'Editar Modelo' : 'Criar Novo Modelo'}</DialogTitle>
                    </DialogHeader>
                    <FormBuilder 
                        template={editingTemplate}
                        onSave={handleSave}
                        onDone={() => setIsFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </Card>
    );
}
