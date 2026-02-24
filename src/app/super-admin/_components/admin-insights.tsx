
'use client';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { Organization, PricingPlan } from '@/lib/types';

interface InsightsProps {
    organizations: Organization[];
    plans: PricingPlan[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

export function AdminInsights({ organizations, plans }: InsightsProps) {
    // 1. Distribuição de Planos
    const planDistribution = React.useMemo(() => {
        const distribution = plans.map(plan => ({
            name: plan.name,
            value: organizations.filter(org => org.subscription?.planId === plan.id).length
        })).filter(d => d.value > 0);
        
        // Adiciona "Sem Plano" se houver
        const noPlan = organizations.filter(org => !org.subscription?.planId).length;
        if (noPlan > 0) distribution.push({ name: 'Sem Plano', value: noPlan });
        
        return distribution;
    }, [organizations, plans]);

    // 2. Receita por Plano
    const revenueByPlan = React.useMemo(() => {
        return plans.map(plan => {
            const count = organizations.filter(org => org.subscription?.planId === plan.id && org.paymentStatus === 'active').length;
            return {
                name: plan.name,
                revenue: count * plan.price
            };
        }).filter(d => d.revenue > 0);
    }, [organizations, plans]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Distribuição de Planos</CardTitle>
                    <CardDescription>Quantidade de organizações por plano de assinatura.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={planDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {planDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Receita Mensal Estimada por Plano</CardTitle>
                    <CardDescription>Projeção de MRR baseada em organizações ativas.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueByPlan}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(value) => `R$ ${value}`} />
                            <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                            <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
