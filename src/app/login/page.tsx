'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('admin@instock.ai');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (!success) {
      toast({
        title: 'Falha no Login',
        description: 'E-mail ou senha inválidos. Por favor, tente novamente.',
        variant: 'destructive',
      });
    }
  };

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
        <div className="absolute inset-0 bg-primary" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <Icons.logo className="mr-2 h-8 w-8" />
          InStockAI
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
              Digite seu e-mail abaixo para entrar na sua conta
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
              Entrar
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <p className="text-muted-foreground mb-2">Ou login rápido como:</p>
            <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => quickLogin('admin@instock.ai')} disabled={loading}>Admin</Button>
                <Button variant="outline" onClick={() => quickLogin('manager@instock.ai')} disabled={loading}>Gerente</Button>
                <Button variant="outline" onClick={() => quickLogin('cashier@instock.ai')} disabled={loading}>Caixa</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
