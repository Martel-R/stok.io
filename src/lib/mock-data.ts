
import type { User, Product, Sale, PricingPlan } from './types';

const availableAvatars = [
    'https://placehold.co/100x100.png?text=🦊',
    'https://placehold.co/100x100.png?text=🦉',
    'https://placehold.co/100x100.png?text=🐻',
    'https://placehold.co/100x100.png?text=🦁',
    'https://placehold.co/100x100.png?text=🦄',
];
const getRandomAvatar = () => availableAvatars[Math.floor(Math.random() * availableAvatars.length)];


export const MOCK_USERS: User[] = [
  { id: '1', name: 'Usuário Admin', email: 'admin@instock.ai', password: 'password', role: 'admin', avatar: getRandomAvatar(), organizationId: 'org1' },
  { id: '2', name: 'Usuário Gerente', email: 'manager@instock.ai', password: 'password', role: 'manager', avatar: getRandomAvatar(), organizationId: 'org1' },
  { id: '3', name: 'Usuário Atendimento', email: 'atendimento@instock.ai', password: 'password', role: 'atendimento', avatar: getRandomAvatar(), organizationId: 'org1' },
];

export const MOCK_PRICING_PLANS: Omit<PricingPlan, 'id'>[] = [
  {
    name: "Básico",
    price: 59.90,
    description: "Ideal para pequenos negócios e autônomos que estão começando.",
    features: [
      "1 Filial",
      "Até 3 usuários",
      "Gestão de Produtos e Serviços",
      "Controle de Estoque",
      "Frente de Caixa (PDV)",
      "Relatórios Essenciais",
      "Suporte por E-mail",
    ],
    isFeatured: false,
  },
  {
    name: "Profissional",
    price: 99.90,
    description: "A solução completa para negócios em crescimento que precisam de mais automação.",
    features: [
      "Tudo do plano Básico",
      "Até 10 usuários",
      "Múltiplas Filiais (até 3)",
      "Agenda Inteligente e Portal do Cliente",
      "Combos e Kits Dinâmicos",
      "Oráculo AI para insights",
      "Suporte Prioritário por Chat",
    ],
    isFeatured: true,
  },
  {
    name: "Enterprise",
    price: 249.90,
    description: "Para grandes operações com necessidades específicas e volume elevado.",
    features: [
      "Tudo do plano Profissional",
      "Usuários ilimitados",
      "Filiais ilimitadas",
      "Acesso via API (em breve)",
      "Gerente de Contas Dedicado",
      "Branding Personalizado Avançado",
    ],
    isFeatured: false,
  },
];
