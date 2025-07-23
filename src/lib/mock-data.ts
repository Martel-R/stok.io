
import type { User, Product, Sale } from './types';

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
  { id: '3', name: 'Usuário Caixa', email: 'cashier@instock.ai', password: 'password', role: 'cashier', avatar: getRandomAvatar(), organizationId: 'org1' },
];

// Mock products no longer need a static branchId, it will be assigned on creation.
export const MOCK_PRODUCTS: Omit<Product, 'id' | 'branchId' | 'organizationId'>[] = [
  { name: 'Laptop Quântico', category: 'Eletrônicos', price: 1200, imageUrl: 'https://placehold.co/400x400.png', lowStockThreshold: 5 },
  { name: 'Smart-Watch Pro', category: 'Eletrônicos', price: 350, imageUrl: 'https://placehold.co/400x400.png', lowStockThreshold: 10 },
  { name: 'Cadeira Ergonômica 5000', category: 'Móveis', price: 500, imageUrl: 'https://placehold.co/400x400.png', lowStockThreshold: 3 },
  { name: 'Grãos de Café Orgânico', category: 'Mercearia', price: 25, imageUrl: 'https://placehold.co/400x400.png', lowStockThreshold: 20 },
];

// This data is for dashboard visualization and also needs to be scoped
export const MOCK_SALES: Omit<Sale, 'id' | 'branchId' | 'organizationId'>[] = Array.from({ length: 50 }, (_, i) => {
  const product = MOCK_PRODUCTS[i % MOCK_PRODUCTS.length];
  const quantity = Math.floor(Math.random() * 5) + 1;
  return {
    productId: 'mock-product-id-' + (i % MOCK_PRODUCTS.length),
    productName: product.name,
    quantity,
    total: product.price * quantity,
    date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // a date in the last 30 days
    cashier: MOCK_USERS.find(u => u.role === 'cashier')?.name ?? 'Caixa',
    payments: [],
  }
});
