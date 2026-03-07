'use client';
import React, { useState, useRef, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, BellRing } from 'lucide-react';

interface SupervisorAuthorizationDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAuthorized: (supervisorId: string, supervisorName: string) => void;
    actionDescription: string;
    permissionRequired: 'canAuthorizeCashClose' | 'canAuthorizeCartItemRemoval' | 'canAuthorizeCartClear' | 'canAuthorizeCashAdjustment';
    requesterName?: string;
    itemName?: string;
    totalAmount?: number;
}

export function SupervisorAuthorizationDialog({
    isOpen,
    onOpenChange,
    onAuthorized,
    actionDescription,
    permissionRequired,
    requesterName,
    itemName,
    totalAmount
}: SupervisorAuthorizationDialogProps) {
    const { user } = useAuth();
    const [pin, setPin] = useState(['', '', '', '', '', '']);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isSendingNotification, setIsSendingNotification] = useState(false);
    const [requestId, setRequestId] = useState<string | null>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setPin(['', '', '', '', '', '']);
            setRequestId(null);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    // Listener for remote approval
    useEffect(() => {
        if (!requestId || !isOpen) return;

        const unsub = onSnapshot(doc(db, 'requests', requestId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.status === 'approved') {
                    toast({ title: 'Aprovação Remota Recebida!', description: `Autorizado por ${data.supervisorName}` });
                    onAuthorized(data.supervisorId, data.supervisorName);
                    onOpenChange(false);
                } else if (data.status === 'rejected') {
                    toast({ title: 'Aprovação Negada', description: 'O supervisor negou a solicitação.', variant: 'destructive' });
                    setRequestId(null);
                    setIsSendingNotification(false);
                }
            }
        });

        return () => unsub();
    }, [requestId, isOpen, onAuthorized, onOpenChange, toast]);

    const handlePinChange = (index: number, value: string) => {
        if (value && !/^\d$/.test(value.slice(-1))) return;
        
        const lastDigit = value.slice(-1);
        const newPin = [...pin];
        newPin[index] = lastDigit;
        setPin(newPin);

        if (lastDigit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        if (index === 5 && lastDigit) {
            const fullPin = newPin.join('');
            if (fullPin.length === 6) {
                handleValidate(fullPin);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleRequestApproval = async () => {
        if (!user) return;
        
        setIsSendingNotification(true);
        try {
            const docRef = await addDoc(collection(db, 'requests'), {
                organizationId: user.organizationId,
                requesterId: user.id,
                requesterName: requesterName || user.name,
                requestType: 'SupervisorApproval',
                actionDescription,
                itemName: itemName || 'N/A',
                totalAmount: totalAmount || 0,
                status: 'pending',
                createdAt: serverTimestamp(),
                permissionRequired
            });

            setRequestId(docRef.id);
            toast({ 
                title: 'Solicitação Enviada', 
                description: 'Aguarde a aprovação do supervisor.' 
            });
        } catch (error) {
            console.error("Error sending approval request:", error);
            toast({ title: 'Erro ao enviar solicitação', variant: 'destructive' });
            setIsSendingNotification(false);
        }
    };

    const handleValidate = async (fullPin: string) => {
        if (!user || fullPin.length < 6) return;

        setIsVerifying(true);
        try {
            // 1. Find user by PIN and Organization
            const q = query(
                collection(db, 'users'),
                where('organizationId', '==', user.organizationId),
                where('supervisorPin', '==', fullPin)
            );

            const snap = await getDocs(q);
            
            if (snap.empty) {
                toast({ title: 'PIN Inválido', variant: 'destructive' });
                setIsVerifying(false);
                setPin(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
                return;
            }

            const supervisorDoc = snap.docs[0];
            const supervisorData = supervisorDoc.data();
            
            // 2. Resolve Permissions
            let permissions = supervisorData.enabledModules;

            // If user has a role that is an ID to a profile
            if (supervisorData.role && !permissions) {
                const profileDoc = await getDoc(doc(db, 'permissionProfiles', supervisorData.role));
                if (profileDoc.exists()) {
                    permissions = profileDoc.data().permissions;
                }
            }

            // 3. Final Check: Strictly by the permission profile found
            const isAuthorized = permissions?.pos?.delete === true;

            if (!isAuthorized) {
                toast({ 
                    title: 'Acesso Negado', 
                    description: `${supervisorData.name} não possui permissão de exclusão no PDV.`, 
                    variant: 'destructive' 
                });
                setIsVerifying(false);
                setPin(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
                return;
            }
            
            toast({ title: 'Autorizado!', description: `Ação autorizada por ${supervisorData.name}.` });
            onAuthorized(supervisorDoc.id, supervisorData.name);
            onOpenChange(false);
        } catch (error) {
            console.error("Authorization error:", error);
            toast({ title: 'Erro na autorização', variant: 'destructive' });
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Autorização
                    </DialogTitle>
                    <DialogDescription>
                        {actionDescription}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center gap-2 py-8">
                    {pin.map((digit, idx) => (
                        <Input
                            key={idx}
                            ref={el => { inputRefs.current[idx] = el; }}
                            type="password"
                            inputMode="numeric"
                            value={digit}
                            onChange={e => handlePinChange(idx, e.target.value)}
                            onKeyDown={e => handleKeyDown(idx, e)}
                            className="w-12 h-14 text-center text-2xl font-bold p-0"
                            disabled={isVerifying || isSendingNotification}
                            autoComplete="one-time-code"
                        />
                    ))}
                </div>
                <div className="flex flex-col items-center gap-2">
                    {isVerifying && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse mb-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Validando...
                        </div>
                    )}

                    {isSendingNotification ? (
                        <div className="flex flex-col items-center gap-2 py-2">
                             <div className="flex items-center gap-2 text-primary font-medium">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Aguardando Supervisor...
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setIsSendingNotification(false); setRequestId(null); }}>
                                Cancelar Solicitação
                            </Button>
                        </div>
                    ) : (
                        <Button 
                            variant="default" 
                            className="w-full gap-2" 
                            onClick={handleRequestApproval} 
                            disabled={isVerifying}
                        >
                            <BellRing className="h-4 w-4" />
                            Solicitar Aprovação Remota
                        </Button>
                    )}

                    <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isVerifying || isSendingNotification}
                    >
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
