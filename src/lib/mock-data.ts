import type { User, Product, Sale } from './types';

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Usuário Admin', email: 'admin@instock.ai', password: 'password', role: 'admin', avatar: '/avatars/01.png' },
  { id: '2', name: 'Usuário Gerente', email: 'manager@instock.ai', password: 'password', role: 'manager', avatar: '/avatars/02.png' },
  { id: '3', name: 'Usuário Caixa', email: 'cashier@instock.ai', password: 'password', role: 'cashier', avatar: '/avatars/03.png' },
];

// Mock products no longer need a static branchId, it will be assigned on creation.
export const MOCK_PRODUCTS: Omit<Product, 'id' | 'branchId'>[] = [
  { name: 'Laptop Quântico', category: 'Eletrônicos', price: 1200, stock: 45, imageUrl: 'https://placehold.co/400x400.png' },
  { name: 'Smart-Watch Pro', category: 'Eletrônicos', price: 350, stock: 120, imageUrl: 'https://placehold.co/400x400.png' },
  { name: 'Cadeira Ergonômica 5000', category: 'Móveis', price: 500, stock: 25, imageUrl: 'https://placehold.co/400x400.png' },
  { name: 'Grãos de Café Orgânico', category: 'Mercearia', price: 25, stock: 200, imageUrl: 'https://placehold.co/400x400.png' },
  { name: 'Luminária de Mesa Design', category: 'Móveis', price: 150, stock: 60, imageUrl: 'https://placehold.co/400x400.png' },
  { name: 'Fones de Ouvido Sem Fio', category: 'Eletrônicos', price: 180, stock: 300, imageUrl: 'https://placehold.co/400x400.png' },
  { name: 'Tapete de Yoga', category: 'Esportes', price: 40, stock: 150, imageUrl: 'https://placehold.co/400x400.png' },
  { name: 'Garrafa de Água', category: 'Esportes', price: 20, stock: 400, imageUrl: 'https://placehold.co/400x400.png' },
];

// This data is for dashboard visualization and also needs to be scoped
export const MOCK_SALES: Omit<Sale, 'id' | 'branchId'>[] = Array.from({ length: 50 }, (_, i) => {
  const product = MOCK_PRODUCTS[i % MOCK_PRODUCTS.length];
  const quantity = Math.floor(Math.random() * 5) + 1;
  return {
    productName: product.name,
    quantity,
    total: product.price * quantity,
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // a date in the last 30 days
    cashier: MOCK_USERS.find(u => u.role === 'cashier')?.name ?? 'Caixa',
  }
});
