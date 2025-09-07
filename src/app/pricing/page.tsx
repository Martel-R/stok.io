
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { PricingPlan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';

export default function PricingPage() {
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const q = query(collection(db, 'pricingPlans'), where('isDeleted', '!=', true));
                const querySnapshot = await getDocs(q);
                const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PricingPlan));
                setPlans(plansData.sort((a,b) => a.price - b.price));
            } catch (error) {
                console.error("Error fetching pricing plans: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlans();
    }, []);

    return (
        <div className="bg-background text-foreground min-h-screen">
             <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Icons.logo className="h-8 w-8 text-primary"/>
                        <span className="text-xl font-bold">Stokio</span>
                    </Link>
                    <nav>
                        <Button asChild variant="outline">
                            <Link href="/login">Entrar</Link>
                        </Button>
                    </nav>
                </div>
            </header>

            <main className="container py-12 md:py-24">
                 <div className="mx-auto mb-12 max-w-3xl text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                        Escolha o Plano Perfeito para o seu Negócio
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Planos simples e transparentes que crescem com você. Sem taxas escondidas.
                    </p>
                </div>
                
                 {loading ? (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        <Skeleton className="h-96 w-full"/>
                        <Skeleton className="h-96 w-full"/>
                        <Skeleton className="h-96 w-full"/>
                    </div>
                ) : plans.length > 0 ? (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {plans.map(plan => (
                             <Card key={plan.id} className={cn("flex flex-col", plan.isFeatured && "border-primary ring-2 ring-primary")}>
                                <CardHeader>
                                    {plan.isFeatured && <div className="text-center mb-2"><Badge>Mais Popular</Badge></div>}
                                    <CardTitle>{plan.name}</CardTitle>
                                    <CardDescription>{plan.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-6">
                                    <div className="flex items-baseline justify-center">
                                        <span className="text-4xl font-bold">R${plan.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        <span className="text-muted-foreground">/mês</span>
                                    </div>
                                    <ul className="space-y-3">
                                        {plan.features.map((feature, index) => (
                                            <li key={index} className="flex items-center gap-2">
                                                <Check className="h-5 w-5 text-green-500" />
                                                <span className="text-muted-foreground">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full" size="lg" variant={plan.isFeatured ? 'default' : 'outline'}>
                                        <Link href="/signup">Começar Agora</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <h2 className="text-2xl font-semibold">Nossos planos estão sendo preparados</h2>
                        <p className="mt-2 text-muted-foreground">
                            Para saber mais sobre as condições e contratar, entre em contato conosco.
                        </p>
                        <Button asChild size="lg" className="mt-6">
                            <a href="https://wa.me/5596981131536" target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="mr-2"/>
                                Falar no WhatsApp
                            </a>
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
