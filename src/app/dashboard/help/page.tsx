
// src/app/dashboard/help/page.tsx
'use client';
import { useState } from 'react';
import { useAuth } from "@/lib/auth";
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { LifeBuoy, Home, Package, ShoppingCart, BarChart, Gift, Component, Bot, FileText, Settings, Users, Building, CreditCard, AlertTriangle, Loader2 } from "lucide-react";

export default function HelpPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isRepairing, setIsRepairing] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    
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

    const handleFixSoftDelete = async () => {
        setIsRepairing(true);
        toast({ title: 'Iniciando reparo...', description: 'Este processo pode demorar alguns minutos.' });
        
        const collectionsToFix = [
            'products', 'combos', 'kits', 'services', 'customers', 
            'anamnesisQuestions', 'suppliers', 'branches', 'expenses', 'appointments'
        ];
        
        let totalUpdated = 0;

        try {
            for (const collectionName of collectionsToFix) {
                const querySnapshot = await getDocs(collection(db, collectionName));
                const batch = writeBatch(db);
                querySnapshot.forEach((doc) => {
                    batch.update(doc.ref, { isDeleted: false });
                });
                await batch.commit();
                totalUpdated += querySnapshot.size;
            }
            toast({ title: 'Reparo Concluído!', description: `${totalUpdated} registros em ${collectionsToFix.length} módulos foram verificados e restaurados.` });
        } catch (error) {
            console.error("Error repairing soft delete flags:", error);
            toast({ title: 'Erro no Reparo', description: 'Não foi possível concluir a operação.', variant: 'destructive' });
        } finally {
            setIsRepairing(false);
        }
    };
    
    const handleProductMigration = async () => {
        if (!user?.organizationId) {
            toast({ title: 'Erro', description: 'Organização não encontrada.', variant: 'destructive' });
            return;
        }
        setIsMigrating(true);
        toast({ title: 'Iniciando migração de produtos...', description: 'Isso pode levar alguns instantes.' });

        try {
            const productsQuery = query(collection(db, 'products'), where('organizationId', '==', user.organizationId));
            const querySnapshot = await getDocs(productsQuery);
            
            const batch = writeBatch(db);
            let productsToMigrate = 0;

            querySnapshot.forEach(doc => {
                const product = doc.data();
                // Check if migration is needed (has old field, lacks new field)
                if (product.branchId && !product.branchIds) {
                    batch.update(doc.ref, {
                        branchIds: [product.branchId],
                        // You might want to remove the old branchId field as well for cleanliness
                        // branchId: deleteField() // This requires importing `deleteField` from "firebase/firestore"
                    });
                    productsToMigrate++;
                }
            });

            if (productsToMigrate > 0) {
                await batch.commit();
                toast({ title: 'Migração Concluída!', description: `${productsToMigrate} produtos foram atualizados para o novo sistema de filiais.` });
            } else {
                toast({ title: 'Nenhum produto para migrar', description: 'Seus produtos já estão no formato mais recente.' });
            }

        } catch (error) {
            console.error("Error migrating products:", error);
            toast({ title: 'Erro na Migração', description: 'Ocorreu um erro durante a migração dos produtos.', variant: 'destructive' });
        } finally {
            setIsMigrating(false);
        }
    };

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
            
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Ferramentas de Reparo</CardTitle>
                    <CardDescription>Use estas ferramentas com cuidado. Elas servem para corrigir inconsistências nos dados do sistema.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isRepairing || isMigrating}>
                                {isRepairing && <Loader2 className="mr-2 animate-spin" />}
                                Restaurar Todos os Registros Excluídos
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação irá percorrer todo o banco de dados e restaurar QUALQUER item que tenha sido excluído (produtos, vendas, clientes, etc.), independentemente de qual organização ou filial ele pertença. Esta ação é irreversível.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleFixSoftDelete}>Sim, eu entendo, restaurar tudo.</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="outline" disabled={isRepairing || isMigrating}>
                                {isMigrating && <Loader2 className="mr-2 animate-spin" />}
                                Migrar Produtos para Múltiplas Filiais
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Migração de Produtos?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação irá atualizar seus produtos para o novo sistema que permite compartilhar um mesmo produto entre várias filiais. É um passo necessário após a última atualização. A operação é segura e não deve causar perda de dados.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleProductMigration}>Sim, iniciar migração</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

        </div>
    );
}
