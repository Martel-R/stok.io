'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const { sendPasswordReset, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { success, error } = await sendPasswordReset(email);
    if (success) {
      toast({
        title: 'E-mail Enviado!',
        description: 'Verifique sua caixa de entrada para o link de redefinição de senha.',
      });
      router.push('/login');
    } else {
      toast({
        title: 'Falha no Envio',
        description: error,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-muted">
      <div className="mx-auto grid w-[380px] gap-6 p-8 rounded-lg border bg-background shadow-lg">
        <div className="grid gap-2 text-center">
           <Mail className="mx-auto h-12 w-12 text-primary"/>
          <h1 className="text-3xl font-bold">Esqueceu sua Senha?</h1>
          <p className="text-balance text-muted-foreground">
            Sem problemas! Insira seu e-mail abaixo e enviaremos um link para você criar uma nova senha.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar Link de Recuperação
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Lembrou sua senha?{' '}
          <Link href="/login" className="underline">
            Fazer Login
          </Link>
        </div>
      </div>
    </div>
  );
}
