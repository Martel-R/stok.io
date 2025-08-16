

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, Timestamp, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import type { Appointment, Customer, Service, User, AppointmentStatus, Attendance, AnamnesisAnswer, PermissionProfile, AttendanceItem, Product } from '@/lib/types';
import { MoreHorizontal, PlusCircle, Calendar, Users, Briefcase, Check, ChevronsUpDown, Clock, RefreshCw, PlayCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addMinutes, setHours, setMinutes, startOfDay, endOfDay, isSameDay, getHours, getMinutes, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, parse, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent, DragOverlay } from '@dnd-kit/core';


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
    const { user, currentBranch } = useAuth();
    
    const getDefaultState = () => ({
        start: setHours(setMinutes(initialDate, 0), 9),
        status: 'scheduled' as AppointmentStatus,
        notes: '',
        branchId: currentBranch?.id,
        organizationId: user?.organizationId,
    });
    
    const [formData, setFormData] = useState<Partial<Appointment>>(appointment || getDefaultState());
    
    const [selectedService, setSelectedService] = useState<Service | null>(() => {
        if (appointment && appointment.serviceId) {
            return services.find(s => s.id === appointment.serviceId) || null;
        }
        return null;
    });

    const availableProfessionals = useMemo(() => {
        if (!selectedService) return [];
        return professionals.filter(p => selectedService.professionalIds.includes(p.id));
    }, [selectedService, professionals]);

    const handleDateChange = (date: Date | undefined) => {
        if (!date) return;
        const currentStartTime = formData.start || new Date();
        const newDate = setHours(setMinutes(date, getMinutes(currentStartTime)), getHours(currentStartTime));
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
                                {formData.start ? format(formData.start, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
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

const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
        case 'scheduled': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Agendado</Badge>;
        case 'completed': return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
        case 'cancelled': return <Badge variant="outline">Cancelado</Badge>;
        case 'rescheduled': return <Badge className="bg-purple-100 text-purple-800">Reagendado</Badge>;
        case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
        case 'pending-confirmation': return <Badge className="bg-orange-100 text-orange-800">Pendente</Badge>;
        default: return <Badge>{status}</Badge>;
    }
};

const isAnamnesisComplete = (customer: Customer | undefined): boolean => {
    if (!customer || !customer.anamnesisAnswers || customer.anamnesisAnswers.length === 0) return false;
    return customer.anamnesisAnswers.every(item => {
        if (item.answer === null || item.answer === '') return false;
        if (typeof item.answer === 'object' && item.answer.choice === null) return false;
        return true;
    });
}

function DraggableAppointment({ appointment, customers, onEdit, onStartAttendance, onReschedule, onDelete, style, isDragging }: {
    appointment: Appointment;
    customers: Customer[];
    onEdit: (app: Appointment) => void;
    onStartAttendance: (app: Appointment) => void;
    onReschedule: (app: Appointment) => void;
    onDelete: (id: string) => void;
    style: React.CSSProperties;
    isDragging: boolean;
}) {
    const { user } = useAuth();
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: appointment.id,
        data: appointment,
        disabled: user?.enabledModules?.appointments?.edit === false
    });
    
    const draggableStyle = transform ? {
        ...style,
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 10,
    } : style;
    
    const customer = customers.find(c => c.id === appointment.customerId);
    const anamnesisDone = isAnamnesisComplete(customer);

    const can = useMemo(() => ({
        edit: user?.enabledModules?.appointments?.edit ?? false,
        delete: user?.enabledModules?.appointments?.delete ?? false,
    }), [user]);

    return (
        <Card
            ref={setNodeRef}
            style={draggableStyle}
            {...listeners}
            {...attributes}
            className={cn("absolute w-[calc(100%-0.5rem)] ml-2 p-3 overflow-hidden cursor-grab", isDragging && "opacity-50")}
        >
            <div className="flex justify-between items-start gap-2 h-full" onClick={() => onEdit(appointment)}>
                <div className="space-y-1 flex-grow overflow-hidden">
                    <CardTitle className="text-sm truncate">{appointment.serviceName}</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" /><span className="truncate">{appointment.customerName}</span></div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Briefcase className="h-3 w-3" /><span className="truncate">{appointment.professionalName}</span></div>
                    {!anamnesisDone && <div className="flex items-center gap-1 text-yellow-600 text-xs"><AlertTriangle className="h-3 w-3"/><span>Anamnese pendente</span></div>}
                </div>
                <div className="flex flex-col items-end justify-between h-full shrink-0" onClick={(e) => e.stopPropagation()}>
                    {getStatusBadge(appointment.status)}
                    <div className="flex items-center gap-1 mt-1">
                        {appointment.status === 'pending-confirmation' && can.edit ? (
                            <Button size="sm" className="h-7" onClick={() => onEdit(appointment)}><Check className="mr-1 h-3 w-3" />Confirmar</Button>
                        ) : can.edit ? (
                            <Button size="sm" className="h-7" variant={appointment.attendanceId ? "outline" : "default"} onClick={() => onStartAttendance(appointment)} disabled={appointment.status !== 'scheduled'}><PlayCircle className="mr-1 h-3 w-3" />{appointment.attendanceId ? 'Ver' : 'Iniciar'}</Button>
                        ) : null}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {can.edit && <DropdownMenuItem onClick={() => onEdit(appointment)}>Editar</DropdownMenuItem>}
                                {can.edit && <DropdownMenuItem onClick={() => onReschedule(appointment)}><RefreshCw className="mr-2 h-4 w-4" />Reagendar</DropdownMenuItem>}
                                {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(appointment.id)}>Excluir</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function DayView({ appointments, date, onEdit, onStartAttendance, onReschedule, onDelete, onUpdateAppointmentTime, customers }: { 
    appointments: Appointment[];
    date: Date;
    onEdit: (app: Appointment) => void;
    onStartAttendance: (app: Appointment) => void;
    onReschedule: (app: Appointment) => void;
    onDelete: (id: string) => void;
    onUpdateAppointmentTime: (id: string, newStart: Date) => void;
    customers: Customer[];
}) {
    const hourHeight = 60; // 60px per hour
    const startHour = 0;
    const endHour = 23;
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
    const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

    const getPosition = (d: Date) => ((getHours(d) - startHour) * 60 + getMinutes(d)) / 60 * hourHeight;
    
    const appointmentsForDay = useMemo(() => appointments.filter(app => isSameDay(app.start, date)), [appointments, date]);
    
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const appointment = appointments.find(a => a.id === active.id);
        if (appointment) setActiveAppointment(appointment);
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta } = event;
        setActiveAppointment(null);
        const appointment = active.data.current as Appointment | undefined;
        if (!appointment) return;

        const currentTop = getPosition(appointment.start);
        const newTop = Math.max(0, currentTop + delta.y);

        const minutesFromTop = (newTop / hourHeight) * 60;
        
        const snappedMinutes = Math.round(minutesFromTop / 15) * 15;
        
        const newHour = Math.floor(snappedMinutes / 60) + startHour;
        const newMinute = snappedMinutes % 60;

        const newStartDate = setHours(setMinutes(appointment.start, newMinute), newHour);
        
        onUpdateAppointmentTime(appointment.id, newStartDate);
    };

    const handleDragCancel = () => {
        setActiveAppointment(null);
    };
    
    return (
        <Card>
            <CardHeader><CardTitle>Agenda do Dia - {format(date, 'dd/MM/yyyy')}</CardTitle></CardHeader>
            <CardContent>
                <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
                    <ScrollArea className="h-[70vh] w-full">
                        <div className="relative flex">
                            <div className="w-16 flex-shrink-0 text-right pr-2">
                               {hours.map(hour => (
                                    <div key={hour} className="relative h-[60px] border-t border-muted first:border-t-0">
                                        <span className="text-xs text-muted-foreground absolute -top-[9px] right-2 bg-background px-1">{format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm')}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="relative flex-grow">
                                <div className="grid absolute inset-0">
                                    {hours.map(hour => (
                                        <div key={hour} className="h-[60px] border-t border-muted first:border-t-0"></div>
                                    ))}
                                </div>
                                <div className="absolute inset-0">
                                    {appointmentsForDay.map(app => {
                                        const top = getPosition(app.start);
                                        const height = Math.max(getPosition(app.end) - top, 40);
                                        return (
                                            <DraggableAppointment
                                                key={app.id}
                                                appointment={app}
                                                customers={customers}
                                                onEdit={onEdit}
                                                onStartAttendance={onStartAttendance}
                                                onReschedule={onReschedule}
                                                onDelete={onDelete}
                                                style={{ top: `${top}px`, minHeight: '40px', height: `${height}px` }}
                                                isDragging={activeAppointment?.id === app.id}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <DragOverlay>
                        {activeAppointment ? (
                             <Card className="p-3 overflow-hidden cursor-grabbing w-full h-full">
                                <div className="flex justify-between items-start gap-2 h-full">
                                    <div className="space-y-1 flex-grow overflow-hidden">
                                        <CardTitle className="text-sm truncate">{activeAppointment.serviceName}</CardTitle>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" /><span className="truncate">{activeAppointment.customerName}</span></div>
                                    </div>
                                </div>
                            </Card>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </CardContent>
        </Card>
    )
}

function WeekView({ appointments, date, onEdit, onStartAttendance, onReschedule, onDelete, onUpdateAppointmentTime, customers }: { 
    appointments: Appointment[];
    date: Date;
    onEdit: (app: Appointment) => void;
    onStartAttendance: (app: Appointment) => void;
    onReschedule: (app: Appointment) => void;
    onDelete: (id: string) => void;
    onUpdateAppointmentTime: (id: string, newStart: Date) => void;
    customers: Customer[];
}) {
    const start = startOfWeek(date, { locale: ptBR });
    const end = endOfWeek(date, { locale: ptBR });
    const days = eachDayOfInterval({ start, end });
    const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const appointment = appointments.find(a => a.id === active.id);
        if (appointment) setActiveAppointment(appointment);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveAppointment(null);

        if (!over || !active.data.current) return;

        const appointment = active.data.current as Appointment;
        const newDate = over.data.current?.date as Date;

        if (newDate && !isSameDay(appointment.start, newDate)) {
            const newStart = setHours(setMinutes(newDate, getMinutes(appointment.start)), getHours(appointment.start));
            onUpdateAppointmentTime(appointment.id, newStart);
        }
    };
    
    const { user } = useAuth();
    const canEdit = user?.enabledModules?.appointments?.edit ?? false;
    
    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveAppointment(null)}>
            <div className="grid grid-cols-7 border-t border-l">
                {days.map(day => (
                    <DroppableDay key={day.toString()} date={day}>
                        <h3 className="text-center font-semibold py-2 border-b">{format(day, 'EEE dd', { locale: ptBR })}</h3>
                        <ScrollArea className="h-[70vh]">
                        <div className="p-2 space-y-2">
                            {appointments.filter(a => isSameDay(a.start, day)).map(app => (
                                <DraggableWeekAppointment 
                                    key={app.id} 
                                    appointment={app}
                                    onEdit={onEdit}
                                    onStartAttendance={onStartAttendance}
                                    onReschedule={onReschedule}
                                    onDelete={onDelete}
                                    disabled={!canEdit}
                                    isDragging={activeAppointment?.id === app.id}
                                />
                            ))}
                        </div>
                        </ScrollArea>
                    </DroppableDay>
                ))}
            </div>
            <DragOverlay>
                {activeAppointment ? <DraggableWeekAppointment appointment={activeAppointment} onEdit={()=>{}} onStartAttendance={()=>{}} onReschedule={()=>{}} onDelete={()=>{}} disabled={true} isDragging={true}/> : null}
            </DragOverlay>
        </DndContext>
    );
}

function DroppableDay({ date, children }: { date: Date, children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({
        id: `week-day-${format(date, 'yyyy-MM-dd')}`,
        data: { date }
    });
    return (
        <div ref={setNodeRef} className="border-r border-b">
            {children}
        </div>
    );
}

function DraggableWeekAppointment({ appointment, onEdit, onStartAttendance, onReschedule, onDelete, disabled, isDragging }: {
    appointment: Appointment;
    onEdit: (app: Appointment) => void;
    onStartAttendance: (app: Appointment) => void;
    onReschedule: (app: Appointment) => void;
    onDelete: (id: string) => void;
    disabled: boolean;
    isDragging: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: appointment.id,
        data: appointment,
        disabled,
    });

    const style = transform && isDragging ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined;
    const { user } = useAuth();
    const can = useMemo(() => ({
        edit: user?.enabledModules?.appointments?.edit ?? false,
        delete: user?.enabledModules?.appointments?.delete ?? false,
    }), [user]);

    return (
        <Card ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn("p-2 cursor-grab", isDragging && 'opacity-50')}>
            <p className="font-bold text-xs truncate">{appointment.serviceName}</p>
            <p className="text-xs text-muted-foreground truncate">{appointment.customerName}</p>
            <p className="text-xs text-muted-foreground">{format(appointment.start, 'HH:mm')}</p>
            {getStatusBadge(appointment.status)}
            <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                {appointment.status === 'pending-confirmation' && can.edit ? (
                    <Button size="sm" className="h-6 px-2 text-xs" onClick={() => onEdit(appointment)}>Confirmar</Button>
                ) : can.edit ? (
                    <Button size="sm" className="h-6 px-2 text-xs" variant={appointment.attendanceId ? "outline" : "default"} onClick={() => onStartAttendance(appointment)} disabled={appointment.status !== 'scheduled'}>
                        {appointment.attendanceId ? 'Ver' : 'Iniciar'}
                    </Button>
                ) : null}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {can.edit && <DropdownMenuItem onClick={() => onEdit(appointment)}>Editar</DropdownMenuItem>}
                        {can.edit && <DropdownMenuItem onClick={() => onReschedule(appointment)}>Reagendar</DropdownMenuItem>}
                        {can.delete && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(appointment.id)}>Excluir</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </Card>
    );
}


function MonthView({ appointments, date, setDate, setViewMode }: { 
    appointments: Appointment[];
    date: Date;
    setDate: (d: Date) => void;
    setViewMode: (v: 'day' | 'week' | 'month') => void;
}) {
    return (
         <CalendarComponent
            mode="single"
            selected={date}
            onSelect={(day) => { if(day) { setDate(day); setViewMode('day'); }}}
            className="rounded-md border"
            components={{
                DayContent: ({ date: d }) => {
                    const dayAppointments = appointments.filter(a => isSameDay(a.start, d));
                    return (
                        <div className="relative h-full w-full">
                            <span className="absolute top-1 right-1">{format(d, 'd')}</span>
                            {dayAppointments.length > 0 && 
                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                    {dayAppointments.length}
                                </div>
                            }
                        </div>
                    )
                }
            }}
        />
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
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');


    const { toast } = useToast();
    const { user, currentBranch } = useAuth();
    const router = useRouter();

    const can = useMemo(() => ({
        view: user?.enabledModules?.appointments?.view ?? false,
        edit: user?.enabledModules?.appointments?.edit ?? false,
        delete: user?.enabledModules?.appointments?.delete ?? false,
    }), [user]);
    
    const convertAppointmentDate = (docData: any): Appointment => {
        const convert = (field: any) => field instanceof Timestamp ? field.toDate() : new Date();
        return { ...docData, id: docData.id, start: convert(docData.start), end: convert(docData.end) } as Appointment;
    };

    useEffect(() => {
        if (!user?.organizationId || !currentBranch) {
            setLoading(false);
            return;
        }

        const unsubscribers: (() => void)[] = [];

        const customerQuery = query(collection(db, 'customers'), where('organizationId', '==', user.organizationId));
        unsubscribers.push(onSnapshot(customerQuery, snap => setCustomers(snap.docs.map(d => ({id: d.id, ...d.data()}) as Customer))));

        const serviceQuery = query(collection(db, 'services'), where('organizationId', '==', user.organizationId));
        unsubscribers.push(onSnapshot(serviceQuery, snap => setServices(snap.docs.map(d => ({id: d.id, ...d.data()}) as Service))));

        const appointmentQuery = query(collection(db, 'appointments'), where('branchId', '==', currentBranch.id));
        unsubscribers.push(onSnapshot(appointmentQuery, snap => setAppointments(snap.docs.map(d => convertAppointmentDate({id: d.id, ...d.data()})))));

        const fetchProfessionals = async () => {
            const profilesQuery = query(collection(db, 'permissionProfiles'), where("organizationId", "==", user.organizationId), where("name", "==", "Profissional"));
            const profileSnap = await getDocs(profilesQuery);

            if (!profileSnap.empty) {
                const professionalProfileId = profileSnap.docs[0].id;
                const professionalsQuery = query(collection(db, 'users'), where("organizationId", "==", user.organizationId), where("role", "==", professionalProfileId));
                const unsubProfs = onSnapshot(professionalsQuery, snap => setProfessionals(snap.docs.map(d => ({id: d.id, ...d.data()}) as User)));
                unsubscribers.push(unsubProfs);
            } else {
                console.warn("Perfil 'Profissional' não encontrado. Nenhum profissional será carregado.");
                setProfessionals([]);
            }
            setLoading(false);
        };
        
        fetchProfessionals();

        return () => unsubscribers.forEach(unsub => unsub());

    }, [user, currentBranch]);

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

    const handleUpdateAppointmentTime = async (id: string, newStart: Date) => {
        const appointment = appointments.find(a => a.id === id);
        if (!appointment) return;

        const duration = (appointment.end.getTime() - appointment.start.getTime()) / (1000 * 60); // duration in minutes
        const newEnd = addMinutes(newStart, duration);

        try {
            await updateDoc(doc(db, "appointments", id), { start: newStart, end: newEnd });
            toast({ title: 'Agendamento reagendado!' });
        } catch (error) {
            toast({ title: 'Erro ao reagendar', variant: 'destructive' });
        }
    }
    
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

        const items: AttendanceItem[] = [];
        if (service) {
            items.push({ id: service.id, name: service.name, type: 'service', quantity: 1, price: service.price, total: service.price });
            if(service.linkedProducts && service.linkedProducts.length > 0) {
                const productDocs = await getDocs(query(collection(db, 'products'), where('branchId', '==', currentBranch.id)));
                const branchProducts = productDocs.docs.map(d => ({id: d.id, ...d.data()}) as Product);

                service.linkedProducts.forEach(lp => {
                    const product = branchProducts.find(p => p.id === lp.productId);
                    if (product) {
                        items.push({
                            id: product.id,
                            name: product.name,
                            type: 'product',
                            quantity: lp.quantity,
                            price: product.price,
                            total: product.price * lp.quantity
                        });
                    }
                });
            }
        }
        const total = items.reduce((acc, item) => acc + item.total, 0);

        const newAttendance: Omit<Attendance, 'id'> = {
            organizationId: user.organizationId,
            branchId: currentBranch.id,
            appointmentId: app.id,
            customerId: app.customerId,
            customerName: app.customerName,
            professionalId: app.professionalId,
            professionalName: app.professionalName,
            date: serverTimestamp(),
            items,
            photos: [],
            status: 'in-progress',
            paymentStatus: 'pending',
            total,
        };
        batch.set(attendanceRef, newAttendance);
        batch.update(appointmentRef, { attendanceId: attendanceRef.id, status: 'completed' });
        
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
        setEditingAppointment({ customerId: app.customerId, serviceId: app.serviceId, professionalId: app.professionalId });
        setIsFormOpen(true);
    }
    
     const handleDateNav = (direction: 'prev' | 'next') => {
        const amount = direction === 'prev' ? -1 : 1;
        if (viewMode === 'day') setCurrentDate(d => addDays(d, amount));
        if (viewMode === 'week') setCurrentDate(d => addDays(d, amount * 7));
        if (viewMode === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + amount, 1));
    };

    const currentTitle = useMemo(() => {
        if (viewMode === 'day') return format(currentDate, 'PPP', { locale: ptBR });
        if (viewMode === 'week') {
            const start = startOfWeek(currentDate, { locale: ptBR });
            const end = endOfWeek(currentDate, { locale: ptBR });
            if (isSameMonth(start, end)) {
                 return format(start, 'MMMM yyyy', { locale: ptBR });
            }
            return `${format(start, 'MMM', { locale: ptBR })} - ${format(end, 'MMM yyyy', { locale: ptBR })}`;
        }
        if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    }, [viewMode, currentDate]);


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => handleDateNav('prev')}><ChevronLeft/></Button>
                    <h2 className="text-xl font-bold w-48 text-center">{currentTitle}</h2>
                    <Button variant="ghost" size="icon" onClick={() => handleDateNav('next')}><ChevronRight/></Button>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as any)}>
                        <ToggleGroupItem value="day">Dia</ToggleGroupItem>
                        <ToggleGroupItem value="week">Semana</ToggleGroupItem>
                        <ToggleGroupItem value="month">Mês</ToggleGroupItem>
                    </ToggleGroup>
                    {can.edit && (
                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={openNewDialog}><PlusCircle className="mr-2 h-4 w-4" /> Novo Agendamento</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl">
                                <DialogHeader><DialogTitle>{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle></DialogHeader>
                                <AppointmentForm
                                    key={editingAppointment?.id || 'new'}
                                    appointment={editingAppointment}
                                    customers={customers}
                                    services={services}
                                    professionals={professionals}
                                    onSave={handleSave}
                                    onDone={() => setIsFormOpen(false)}
                                    initialDate={currentDate}
                                />
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {loading ? <Skeleton className="h-[70vh] w-full"/> : (
                <>
                    {viewMode === 'day' && <DayView 
                        appointments={appointments}
                        date={currentDate}
                        onEdit={openEditDialog}
                        onStartAttendance={handleStartAttendance}
                        onReschedule={handleReschedule}
                        onDelete={handleDelete}
                        onUpdateAppointmentTime={handleUpdateAppointmentTime}
                        customers={customers}
                    />}
                    {viewMode === 'week' && <WeekView
                         appointments={appointments}
                         date={currentDate}
                         onEdit={openEditDialog}
                         onStartAttendance={handleStartAttendance}
                         onReschedule={handleReschedule}
                         onDelete={handleDelete}
                         onUpdateAppointmentTime={handleUpdateAppointmentTime}
                         customers={customers}
                    />}
                    {viewMode === 'month' && <MonthView 
                        appointments={appointments}
                        date={currentDate}
                        setDate={setCurrentDate}
                        setViewMode={setViewMode}
                    />}
                </>
            )}
        </div>
    )
}

