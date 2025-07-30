// src/app/dashboard/help/page.tsx
'use client';
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LifeBuoy, Home, Package, ShoppingCart, BarChart, Gift, Component, Bot, FileText, Settings, Users, Building, CreditCard } from "lucide-react";

export default function HelpPage() {
    const { user } = useAuth();
    
    const allFeatures = [
        {
            icon: <Home />,
            title: "Início",
            module: 'dashboard',
            description: "O painel de Início é sua central de comando. Ele oferece uma visão geral e rápida do desempenho da sua filial, com indicadores chave como receita total, número de vendas e total de itens em estoque. Além disso, você pode visualizar gráficos de vendas dos últimos 7 dias e um ranking dos vendedores mais eficientes para tomar decisões baseadas em dados."
        },
        {
            icon: <Package />,
            title: "Produtos",
            module: 'products',
            description: "Gerencie todo o seu catálogo. Cadastre, edite e organize seus produtos por nome, categoria, preço e imagem. Defina um limite para alerta de estoque baixo e garanta que você nunca mais seja pego de surpresa. Use a funcionalidade de importação para adicionar múltiplos produtos de uma vez via arquivo CSV, economizando tempo precioso."
        },
        {
            icon: <Gift />,
            title: "Combos Promocionais",
            module: 'combos',
            description: "Crie ofertas irresistíveis com pacotes de produtos fixos, como '1 Lanche + 1 Bebida por R$20'. Você pode definir regras de desconto avançadas, oferecendo preços diferentes para pagamentos em dinheiro, PIX ou cartão, incentivando métodos com taxas menores e aumentando sua margem."
        },
        {
            icon: <Component />,
            title: "Kits Dinâmicos",
            module: 'kits',
            description: "Ofereça máxima flexibilidade aos seus clientes com kits onde eles escolhem os itens. Configure regras como 'Monte seu kit com 5 itens da categoria X e ganhe 10% de desconto'. No Ponto de Venda, o cliente seleciona os produtos desejados para montar o kit, criando uma experiência de compra personalizada."
        },
        {
            icon: <BarChart />,
            title: "Movimentação de Estoque",
            module: 'inventory',
            description: "Tenha controle total sobre seu inventário. A aba 'Estoque Atual' mostra as quantidades em tempo real. 'Histórico de Movimentações' oferece um registro detalhado de todas as transações, incluindo data, produto, tipo de movimentação e usuário responsável. Realize entradas, ajustes de saída e transferências entre filiais de forma simples e rastreável."
        },
        {
            icon: <ShoppingCart />,
            title: "Frente de Caixa (PDV)",
            module: 'pos',
            description: "O Ponto de Venda é onde a mágica acontece. Adicione produtos, combos e kits ao carrinho, aplique descontos e finalize a venda com múltiplas formas de pagamento de forma rápida e intuitiva. O sistema é otimizado para minimizar o tempo de espera do cliente e maximizar a eficiência do seu caixa."
        },
        {
            icon: <Bot />,
            title: "Oráculo AI",
            module: 'assistant',
            description: "Converse com seu estoque. Faça perguntas em linguagem natural como 'Quantos laptops temos?' ou 'Quais produtos estão acabando?' e receba respostas instantâneas. O Oráculo AI usa inteligência artificial para analisar seus dados e fornecer insights valiosos sem que você precise navegar por planilhas."
        },
        {
            icon: <FileText />,
            title: "Relatórios",
            module: 'reports',
            description: "Acesso exclusivo para administradores. Visualize relatórios consolidados de desempenho, compare vendas entre filiais, identifique os produtos mais vendidos em toda a organização e analise o estoque baixo de forma global para uma gestão estratégica e informada."
        },
        {
            icon: <Settings />,
            title: "Ajustes",
            module: 'settings',
            description: "Área de administração para configurar o sistema. Gerencie usuários e suas permissões, cadastre e configure filiais (unidades de negócio), e defina as condições de pagamento que serão utilizadas na Frente de Caixa, incluindo taxas associadas para cada método."
        }
    ];

    const enabledFeatures = allFeatures.filter(feature => 
        user?.enabledModules?.[feature.module as keyof typeof user.enabledModules] ?? true
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <LifeBuoy className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">Ajuda & Tutorial</h1>
                    <p className="text-muted-foreground">
                        Um guia rápido para você aproveitar ao máximo todas as funcionalidades do Stokio.
                    </p>
                </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
                {enabledFeatures.map((feature, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-3">
                                {feature.icon}
                                <span className="text-lg font-semibold">{feature.title}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <p className="text-base text-muted-foreground pl-9">
                                {feature.description}
                            </p>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
