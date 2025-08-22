

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import type { Service, User, PermissionProfile, Product, ServiceProduct } from '@/lib/types';
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
import { logUserActivity } from '@/lib/logging';


function ServiceForm({ service, professionals, products, onSave, onDone }: { 
    service?: Service; 
    professionals: User[]; 
    products: Product[];
    onSave: (data: Partial<Service>) => void; 
    onDone: () => void 
}) {
    const [formData, setFormData] = useState<Partial<Service>>(
        service || { 
            name: '', description: '', category: '', duration: 30, price: 0, professionalIds: [], isActive: true, linkedProducts: []
        }
    );
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [productPopoverOpen, setProductPopoverOpen] = useState(false);

    useEffect(() => {
        setFormData(service || { 
            name: '', description: '', category: '', duration: 30, price: 0, professionalIds: [], isActive: true, linkedProducts: []
        });
    }, [service]);

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

    const addLinkedProduct = (product: Product) => {
        setFormData(prev => {
            const existing = prev.linkedProducts?.find(p => p.productId === product.id);
            if (existing) return prev;
            const newProduct: ServiceProduct = { productId: product.id, productName: product.name, quantity: 1 };
            return { ...prev, linkedProducts: [...(prev.linkedProducts || []), newProduct] };
        });
        setProductPopoverOpen(false);
    };

    const updateLinkedProductQuantity = (productId: string, quantity: number) => {
        setFormData(prev => ({
            ...prev,
            linkedProducts: prev.linkedProducts?.map(p => p.productId === productId ? { ...p, quantity: quantity } : p)
        }));
    };
    
    const removeLinkedProduct = (productId: string) => {
         setFormData(prev => ({
            ...prev,
            linkedProducts: prev.linkedProducts?.filter(p => p.productId !== productId)
        }));
    };
    
    const handleSubmit = (e: React.Event<HTMLFormElement>) => {
        e.preventDefault();
        onSave(formData);
        onDone();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome do Serviço</Label>
                    <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input id="category" name="category" value={formData.category || ''} onChange={handleChange} required />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$)</Label>
                    <Input id="price" name="price" type="number" step="0.01" value={formData.price || 0} onChange={handleChange} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="duration">Duração (minutos)</Label>
                    <Input id="duration" name="duration" type="number" value={formData.duration || 0} onChange={handleChange} required />
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
             <div className="space-y-2">
                <Label>Produtos Vinculados</Label>
                <div className="space-y-2 rounded-md border p-2">
                    {formData.linkedProducts?.map(p => (
                        <div key={p.productId} className="flex items-center justify-between gap-2">
                            <span className="text-sm flex-grow">{p.productName}</span>
                            <Input
                                type="number"
                                value={p.quantity}
                                onChange={(e) => updateLinkedProductQuantity(p.productId, parseInt(e.target.value, 10) || 1)}
                                className="w-20 h-8"
                            />
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLinkedProduct(p.productId)}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                        </div>
                    ))}
                    <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                        <PopoverTrigger asChild>
                             <Button type="button" variant="outline" className="w-full">
                                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Produto
                            </Button>
                        </PopoverTrigger>
                         <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {products.map(product => (
                                            <CommandItem key={product.id} onSelect={() => addLinkedProduct(product)}>
                                                {product.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                         </PopoverContent>
                    </Popover>
                </div>
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
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | undefined>(undefined);
    const { toast } = useToast();
    const { user, currentBranch } = useAuth();

    const can = useMemo(() => ({
        view: user?.enabledModules?.services?.view ?? false,
        edit: user?.enabledModules?.services?.edit ?? false,
        delete: user?.enabledModules?.services?.delete ?? false,
    }), [user]);

    useEffect(() => {
        if (!user?.organizationId || !currentBranch?.id) {
            setLoading(false);
            return;
        }

        const servicesQuery = query(collection(db, 'services'), where("organizationId", "==", user.organizationId), where("isDeleted", "==", false));
        const servicesUnsub = onSnapshot(servicesQuery, (snapshot) => {
            setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
            setLoading(false);
        });

        const productsQuery = query(collection(db, 'products'), where("branchId", "==", currentBranch.id));
        const productsUnsub = onSnapshot(productsQuery, (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });

        const profilesQuery = query(collection(db, 'permissionProfiles'), where("organizationId", "==", user.organizationId), where("name", "==", "Profissional"));
        
        const fetchProfessionals = async () => {
            const profileSnap = await getDocs(profilesQuery);
            if (profileSnap.empty) {
                console.warn("Perfil 'Profissional' não encontrado.");
                setProfessionals([]);
                return () => {};
            }
            const professionalProfileId = profileSnap.docs[0].id;
            
            const professionalsQuery = query(collection(db, 'users'), where("organizationId", "==", user.organizationId), where("role", "==", professionalProfileId));
            return onSnapshot(professionalsQuery, (snapshot) => {
                setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
            });
        };
        
        let profsUnsub: (() => void) | undefined;
        fetchProfessionals().then(unsub => {
            profsUnsub = unsub;
        });

        return () => {
            servicesUnsub();
            productsUnsub();
            if (profsUnsub) {
                profsUnsub();
            }
        };
    }, [user, currentBranch]);

    const handleSave = async (data: Partial<Service>) => {
        if (!user?.organizationId) {
            toast({ title: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        
        const isEditing = !!editingService?.id;
        const action = isEditing ? 'service_updated' : 'service_created';

        try {
            if (isEditing) {
                await updateDoc(doc(db, "services", editingService.id!), data);
                toast({ title: 'Serviço atualizado com sucesso!' });
            } else {
                await addDoc(collection(db, "services"), { ...data, organizationId: user.organizationId, isDeleted: false });
                toast({ title: 'Serviço adicionado com sucesso!' });
            }
            logUserActivity({
                userId: user.id,
                userName: user.name,
                organizationId: user.organizationId,
                action,
                details: { serviceId: editingService?.id || 'new', serviceName: data.name }
            });
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving service: ", error);
            toast({ title: 'Erro ao salvar serviço', variant: 'destructive' });
        }
    };

    const handleDelete = async (service: Service) => {
        if (!user || !currentBranch) return;
        try {
            await updateDoc(doc(db, "services", service.id), { isDeleted: true });
            toast({ title: 'Serviço excluído com sucesso!', variant: 'destructive' });
            logUserActivity({
                userId: user.id,
                userName: user.name,
                organizationId: user.organizationId,
                action: 'service_deleted',
                details: { serviceId: service.id, serviceName: service.name }
            });
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

    if (!can.view) {
        return (
            <Card className="m-auto">
                <CardHeader>
                    <CardTitle>Módulo Desabilitado</CardTitle>
                    <CardDescription>O módulo de serviços não está ativo para a sua organização ou você não tem permissão para visualizá-lo.</CardDescription>
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
                {can.edit && (
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
                                products={products}
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
                        <TableHead>Nome</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : services.length > 0 ? (
                        services.map((service) => (
                            <TableRow key={service.id}>
                                <TableCell className="font-medium">{service.name}</TableCell>
                                <TableCell>{service.duration} min</TableCell>
                                <TableCell>R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
                                            {can.edit && <DropdownMenuItem onClick={() => openEditDialog(service)}>Editar</DropdownMenuItem>}
                                            {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDelete(service)}>Excluir</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                Nenhum serviço encontrado. Comece a cadastrar!
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

