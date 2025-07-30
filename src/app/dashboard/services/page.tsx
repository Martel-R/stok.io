
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { Service, User } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Briefcase, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';


function ServiceForm({ service, professionals, onSave, onDone }: { service?: Service; professionals: User[]; onSave: (data: Partial<Service>) => void; onDone: () => void }) {
    const [formData, setFormData] = useState<Partial<Service>>(
        service || { 
            name: '', description: '', category: '', duration: 30, price: 0, professionalIds: [], isActive: true
        }
    );
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleProfessionalSelect = (professionalId: string) => {
        setFormData(prev => {
            const newIds = prev.professionalIds?.includes(professionalId)
                ? prev.professionalIds.filter(id => id !== professionalId)
                : [...(prev.professionalIds || []), professionalId];
            return { ...prev, professionalIds: newIds };
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onDone();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome do Serviço</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input id="category" name="category" value={formData.category} onChange={handleChange} required />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$)</Label>
                    <Input id="price" name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="duration">Duração (minutos)</Label>
                    <Input id="duration" name="duration" type="number" value={formData.duration} onChange={handleChange} required />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Profissionais Habilitados</Label>
                 <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpen}
                            className="w-full justify-between"
                        >
                            <span className="truncate">
                                {formData.professionalIds?.length || 0} profissional(is) selecionado(s)
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Buscar profissional..." />
                            <CommandList>
                                <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
                                <CommandGroup>
                                    {professionals.map((prof) => (
                                        <CommandItem
                                            key={prof.id}
                                            value={prof.name}
                                            onSelect={() => handleProfessionalSelect(prof.id)}
                                        >
                                            <Check
                                                className={cn("mr-2 h-4 w-4", formData.professionalIds?.includes(prof.id) ? "opacity-100" : "opacity-0")}
                                            />
                                            {prof.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                    id="isActive" 
                    checked={formData.isActive} 
                    onCheckedChange={(checked) => setFormData(prev => ({...prev, isActive: checked}))}
                />
                <Label htmlFor="isActive">Serviço Ativo</Label>
            </div>

            <DialogFooter>
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Serviço</Button>
            </DialogFooter>
        </form>
    );
}

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | undefined>(undefined);
    const { toast } = useToast();
    const { user } = useAuth();

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        
        const servicesQuery = query(collection(db, 'services'), where("organizationId", "==", user.organizationId));
        const servicesUnsub = onSnapshot(servicesQuery, (snapshot) => {
            setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
            setLoading(false);
        });

        const professionalsQuery = query(collection(db, 'users'), where("organizationId", "==", user.organizationId), where("role", "==", "professional"));
        const profsUnsub = onSnapshot(professionalsQuery, (snapshot) => {
            setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        });

        return () => {
            servicesUnsub();
            profsUnsub();
        };
    }, [user]);

    const handleSave = async (data: Partial<Service>) => {
        if (!user?.organizationId) {
            toast({ title: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        
        try {
            if (editingService?.id) {
                await updateDoc(doc(db, "services", editingService.id), data);
                toast({ title: 'Serviço atualizado com sucesso!' });
            } else {
                await addDoc(collection(db, "services"), { ...data, organizationId: user.organizationId });
                toast({ title: 'Serviço adicionado com sucesso!' });
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving service: ", error);
            toast({ title: 'Erro ao salvar serviço', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, "services", id));
            toast({ title: 'Serviço excluído com sucesso!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir serviço', variant: 'destructive' });
        }
    };
    
    const openEditDialog = (service: Service) => {
        setEditingService(service);
        setIsFormOpen(true);
    };

    const openNewDialog = () => {
        setEditingService(undefined);
        setIsFormOpen(true);
    };
    
    const getProfessionalNames = (ids: string[]) => {
        if (!ids || ids.length === 0) return <Badge variant="outline">Nenhum</Badge>;
        return ids.map(id => {
            const prof = professionals.find(p => p.id === id);
            return prof ? <Badge key={id} variant="secondary">{prof.name}</Badge> : null;
        }).filter(Boolean);
    };

    if (!user?.enabledModules?.services) {
        return (
            <Card className="m-auto">
                <CardHeader>
                    <CardTitle>Módulo Desabilitado</CardTitle>
                    <CardDescription>O módulo de serviços não está ativo para a sua organização.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>O administrador pode ativar este módulo na tela de Super Admin.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Briefcase className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">Serviços</h1>
                        <p className="text-muted-foreground">
                            Cadastre e gerencie os serviços oferecidos.
                        </p>
                    </div>
                </div>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" />Adicionar Serviço</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingService ? 'Editar Serviço' : 'Adicionar Novo Serviço'}</DialogTitle>
                        </DialogHeader>
                        <ServiceForm
                            service={editingService}
                            professionals={professionals}
                            onSave={handleSave}
                            onDone={() => setIsFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Profissionais</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : services.length > 0 ? (
                        services.map((service) => (
                            <TableRow key={service.id}>
                                <TableCell className="font-medium">{service.name}</TableCell>
                                <TableCell>{service.category}</TableCell>
                                <TableCell>{service.duration} min</TableCell>
                                <TableCell>R$ {service.price.toFixed(2)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {getProfessionalNames(service.professionalIds)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={service.isActive ? 'secondary' : 'outline'}>
                                        {service.isActive ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEditDialog(service)}>Editar</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(service.id)}>Excluir</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                Nenhum serviço encontrado. Comece a cadastrar!
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

