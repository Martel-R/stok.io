

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  const { signup, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { success, error, isFirstUser } = await signup(email, password, name);
    if (success) {
      if (isFirstUser) {
        toast({
          title: 'Cadastro realizado com sucesso!',
          description: 'Vamos configurar sua primeira filial.',
        });
        // Redirect to settings to create the first branch
        router.push('/dashboard/settings?tab=branches');
      } else {
         toast({
          title: 'Cadastro realizado com sucesso!',
          description: 'Você será redirecionado para o painel de início.',
        });
        router.push('/dashboard');
      }
    } else {
      toast({
        title: 'Falha no Cadastro',
        description: error || 'Ocorreu um erro. Por favor, tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Criar Conta</h1>
            <p className="text-balance text-muted-foreground">
              Digite seus dados para criar sua conta
            </p>
          </div>
          <form onSubmit={handleSignup} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Empresa/Negócio</Label>
              <Input
                id="name"
                placeholder="Sua Empresa"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail do Administrador</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@suaempresa.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Senha</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Conta
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Já tem uma conta?{' '}
            <Link href="/login" className="underline">
              Fazer Login
            </Link>
          </div>
        </div>
      </div>
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
         <div className={cn(
          "absolute inset-0 bg-gradient-to-br from-primary via-primary/70 to-secondary",
          "animate-animated-gradient bg-[length:200%_200%]"
        )} />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <Icons.logo className="mr-2 h-8 w-8" />
          Stokio
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Este sistema de estoque transformou nosso negócio, nos dando insights que nunca pensamos ser possíveis.&rdquo;
            </p>
            <footer className="text-sm">Sofia Davis, CEO</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
