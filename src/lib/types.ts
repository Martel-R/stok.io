export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  password?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  imageUrl: string;
  branchId: string;
}

export interface Sale {
  id:string;
  productName: string;
  quantity: number;
  total: number;
  date: Date;
  cashier: string;
  branchId: string;
}

export interface Branch {
    id: string;
    name: string;
    cnpj: string;
    location: string;
    userIds: string[];
}
