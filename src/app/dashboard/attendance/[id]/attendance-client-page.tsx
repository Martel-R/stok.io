// src/app/dashboard/attendance/[id]/attendance-client-page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Attendance, AttendanceItem, Service, Product, AttendanceStatus, AttendancePaymentStatus, Customer, AnamnesisAnswer } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, PlusCircle, Trash2, ArrowLeft, Camera, User, Save, CheckCircle, Clock, Calendar, Upload, Mail, Phone, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format } from 'date-fns';
import { Briefcase } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const formatAnamnesisAnswer = (answer: AnamnesisAnswer) => {
    if (answer.answer === null || answer.answer === undefined) {
        return <span className="text-muted-foreground italic">Não respondido</span>;
    }
    if (typeof answer.answer === 'boolean') {
        return answer.answer ? 'Sim' : 'Não';
    }
    if (typeof answer.answer === 'object' && answer.answer !== null && 'choice' in answer.answer) {
        const choice = answer.answer.choice === true ? 'Sim' : 'Não';
        const details = answer.answer.details ? ` - ${answer.answer.details}` : '';
        return `${choice}${details}`;
    }
    return String(answer.answer);
};

export default function AttendanceClientPage({ id }: { id: string }) {
    const router = useRouter();
    const { user, currentBranch } = useAuth();
    const { toast } = useToast();

    const [attendance, setAttendance] = useState<Attendance | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState(true);


    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, 'attendances', id as string), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Attendance;
                setAttendance({ ...data, id: docSnap.id });
                
                // Fetch customer data
                if (data.customerId) {
                    const customerRef = doc(db, 'customers', data.customerId);
                    const customerSnap = await getDoc(customerRef);
                    if (customerSnap.exists()) {
                        setCustomer(customerSnap.data() as Customer);
                    }
                }

            } else {
                toast({ title: 'Atendimento não encontrado', variant: 'destructive' });
                router.push('/dashboard/appointments');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, router, toast]);

    useEffect(() => {
        const getCameraPermission = async () => {
          try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setHasCameraPermission(false);
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);

            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          } catch (error) {
            console.error('Erro ao acessar a câmera:', error);
            setHasCameraPermission(false);
          }
        };

        getCameraPermission();
        
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                 const stream = videoRef.current.srcObject as MediaStream;
                 if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                 }
            }
        };
    }, []);

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

    const uploadFile = async (file: File) => {
        if (!attendance) return;
        setIsUploading(true);
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

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        uploadFile(file);
    };

    const handleCapturePhoto = () => {
        if (!videoRef.current || !canvasRef.current || !attendance) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            toast({ title: 'Erro ao capturar', variant: 'destructive'});
            return;
        };

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                uploadFile(file);
            }
        }, 'image/jpeg', 0.95);
    };
    
    const handleSave = async (status: AttendanceStatus) => {
        if (!attendance) return;
        setIsSaving(true);
        try {
            const { id, ...dataToSave } = attendance;
            await updateDoc(doc(db, 'attendances', id), { ...dataToSave, status });
            toast({ title: `Atendimento ${status === 'completed' ? 'finalizado' : 'salvo'} com sucesso!` });
             if (status === 'completed') {
                router.push('/dashboard/pos');
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
                                            <p className="text-sm text-muted-foreground">{item.quantity} x R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold">R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Câmera ao Vivo</CardTitle>
                                <CardDescription>Capture fotos do atendimento.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-muted rounded-md p-2">
                                    <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline />
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                                
                                {!hasCameraPermission && (
                                    <Alert variant="destructive">
                                        <Camera className="h-4 w-4"/>
                                        <AlertTitle>Acesso à Câmera Necessário</AlertTitle>
                                        <AlertDescription>
                                            Por favor, habilite a permissão para usar a câmera nas configurações do seu navegador.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <Button onClick={handleCapturePhoto} disabled={!hasCameraPermission || isUploading} className="w-full">
                                    {isUploading && <Loader2 className="mr-2 animate-spin" />}
                                    <Camera className="mr-2" />
                                    Capturar Foto
                                </Button>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle>Galeria de Fotos</CardTitle>
                                <CardDescription>Fotos do atendimento.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col h-full">
                                <div className="grid grid-cols-2 gap-4 mb-4 flex-grow">
                                    {attendance.photos.map(url => (
                                        <div key={url} className="relative aspect-square">
                                            <Image src={url} alt="Foto do atendimento" layout="fill" className="rounded-md object-cover"/>
                                        </div>
                                    ))}
                                    {isUploading && <div className="relative aspect-square flex items-center justify-center rounded-md border"><Loader2 className="animate-spin"/></div>}
                                </div>
                                <div className="mt-auto">
                                    <Label htmlFor="photo-upload" className={cn('w-full', isUploading && 'opacity-50 cursor-not-allowed')}>
                                        <div className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted">
                                            <Upload className="mr-2"/>
                                            <span>Enviar Arquivo</span>
                                        </div>
                                    </Label>
                                    <Input id="photo-upload" type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading}/>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                             <CardTitle>Detalhes do Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                             <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{attendance.customerName}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                <span>Profissional: {attendance.professionalName}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>Data: {attendance.date ? format(attendance.date.toDate(), 'dd/MM/yyyy') : '...'}</span>
                            </div>
                             {customer?.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{customer.email}</span></div>}
                             {customer?.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{customer.phone}</span></div>}
                             {customer?.address && <div className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" /><span>{customer.address}</span></div>}
                             <Separator />
                             <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Status Atendimento:</span>
                                <Badge variant={attendance.status === 'completed' ? 'default' : 'secondary'}>{attendance.status}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Status Pagamento:</span>
                                <Badge variant={attendance.paymentStatus === 'paid' ? 'default' : 'destructive'}>{attendance.paymentStatus}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader><CardTitle>Anamnese</CardTitle></CardHeader>
                         <CardContent>
                             <ScrollArea className="h-48">
                                 <div className="space-y-3">
                                     {customer?.anamnesisAnswers && customer.anamnesisAnswers.length > 0 ? (
                                         customer.anamnesisAnswers.map(answer => (
                                             <div key={answer.questionId}>
                                                 <p className="font-semibold text-sm">{answer.questionLabel}</p>
                                                 <p className="text-sm text-muted-foreground">{formatAnamnesisAnswer(answer)}</p>
                                             </div>
                                         ))
                                     ) : (
                                        <p className="text-sm text-muted-foreground italic">Nenhum formulário de anamnese preenchido.</p>
                                     )}
                                 </div>
                             </ScrollArea>
                         </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                             <CardTitle>Total</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">R$ {attendance.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
