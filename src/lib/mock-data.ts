
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
  { id: '3', name: 'Usuário Atendimento', email: 'atendimento@instock.ai', password: 'password', role: 'atendimento', avatar: getRandomAvatar(), organizationId: 'org1' },
];
