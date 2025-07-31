
// src/app/dashboard/attendance/[id]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Attendance, AttendanceItem, Service, Product, AttendanceStatus, AttendancePaymentStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, PlusCircle, Trash2, ArrowLeft, Camera, User, Calendar, Save, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format } from 'date-fns';


function ItemSelector({ 
    onSelect, 
    products, 
    services,
}: { 
    onSelect: (item: AttendanceItem) => void, 
    products: Product[],
    services: Service[],
}) {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();
    
    // Filter services to only those the current professional can perform
    const availableServices = useMemo(() => {
        if (user?.role !== 'professional') return services;
        return services.filter(s => s.professionalIds.includes(user.id));
    }, [services, user]);
    
    const handleSelect = (item: Product | Service, type: 'product' | 'service') => {
        onSelect({
            id: item.id,
            name: item.name,
            type: type,
            quantity: 1,
            price: item.price,
            total: item.price,
        });
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                    <PlusCircle className="mr-2"/> Adicionar Item
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar produto ou serviço..." />
                    <CommandList>
                        <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                        <CommandGroup heading="Serviços">
                            {availableServices.map((service) => (
                                <CommandItem key={`service-${service.id}`} onSelect={() => handleSelect(service, 'service')}>
                                    {service.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandGroup heading="Produtos">
                            {products.map((product) => (
                                <CommandItem key={`product-${product.id}`} onSelect={() => handleSelect(product, 'product')}>
                                    {product.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function AttendancePage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();

    const [attendance, setAttendance] = useState<Attendance | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, 'attendances', id as string), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as Attendance;
                setAttendance({ ...data, id: doc.id });
            } else {
                toast({ title: 'Atendimento não encontrado', variant: 'destructive' });
                router.push('/dashboard/appointments');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, router, toast]);

    useEffect(() => {
        if (!currentBranch || !user) return;
        const qProducts = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
        const qServices = query(collection(db, 'services'), where('organizationId', '==', user.organizationId));
        
        const unsubProducts = onSnapshot(qProducts, snap => setProducts(snap.docs.map(d => ({id: d.id, ...d.data()}) as Product)));
        const unsubServices = onSnapshot(qServices, snap => setServices(snap.docs.map(d => ({id: d.id, ...d.data()}) as Service)));

        return () => {
            unsubProducts();
            unsubServices();
        }
    }, [currentBranch, user]);

    const handleAddItem = (item: AttendanceItem) => {
        if (!attendance) return;
        setAttendance(prev => {
            if (!prev) return null;
            const existingItemIndex = prev.items.findIndex(i => i.id === item.id);
            let newItems;
            if (existingItemIndex > -1) {
                newItems = [...prev.items];
                const existingItem = newItems[existingItemIndex];
                if (existingItem.type === 'product') {
                    existingItem.quantity += 1;
                    existingItem.total = existingItem.price * existingItem.quantity;
                } else {
                    // Don't increase quantity for services, add as new item if needed or block
                    toast({title: 'Serviço já adicionado', variant: 'destructive'});
                    return prev;
                }
            } else {
                newItems = [...prev.items, item];
            }
            const newTotal = newItems.reduce((acc, curr) => acc + curr.total, 0);
            return { ...prev, items: newItems, total: newTotal };
        });
    };
    
    const handleRemoveItem = (itemId: string) => {
        if (!attendance) return;
        setAttendance(prev => {
            if (!prev) return null;
            const newItems = prev.items.filter(i => i.id !== itemId);
            const newTotal = newItems.reduce((acc, curr) => acc + curr.total, 0);
            return { ...prev, items: newItems, total: newTotal };
        });
    };

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!attendance) return;
        setAttendance(prev => prev ? { ...prev, notes: e.target.value } : null);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !attendance) return;
        setIsUploading(true);
        const file = e.target.files[0];
        const filePath = `attendances/${attendance.id}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);

        try {
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            setAttendance(prev => prev ? { ...prev, photos: [...prev.photos, downloadURL] } : null);
            toast({ title: 'Foto enviada com sucesso!' });
        } catch (error) {
            toast({ title: 'Erro ao enviar foto', variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleSave = async (status: AttendanceStatus) => {
        if (!attendance) return;
        setIsSaving(true);
        try {
            const { id, ...dataToSave } = attendance;
            await updateDoc(doc(db, 'attendances', id), { ...dataToSave, status });
            toast({ title: `Atendimento ${status === 'completed' ? 'finalizado' : 'salvo'} com sucesso!` });
             if (status === 'completed') {
                router.push('/dashboard/appointments');
            }
        } catch (error) {
            toast({ title: 'Erro ao salvar', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8"><Skeleton className="h-96 w-full"/></div>
    }

    if (!attendance) {
        return <p>Atendimento não encontrado.</p>;
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2"/> Voltar</Button>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Itens do Atendimento</CardTitle>
                            <CardDescription>Adicione serviços e produtos utilizados.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-2">
                                {attendance.items.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-2 rounded-md bg-muted">
                                        <div>
                                            <p className="font-medium">{item.name} <Badge variant="outline">{item.type === 'product' ? 'Produto' : 'Serviço'}</Badge></p>
                                            <p className="text-sm text-muted-foreground">{item.quantity} x R$ {item.price.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold">R$ {item.total.toFixed(2)}</p>
                                            <Button size="icon" variant="ghost" onClick={() => handleRemoveItem(item.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <ItemSelector onSelect={handleAddItem} products={products} services={services} />
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Anotações e Evolução do Cliente</CardTitle></CardHeader>
                        <CardContent>
                            <Textarea 
                                value={attendance.notes}
                                onChange={handleNotesChange}
                                rows={8}
                                placeholder="Descreva os procedimentos, observações e evolução do cliente..."
                            />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Galeria de Fotos</CardTitle>
                            <CardDescription>Adicione fotos do atendimento (ex: antes e depois).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {attendance.photos.map(url => (
                                    <div key={url} className="relative aspect-square">
                                        <Image src={url} alt="Foto do atendimento" layout="fill" className="rounded-md object-cover"/>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <Label htmlFor="photo-upload" className={cn('w-full', isUploading && 'opacity-50 cursor-not-allowed')}>
                                    <div className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted">
                                        {isUploading ? <Loader2 className="mr-2 animate-spin"/> : <Camera className="mr-2"/>}
                                        <span>Adicionar Foto</span>
                                    </div>
                                </Label>
                                <Input id="photo-upload" type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading}/>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                             <CardTitle>Detalhes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{attendance.customerName}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                <span>{attendance.professionalName}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{attendance.date ? format(attendance.date.toDate(), 'dd/MM/yyyy') : '...'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Status:</span>
                                <Badge variant={attendance.status === 'completed' ? 'default' : 'secondary'}>{attendance.status}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Pagamento:</span>
                                <Badge variant={attendance.paymentStatus === 'paid' ? 'default' : 'destructive'}>{attendance.paymentStatus}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                             <CardTitle>Total</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">R$ {attendance.total.toFixed(2)}</p>
                        </CardContent>
                    </Card>

                    <div className="space-y-2">
                         <Button onClick={() => handleSave('completed')} size="lg" className="w-full" disabled={isSaving || attendance.status === 'completed'}>
                            {isSaving ? <Loader2 className="mr-2 animate-spin"/> : <CheckCircle className="mr-2" />}
                             Finalizar Atendimento
                        </Button>
                         <Button onClick={() => handleSave(attendance.status)} variant="outline" size="lg" className="w-full" disabled={isSaving}>
                             {isSaving ? <Loader2 className="mr-2 animate-spin"/> : <Save className="mr-2"/>}
                             Salvar Rascunho
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
