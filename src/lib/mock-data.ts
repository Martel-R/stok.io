import type { User, Product, Sale } from './types';

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@instock.ai', password: 'password', role: 'admin', avatar: '/avatars/01.png' },
  { id: '2', name: 'Manager User', email: 'manager@instock.ai', password: 'password', role: 'manager', avatar: '/avatars/02.png' },
  { id: '3', name: 'Cashier User', email: 'cashier@instock.ai', password: 'password', role: 'cashier', avatar: '/avatars/03.png' },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'prod1', name: 'Quantum Laptop', category: 'Electronics', price: 1200, stock: 45, imageUrl: 'https://placehold.co/400x400.png' },
  { id: 'prod2', name: 'Smart-Watch Pro', category: 'Electronics', price: 350, stock: 120, imageUrl: 'https://placehold.co/400x400.png' },
  { id: 'prod3', name: 'Ergo-Chair 5000', category: 'Furniture', price: 500, stock: 25, imageUrl: 'https://placehold.co/400x400.png' },
  { id: 'prod4', name: 'Organic Coffee Beans', category: 'Groceries', price: 25, stock: 200, imageUrl: 'https://placehold.co/400x400.png' },
  { id: 'prod5', name: 'Designer Desk Lamp', category: 'Furniture', price: 150, stock: 60, imageUrl: 'https://placehold.co/400x400.png' },
  { id: 'prod6', name: 'Wireless Earbuds', category: 'Electronics', price: 180, stock: 300, imageUrl: 'https://placehold.co/400x400.png' },
  { id: 'prod7', name: 'Yoga Mat', category: 'Sports', price: 40, stock: 150, imageUrl: 'https://placehold.co/400x400.png' },
  { id: 'prod8', name: 'Water Bottle', category: 'Sports', price: 20, stock: 400, imageUrl: 'https://placehold.co/400x400.png' },
];

export const MOCK_SALES: Sale[] = Array.from({ length: 50 }, (_, i) => {
  const product = MOCK_PRODUCTS[i % MOCK_PRODUCTS.length];
  const quantity = Math.floor(Math.random() * 5) + 1;
  return {
    id: `sale${i}`,
    productName: product.name,
    quantity,
    total: product.price * quantity,
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // a date in the last 30 days
    cashier: MOCK_USERS.find(u => u.role === 'cashier')?.name ?? 'Cashier',
  }
});
