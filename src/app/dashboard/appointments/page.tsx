
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, Timestamp, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Appointment, Customer, Service, User, AppointmentStatus, Attendance, AnamnesisAnswer } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Calendar, Users, Briefcase, Check, ChevronsUpDown, Clock, RefreshCw, PlayCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addMinutes, setHours, setMinutes, startOfDay, endOfDay, isSameDay, getHours, getMinutes } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';


function AppointmentForm({ 
    appointment, 
    customers,
    services,
    professionals,
    onSave, 
    onDone,
    initialDate 
}: { 
    appointment?: Partial<Appointment>; 
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

    useEffect(() => {
        if (formData.serviceId) {
            setSelectedService(services.find(s => s.id === formData.serviceId) || null);
        }
    }, [formData.serviceId, services]);

    const availableProfessionals = useMemo(() => {
        if (!selectedService) return [];
        return professionals.filter(p => p.professionalIds.includes(p.id));
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
                professionalId: undefined,
                professionalName: undefined,
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
                        <SelectItem value="pending-confirmation">Pendente</SelectItem>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                        <SelectItem value="rescheduled">Reagendado</SelectItem>
                        <SelectItem value="no-show">Não Compareceu</SelectItem>
                     </SelectContent>
                 </Select>
            </div>

            <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={formData.notes || ''} onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}/>
            </div>


            <DialogFooter>
                <Button variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
                <Button type="submit">Salvar Agendamento</Button>
            </DialogFooter>
        </form>
    );
}

function DayView({ appointments, onEdit, onStartAttendance, onReschedule, onStatusChange, onDelete, customers }: {
    appointments: Appointment[];
    onEdit: (app: Appointment) => void;
    onStartAttendance: (app: Appointment) => void;
    onReschedule: (app: Appointment) => void;
    onStatusChange: (id: string, status: AppointmentStatus) => void;
    onDelete: (id: string) => void;
    customers: Customer[];
}) {
    const { user } = useAuth();
    const can = useMemo(() => ({
        edit: user?.enabledModules?.appointments?.edit ?? false,
        delete: user?.enabledModules?.appointments?.delete ?? false,
    }), [user]);

    const hourHeight = 60; // 60px per hour
    const startHour = 7;
    const endHour = 21;
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    const getPosition = (date: Date) => {
        const hours = getHours(date);
        const minutes = getMinutes(date);
        return (hours - startHour + minutes / 60) * hourHeight;
    };

    const getStatusBadge = (status: AppointmentStatus) => {
        switch (status) {
            case 'scheduled': return <Badge variant="secondary">Agendado</Badge>;
            case 'completed': return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
            case 'cancelled': return <Badge variant="outline">Cancelado</Badge>;
            case 'rescheduled': return <Badge className="bg-blue-100 text-blue-800">Reagendado</Badge>;
            case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
            case 'pending-confirmation': return <Badge variant="destructive" className="bg-orange-100 text-orange-800">Pendente</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };
    
    const isAnamnesisComplete = (customer: Customer | undefined): boolean => {
        if (!customer || !customer.anamnesisAnswers || customer.anamnesisAnswers.length === 0) {
            return false;
        }
        return customer.anamnesisAnswers.every(item => {
            if (item.answer === null || item.answer === '') {
                return false;
            }
            if (typeof item.answer === 'object' && item.answer.choice === null) {
                return false;
            }
            return true;
        });
    }

    return (
        <ScrollArea className="h-[70vh] w-full">
            <div className="relative">
                {/* Time slots */}
                <div className="grid">
                    {hours.map(hour => (
                        <div key={hour} className="relative h-[60px] border-t border-muted">
                            <span className="absolute -top-3 left-2 text-xs text-muted-foreground">{format(setHours(new Date(), hour), 'HH:mm')}</span>
                        </div>
                    ))}
                </div>

                {/* Appointments */}
                <div className="absolute top-0 left-12 right-0 bottom-0">
                    {appointments.map(app => {
                        const top = getPosition(app.start);
                        const height = getPosition(app.end) - top;
                        const customer = customers.find(c => c.id === app.customerId);
                        const anamnesisDone = isAnamnesisComplete(customer);

                        return (
                            <Card key={app.id}
                                className="absolute w-[calc(100%-1rem)] p-3 overflow-hidden"
                                style={{ top: `${top}px`, height: `${height}px`, minHeight: '40px' }}
                            >
                                <div className="flex justify-between items-start gap-2 h-full">
                                    <div className="space-y-1 flex-grow overflow-hidden">
                                        <CardTitle className="text-sm truncate">{app.serviceName}</CardTitle>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Users className="h-3 w-3" />
                                            <span className="truncate">{app.customerName}</span>
                                        </div>
                                         <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Briefcase className="h-3 w-3" />
                                            <span className="truncate">{app.professionalName}</span>
                                        </div>
                                        {!anamnesisDone && (
                                            <div className="flex items-center gap-1 text-yellow-600 text-xs">
                                                <AlertTriangle className="h-3 w-3"/>
                                                <span>Anamnese pendente</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        {getStatusBadge(app.status)}
                                         <div className="flex items-center gap-1">
                                            {app.status === 'pending-confirmation' && can.edit ? (
                                                <Button size="sm" className="h-7" onClick={() => onEdit(app)}>
                                                    <Check className="mr-1 h-3 w-3" />
                                                    Confirmar
                                                </Button>
                                            ) : can.edit ? (
                                                <Button
                                                    size="sm"
                                                    className="h-7"
                                                    variant={app.attendanceId ? "outline" : "default"}
                                                    onClick={() => onStartAttendance(app)}
                                                    disabled={app.status !== 'scheduled'}
                                                >
                                                    <PlayCircle className="mr-1 h-3 w-3" />
                                                    {app.attendanceId ? 'Ver' : 'Iniciar'}
                                                </Button>
                                            ) : null}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {can.edit && <DropdownMenuItem onClick={() => onEdit(app)}>Editar</DropdownMenuItem>}
                                                    {can.edit && <DropdownMenuItem onClick={() => onReschedule(app)}>
                                                        <RefreshCw className="mr-2 h-4 w-4" />
                                                        Reagendar
                                                    </DropdownMenuItem>}
                                                    {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(app.id)}>Excluir</DropdownMenuItem>}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </ScrollArea>
    )
}

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<User[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Partial<Appointment> | undefined>(undefined);
    const [selectedDay, setSelectedDay] = useState<Date>(new Date());

    const { toast } = useToast();
    const { user, currentBranch } = useAuth();
    const router = useRouter();

    const can = useMemo(() => ({
        edit: user?.enabledModules?.appointments?.edit ?? false,
        delete: user?.enabledModules?.appointments?.delete ?? false,
    }), [user]);
    
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
    
    const handleStatusChange = async (appointmentId: string, status: AppointmentStatus) => {
        try {
            await updateDoc(doc(db, "appointments", appointmentId), { status });
            toast({ title: 'Status atualizado!' });
        } catch (error) {
            toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
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

    const handleStartAttendance = async (app: Appointment) => {
        if (!user || !currentBranch) return;

        if (app.attendanceId) {
            router.push(`/dashboard/attendance/${app.attendanceId}`);
            return;
        }

        const batch = writeBatch(db);
        const attendanceRef = doc(collection(db, 'attendances'));
        const appointmentRef = doc(db, 'appointments', app.id);
        const service = services.find(s => s.id === app.serviceId);

        const newAttendance: Omit<Attendance, 'id'> = {
            organizationId: user.organizationId,
            branchId: currentBranch.id,
            appointmentId: app.id,
            customerId: app.customerId,
            customerName: app.customerName,
            professionalId: app.professionalId,
            professionalName: app.professionalName,
            date: serverTimestamp(),
            items: service ? [{
                id: service.id,
                name: service.name,
                type: 'service',
                quantity: 1,
                price: service.price,
                total: service.price
            }] : [],
            photos: [],
            status: 'in-progress',
            paymentStatus: 'pending',
            total: service?.price || 0,
        };

        batch.set(attendanceRef, newAttendance);
        batch.update(appointmentRef, { attendanceId: attendanceRef.id });

        try {
            await batch.commit();
            router.push(`/dashboard/attendance/${attendanceRef.id}`);
        } catch (error) {
            console.error("Failed to start attendance:", error);
            toast({ title: 'Erro ao iniciar atendimento', variant: 'destructive' });
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
    
    const handleReschedule = (app: Appointment) => {
        handleStatusChange(app.id, 'rescheduled');
        setEditingAppointment({
            customerId: app.customerId,
            serviceId: app.serviceId,
            professionalId: app.professionalId,
        });
        setIsFormOpen(true);
    }
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Calendar className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">Agendamentos</h1>
                        <p className="text-muted-foreground">
                            Visualize e gerencie os agendamentos da sua filial.
                        </p>
                    </div>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                             <Button variant="outline">
                                <Calendar className="mr-2 h-4 w-4" />
                                {format(selectedDay, 'dd/MM/yyyy')}
                             </Button>
                        </PopoverTrigger>
                         <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                                mode="single"
                                selected={selectedDay}
                                onSelect={(day) => day && setSelectedDay(day)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    {can.edit && (
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
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Agenda do Dia - {format(selectedDay, 'dd/MM/yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-[60vh] w-full" />
                    ) : appointmentsForSelectedDay.length > 0 ? (
                        <DayView
                            appointments={appointmentsForSelectedDay}
                            onEdit={openEditDialog}
                            onStartAttendance={handleStartAttendance}
                            onReschedule={handleReschedule}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            customers={customers}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                            Nenhum agendamento para este dia.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
