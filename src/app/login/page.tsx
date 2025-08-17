

'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';


export default function LoginPage() {
  const { login, loginWithGoogle, loading, cancelLogin } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const loginCancelledRef = useRef(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (!success && !loginCancelledRef.current) {
      toast({
        title: 'Falha no Login',
        description: 'E-mail ou senha inválidos. Por favor, tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleGoogleLogin = async () => {
    const success = await loginWithGoogle();
    if (!success) {
      toast({
        title: 'Falha no Login com Google',
        description: 'Não foi possível fazer login com o Google. Por favor, tente novamente.',
        variant: 'destructive',
      });
    }
  }

  const handleCancel = () => {
    cancelLogin();
  }

  const quickLogin = async (userEmail: string) => {
    const success = await login(userEmail, 'password');
     if (!success) {
      toast({
        title: 'Falha no Login',
        description: 'Não foi possível fazer login com o perfil selecionado.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70" />
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
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Login</h1>
            <p className="text-balance text-muted-foreground">
              Acesse sua conta para gerenciar seu estoque
            </p>
          </div>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@exemplo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Senha</Label>
                 <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">
                    Esqueceu sua senha?
                </Link>
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
            {loading ? (
                 <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancelar
                 </Button>
            ) : (
                <Button type="submit" className="w-full">
                    Entrar
                </Button>
            )}
          </form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
            </div>
          </div>

          <Button variant="outline" onClick={handleGoogleLogin} disabled={loading}>
            <Icons.google className="mr-2 h-4 w-4" />
            Google
          </Button>

          <div className="mt-4 text-center text-sm">
              Não tem uma conta?{' '}
              <Link href="/signup" className="underline">
                  Cadastre-se
              </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
