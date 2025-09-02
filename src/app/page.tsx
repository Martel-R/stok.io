

'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import {
  ArrowRightLeft,
  BarChart,
  Bot,
  Briefcase,
  Calendar,
  Component,
  FileText,
  Gift,
  Home,
  Package,
  Settings,
  ShoppingCart,
  Users,
  ArrowDownCircle,
  Archive
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';


const features = [
  {
    icon: <Home className="h-8 w-8 text-primary" />,
    title: 'Início Rápido',
    description: 'Painel com visão geral e rápida do desempenho da sua filial, com indicadores chave como receita e vendas.',
  },
  {
    icon: <Calendar className="h-8 w-8 text-primary" />,
    title: 'Agenda Inteligente',
    description: 'Gerencie agendamentos de serviços com visualizações por dia, semana e mês, e controle o status de cada atendimento.',
  },
   {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: 'Gestão de Clientes (CRM)',
    description: 'Cadastre seus clientes, gerencie o acesso ao portal e mantenha um histórico completo com a ficha de anamnese.',
  },
  {
    icon: <Briefcase className="h-8 w-8 text-primary" />,
    title: 'Cadastro de Serviços',
    description: 'Defina os serviços oferecidos, preços, duração e vincule os profissionais habilitados para cada um.',
  },
  {
    icon: <Package className="h-8 w-8 text-primary" />,
    title: 'Controle de Produtos',
    description: 'Catálogo completo com cadastro de produtos, preços, categorias, e alerta de estoque baixo para nunca mais ser pego de surpresa.',
  },
  {
    icon: <Gift className="h-8 w-8 text-primary" />,
    title: 'Combos Promocionais',
    description: 'Crie pacotes de produtos com descontos fixos ou percentuais, e defina regras de preço por forma de pagamento.',
  },
  {
    icon: <Component className="h-8 w-8 text-primary" />,
    title: 'Kits Dinâmicos',
    description: 'Ofereça flexibilidade com kits onde o cliente escolhe os itens, aplicando descontos automáticos no caixa.',
  },
  {
    icon: <BarChart className="h-8 w-8 text-primary" />,
    title: 'Movimentação de Estoque',
    description: 'Controle total sobre entradas, saídas, ajustes e transferências entre filiais com histórico detalhado por usuário.',
  },
  {
    icon: <ShoppingCart className="h-8 w-8 text-primary" />,
    title: 'Frente de Caixa (PDV)',
    description: 'Um PDV rápido e intuitivo para registrar vendas, aceitar múltiplos pagamentos e gerenciar o carrinho de compras.',
  },
   {
    icon: <ArrowDownCircle className="h-8 w-8 text-primary" />,
    title: 'Controle de Despesas',
    description: 'Lance e categorize todas as despesas da sua filial, mantendo a saúde financeira do seu negócio sob controle.',
  },
  {
    icon: <Bot className="h-8 w-8 text-primary" />,
    title: 'Oráculo AI',
    description: 'Converse com seus dados. Faça perguntas em linguagem natural e receba insights instantâneos sobre seu negócio.',
  },
  {
    icon: <FileText className="h-8 w-8 text-primary" />,
    title: 'Relatórios Completos',
    description: 'Acesse relatórios de vendas, produtos mais vendidos, estoque baixo e desempenho por filial para decisões estratégicas.',
  },
  {
    icon: <Archive className="h-8 w-8 text-primary" />,
    title: 'Backup de Dados',
    description: 'Exporte seus dados mais importantes a qualquer momento, garantindo a segurança das suas informações.',
  },
  {
    icon: <Settings className="h-8 w-8 text-primary" />,
    title: 'Configurações Flexíveis',
    description: 'Gerencie filiais, usuários, perfis de permissão, condições de pagamento e a identidade visual do sistema.',
  },
];


export default function InstitutionalPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.logo className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Stokio</span>
          </div>
          <nav>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'px-4'
              )}
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative h-[60vh] min-h-[500px] w-full">
           <Image
              src="https://picsum.photos/1920/1080?grayscale"
              alt="Pessoas trabalhando em um escritório moderno"
              fill
              className="object-cover"
              data-ai-hint="office workspace"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center container">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                    A Gestão Inteligente que seu Negócio Merece
                </h1>
                <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                    O Stokio é um sistema completo de Ponto de Venda e gestão de estoque, projetado para otimizar sua operação com o poder da Inteligência Artificial.
                </p>
                <div className="mt-8 flex gap-4">
                    <Button asChild size="lg">
                        <Link href="/pricing">Ver Planos</Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container py-16 sm:py-24">
            <div className="mx-auto mb-12 max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight">Tudo que você precisa em um só lugar</h2>
                <p className="mt-2 text-lg text-muted-foreground">
                    Do controle de estoque à análise de dados com IA, o Stokio centraliza a gestão do seu negócio.
                </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, i) => (
                    <Card key={i} className="flex flex-col items-start p-6">
                        {feature.icon}
                        <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                        <p className="mt-2 text-muted-foreground">{feature.description}</p>
                    </Card>
                ))}
            </div>
        </section>
      </main>

       {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
                <Icons.logo className="h-6 w-6 text-primary" />
                <span className="text-md font-bold">Stokio</span>
            </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Stokio. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
