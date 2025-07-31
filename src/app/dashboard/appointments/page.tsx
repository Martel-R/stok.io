
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import type { Appointment, Customer, Service, User, AppointmentStatus } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Calendar, Users, Briefcase, Check, ChevronsUpDown, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DateRange, DayPicker } from 'react-day-picker';
import { format, addMinutes, setHours, setMinutes, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

function AppointmentForm({ 
    appointment, 
    customers,
    services,
    professionals,
    onSave, 
    onDone,
    initialDate 
}: { 
    appointment?: Appointment; 
    customers: Customer[];
    services: Service[];
    professionals: User[];
    onSave: (data: Partial<Appointment>) => void; 
    onDone: () => void;
    initialDate: Date;
}) {
    const { currentBranch } = useAuth();
    const [formData, setFormData] = useState<Partial<Appointment>>({
        start: setHours(setMinutes(initialDate, 0), 9), // Default to 9:00 AM on the selected day
        status: 'scheduled',
        notes: '',
        ...appointment,
    });
    
    const [selectedService, setSelectedService] = useState<Service | null>(
        appointment ? services.find(s => s.id === appointment.serviceId) || null : null
    );

    const availableProfessionals = useMemo(() => {
        if (!selectedService) return [];
        return professionals.filter(p => selectedService.professionalIds.includes(p.id));
    }, [selectedService, professionals]);

    const handleDateChange = (date: Date | undefined) => {
        if (!date) return;
        const currentStartTime = formData.start || new Date();
        const newDate = setHours(setMinutes(date, currentStartTime.getMinutes()), currentStartTime.getHours());
        setFormData(prev => ({...prev, start: newDate }));
    }

    const handleTimeChange = (time: string) => { // time is "HH:mm"
        const [hours, minutes] = time.split(':').map(Number);
        const newDate = setHours(setMinutes(formData.start || new Date(), minutes), hours);
        setFormData(prev => ({...prev, start: newDate}));
    }

    const handleServiceChange = (serviceId: string) => {
        const service = services.find(s => s.id === serviceId);
        if (service) {
            setSelectedService(service);
            setFormData(prev => ({
                ...prev, 
                serviceId: service.id, 
                serviceName: service.name,
                // Reset professional if they can't perform the new service
                professionalId: availableProfessionals.find(p => p.id === prev.professionalId) ? prev.professionalId : undefined,
                professionalName: availableProfessionals.find(p => p.id === prev.professionalId) ? prev.professionalName : undefined,
            }));
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.serviceId || !formData.professionalId || !formData.start) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        const customer = customers.find(c => c.id === formData.customerId);
        const professional = professionals.find(p => p.id === formData.professionalId);

        const finalData = {
            ...formData,
            customerName: customer?.name,
            professionalName: professional?.name,
            end: addMinutes(formData.start, selectedService?.duration || 0),
            branchId: currentBranch?.id
        }
        onSave(finalData as Partial<Appointment>);
        onDone();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select
                        value={formData.customerId}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, customerId: val }))}
                        required
                    >
                        <SelectTrigger><SelectValue placeholder="Selecione um cliente..."/></SelectTrigger>
                        <SelectContent>
                            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label>Serviço</Label>
                     <Select value={formData.serviceId} onValueChange={handleServiceChange} required>
                         <SelectTrigger><SelectValue placeholder="Selecione um serviço..."/></SelectTrigger>
                         <SelectContent>
                            {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                         </SelectContent>
                     </Select>
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>Profissional</Label>
                <Select
                    value={formData.professionalId}
                    onValueChange={(val) => setFormData(prev => ({...prev, professionalId: val}))}
                    required
                    disabled={!selectedService}
                >
                    <SelectTrigger><SelectValue placeholder="Selecione um profissional..."/></SelectTrigger>
                    <SelectContent>
                        {availableProfessionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Data</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <Calendar className="mr-2 h-4 w-4" />
                                {formData.start ? format(formData.start, 'dd/MM/yyyy') : <span>Escolha uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <CalendarComponent mode="single" selected={formData.start} onSelect={handleDateChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
                 <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input type="time" value={formData.start ? format(formData.start, 'HH:mm') : ''} onChange={(e) => handleTimeChange(e.target.value)} />
                </div>
            </div>

             <div className="space-y-2">
                <Label>Status</Label>
                 <Select value={formData.status} onValueChange={(val: AppointmentStatus) => setFormData(prev => ({...prev, status: val}))}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                        <SelectItem value="no-show">Não Compareceu</SelectItem>
                     </SelectContent>
                 </Select>
            </div>

            <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}/>
            </div>


            <DialogFooter>
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Agendamento</Button>
            </DialogFooter>
        </form>
    );
}

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<User[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>(undefined);
    const [selectedDay, setSelectedDay] = useState<Date>(new Date());

    const { toast } = useToast();
    const { user, currentBranch } = useAuth();
    
    const convertAppointmentDate = (docData: any): Appointment => {
        const convert = (field: any) => field instanceof Timestamp ? field.toDate() : new Date();
        return { ...docData, start: convert(docData.start), end: convert(docData.end) } as Appointment;
    };

    useEffect(() => {
        if (!user?.organizationId || !currentBranch) {
            setLoading(false);
            return;
        }

        const queries = [
            {coll: 'appointments', stateSetter: setAppointments, converter: convertAppointmentDate, condition: where('branchId', '==', currentBranch.id)},
            {coll: 'customers', stateSetter: setCustomers, condition: where('organizationId', '==', user.organizationId)},
            {coll: 'services', stateSetter: setServices, condition: where('organizationId', '==', user.organizationId)},
            {coll: 'users', stateSetter: setProfessionals, condition: where('role', '==', 'professional')},
        ];

        const unsubs = queries.map(q => {
            const queryRef = query(collection(db, q.coll), q.condition);
            return onSnapshot(queryRef, (snapshot) => {
                const data = snapshot.docs.map(doc => {
                    const docData = { id: doc.id, ...doc.data() };
                    return q.converter ? q.converter(docData) : docData;
                });
                q.stateSetter(data as any);
            });
        });

        setLoading(false);

        return () => unsubs.forEach(unsub => unsub());

    }, [user, currentBranch]);

    const appointmentsForSelectedDay = useMemo(() => {
        return appointments
            .filter(app => isSameDay(app.start, selectedDay))
            .sort((a,b) => a.start.getTime() - b.start.getTime());
    }, [appointments, selectedDay]);

    const handleSave = async (data: Partial<Appointment>) => {
        if (!user?.organizationId) {
            toast({ title: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        
        try {
            if (editingAppointment?.id) {
                await updateDoc(doc(db, "appointments", editingAppointment.id), data);
                toast({ title: 'Agendamento atualizado!' });
            } else {
                await addDoc(collection(db, "appointments"), { ...data, organizationId: user.organizationId });
                toast({ title: 'Agendamento criado!' });
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving appointment: ", error);
            toast({ title: 'Erro ao salvar agendamento', variant: 'destructive' });
        }
    };
    
    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, "appointments", id));
            toast({ title: 'Agendamento excluído!', variant: 'destructive' });
        } catch (error) {
            toast({ title: 'Erro ao excluir', variant: 'destructive' });
        }
    };
    
    const openEditDialog = (app: Appointment) => {
        setEditingAppointment(app);
        setIsFormOpen(true);
    };

    const openNewDialog = () => {
        setEditingAppointment(undefined);
        setIsFormOpen(true);
    };

    const getStatusBadge = (status: AppointmentStatus) => {
        switch (status) {
            case 'scheduled': return <Badge variant="secondary">Agendado</Badge>;
            case 'completed': return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
            case 'cancelled': return <Badge variant="outline">Cancelado</Badge>;
            case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <Calendar className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">Agendamentos</h1>
                        <p className="text-muted-foreground">
                            Visualize e gerencie os agendamentos da sua filial.
                        </p>
                    </div>
                </div>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" /> Novo Agendamento</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
                        </DialogHeader>
                        <AppointmentForm
                            appointment={editingAppointment}
                            customers={customers}
                            services={services}
                            professionals={professionals}
                            onSave={handleSave}
                            onDone={() => setIsFormOpen(false)}
                            initialDate={selectedDay}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                     <CalendarComponent
                        mode="single"
                        selected={selectedDay}
                        onSelect={(day) => day && setSelectedDay(day)}
                        className="rounded-md border"
                     />
                </div>
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agendamentos para {format(selectedDay, 'dd/MM/yyyy')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[60vh]">
                            {loading ? (
                                <Skeleton className="h-full w-full" />
                            ) : appointmentsForSelectedDay.length > 0 ? (
                                <div className="space-y-4">
                                    {appointmentsForSelectedDay.map(app => (
                                        <Card key={app.id} className="p-4">
                                             <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-lg">{app.serviceName}</CardTitle>
                                                    <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" />{app.customerName}</CardDescription>
                                                    <CardDescription className="flex items-center gap-2"><Briefcase className="h-4 w-4" />{app.professionalName}</CardDescription>
                                                    <CardDescription className="flex items-center gap-2"><Clock className="h-4 w-4" />{format(app.start, 'HH:mm')} - {format(app.end, 'HH:mm')}</CardDescription>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {getStatusBadge(app.status)}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => openEditDialog(app)}>Editar</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(app.id)}>Excluir</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                            {app.notes && <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{app.notes}</p>}
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    Nenhum agendamento para este dia.
                                </div>
                            )}
                             </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
