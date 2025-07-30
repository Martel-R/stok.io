// src/app/dashboard/help/page.tsx
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LifeBuoy, Home, Package, ShoppingCart, BarChart, Gift, Component, Bot, FileText, Settings, Users, Building, CreditCard } from "lucide-react";

export default function HelpPage() {
    
    const features = [
        {
            icon: <Home />,
            title: "Início",
            description: "O painel inicial oferece uma visão geral e rápida do desempenho da sua filial. Aqui você encontra indicadores chave como receita total, número de vendas, total de produtos e quantidade de itens em estoque. Além disso, visualize gráficos de vendas dos últimos 7 dias e um ranking dos vendedores mais eficientes."
        },
        {
            icon: <Package />,
            title: "Produtos",
            description: "Nesta seção, você pode cadastrar, editar e gerenciar todos os seus produtos. É possível definir nome, categoria, preço, imagem e um limite para alerta de estoque baixo. Use a funcionalidade de importação para adicionar múltiplos produtos de uma vez via arquivo CSV."
        },
        {
            icon: <Gift />,
            title: "Combos",
            description: "Crie ofertas promocionais com pacotes de produtos pré-definidos. Por exemplo, '1 Lanche + 1 Bebida'. Você pode definir regras de desconto específicas para diferentes formas de pagamento, incentivando o uso de métodos com taxas menores."
        },
        {
            icon: <Component />,
            title: "Kits Dinâmicos",
            description: "Ofereça flexibilidade aos seus clientes com kits onde eles podem escolher os itens. Por exemplo, 'Monte seu kit com 5 itens da categoria X e ganhe 10% de desconto'. O cliente seleciona os produtos desejados na Frente de Caixa para montar o kit."
        },
        {
            icon: <BarChart />,
            title: "Movimentação de Estoque",
            description: "Acompanhe todas as entradas e saídas de estoque. A aba 'Estoque Atual' mostra as quantidades presentes, enquanto 'Histórico de Movimentações' oferece um registro detalhado de todas as transações, incluindo data, produto, tipo de movimentação e usuário responsável. É possível dar entrada, fazer ajustes de saída e transferir produtos entre filiais."
        },
        {
            icon: <ShoppingCart />,
            title: "Frente de Caixa (PDV)",
            description: "O Ponto de Venda é onde a mágica acontece. Adicione produtos, combos e kits ao carrinho, aplique descontos e finalize a venda com múltiplas formas de pagamento. O sistema é otimizado para ser rápido e intuitivo, minimizando o tempo de espera do cliente."
        },
        {
            icon: <Bot />,
            title: "Oráculo AI",
            description: "Faça perguntas em linguagem natural sobre seu inventário e receba respostas instantâneas. O Oráculo AI utiliza inteligência artificial para analisar os dados do seu estoque e fornecer insights, como 'Quantos laptops temos em estoque?' ou 'Quais produtos estão acabando?'."
        },
        {
            icon: <FileText />,
            title: "Relatórios",
            description: "Acesso exclusivo para administradores. Aqui você pode visualizar relatórios consolidados de desempenho, comparando vendas entre filiais, identificando os produtos mais vendidos em toda a organização e analisando o estoque baixo de forma global."
        },
        {
            icon: <Settings />,
            title: "Ajustes",
            description: "Área de administração para configurar o sistema. Gerencie usuários e suas permissões, cadastre e configure filiais (unidades de negócio) e defina as condições de pagamento que serão utilizadas na Frente de Caixa, incluindo taxas associadas."
        }
    ];

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
                {features.map((feature, index) => (
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
