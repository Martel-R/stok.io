
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Customer } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CustomerProfilePage() {
    const { user, updateUserProfile } = useAuth();
    const { toast } = useToast();
    const [customerData, setCustomerData] = useState<Partial<Customer>>({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user?.customerId) {
            const customerRef = doc(db, 'customers', user.customerId);
            getDoc(customerRef).then(docSnap => {
                if (docSnap.exists()) {
                    setCustomerData({ id: docSnap.id, ...docSnap.data() });
                }
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCustomerData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerData.id) return;
        setIsSaving(true);
        try {
            // Update the user's name in both Auth and Firestore user collection
            await updateUserProfile({ name: customerData.name });
            
            // Update customer collection data
            const customerRef = doc(db, 'customers', customerData.id);
            const { id, userId, organizationId, ...dataToSave } = customerData;
            await updateDoc(customerRef, dataToSave);
            
            toast({ title: 'Perfil atualizado com sucesso!' });
        } catch (error) {
            toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-24" />
                </CardFooter>
            </Card>
        );
    }
    
    if (!customerData.id) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Perfil não encontrado</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Não foi possível encontrar os dados do seu perfil de cliente.</p>
                </CardContent>
             </Card>
        )
    }

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Meu Perfil</CardTitle>
                    <CardDescription>Atualize suas informações de contato.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="name">Nome Completo</Label>
                            <Input id="name" name="name" value={customerData.name || ''} onChange={handleChange} required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                            <Input id="cpfCnpj" name="cpfCnpj" value={customerData.cpfCnpj || ''} onChange={handleChange} required />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" value={customerData.email || ''} onChange={handleChange} required disabled />
                             <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" name="phone" value={customerData.phone || ''} onChange={handleChange} required />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="address">Endereço</Label>
                        <Input id="address" name="address" value={customerData.address || ''} onChange={handleChange} required />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 animate-spin" />}
                        Salvar Alterações
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
