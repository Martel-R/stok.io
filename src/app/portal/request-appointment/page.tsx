
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import type { Service, User, Appointment } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { format, setHours, setMinutes } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function RequestAppointmentPage() {
    const { user, branches } = useAuth();
    const { toast } = useToast();
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
    const [preferredDate, setPreferredDate] = useState<Date | undefined>(new Date());
    const [preferredTime, setPreferredTime] = useState('09:00');
    const [notes, setNotes] = useState('');

    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const availableProfessionals = useMemo(() => {
        if (!selectedService) return [];
        return professionals.filter(p => selectedService.professionalIds.includes(p.id));
    }, [selectedService, professionals]);

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        const servicesQuery = query(collection(db, 'services'), where('organizationId', '==', user.organizationId), where('isActive', '==', true));
        const profsQuery = query(collection(db, 'users'), where('organizationId', '==', user.organizationId), where('role', '==', 'professional'));

        const unsubServices = onSnapshot(servicesQuery, snap => {
            setServices(snap.docs.map(d => ({id: d.id, ...d.data()}) as Service));
        });
        const unsubProfs = onSnapshot(profsQuery, snap => {
            setProfessionals(snap.docs.map(d => ({id: d.id, ...d.data()}) as User));
        });

        setLoading(false);
        return () => {
            unsubServices();
            unsubProfs();
        };

    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (!user || !user.customerId || !branches.length || !selectedService || !selectedProfessionalId || !preferredDate) {
            toast({ title: "Dados incompletos", description: "Por favor, preencha todos os campos obrigatórios.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        const professional = professionals.find(p => p.id === selectedProfessionalId);
        const [hours, minutes] = preferredTime.split(':').map(Number);
        const startDate = setHours(setMinutes(preferredDate, minutes), hours);
        const endDate = setHours(setMinutes(preferredDate, minutes + selectedService.duration), hours);

        const newAppointment: Omit<Appointment, 'id'> = {
            organizationId: user.organizationId,
            branchId: branches[0].id, // Defaulting to the first branch of the org. A selector could be added if needed.
            customerId: user.customerId,
            customerName: user.name,
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            professionalId: selectedProfessionalId,
            professionalName: professional?.name || 'Não encontrado',
            start: startDate,
            end: endDate,
            status: 'pending-confirmation',
            notes: `Solicitado pelo cliente. Observações: ${notes}`,
        };

        try {
            await addDoc(collection(db, 'appointments'), newAppointment);
            toast({ title: "Solicitação enviada!", description: "Sua solicitação de agendamento foi enviada. Aguarde a confirmação da clínica." });
            // Reset form
            setSelectedServiceId('');
            setSelectedProfessionalId('');
            setPreferredDate(new Date());
            setPreferredTime('09:00');
            setNotes('');
        } catch (error) {
            toast({ title: "Erro ao enviar solicitação", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Solicitar um Agendamento</CardTitle>
                    <CardDescription>
                        Preencha o formulário abaixo para solicitar um novo horário. A clínica entrará em contato para confirmar.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label>Serviço Desejado</Label>
                        <Select value={selectedServiceId} onValueChange={setSelectedServiceId} required>
                            <SelectTrigger><SelectValue placeholder="Selecione um serviço..." /></SelectTrigger>
                            <SelectContent>
                                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} - R$ {s.price.toFixed(2)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Profissional de Preferência</Label>
                        <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId} required disabled={!selectedService}>
                            <SelectTrigger><SelectValue placeholder="Selecione um profissional..." /></SelectTrigger>
                            <SelectContent>
                                {availableProfessionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Data de Preferência</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {preferredDate ? format(preferredDate, 'dd/MM/yyyy') : <span>Escolha uma data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={preferredDate} onSelect={setPreferredDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Hora Aproximada</Label>
                            <Input type="time" value={preferredTime} onChange={e => setPreferredTime(e.target.value)} required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observações (Opcional)</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alguma informação adicional para o profissional?"/>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting || loading}>
                        {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                        Enviar Solicitação
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
