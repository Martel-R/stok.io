
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

export type PaymentConditionType = 'credit' | 'debit' | 'cash' | 'pix';

export interface PaymentCondition {
    id: string;
    name: string;
    type: PaymentConditionType;
    fee: number;
    feeType: 'percentage' | 'fixed';
}

export interface PaymentDetail {
    conditionId: string;
    conditionName: string;
    type: PaymentConditionType;
    amount: number;
    installments: number;
}


export interface Sale {
  id:string;
  productName: string;
  quantity: number;
  total: number;
  date: Date;
  cashier: string;
  branchId: string;
  payments: PaymentDetail[];
}

export interface Branch {
    id: string;
    name: string;
    cnpj: string;
    location: string;
    userIds: string[];
    lowStockThreshold: number;
}

export interface StockEntry {
    id: string;
    productId: string;
    productName: string;
    quantityAdded: number;
    previousStock: number;
    newStock: number;
    date: any; // ServerTimestamp
    userId: string;
    userName: string;
    branchId: string;
}

export interface ComboProduct {
  productId: string;
  productName: string; 
  productPrice: number;
  quantity: number;
}

export type DiscountType = 'percentage' | 'fixed';

export interface ComboDiscountRule {
  paymentConditionIds: string[]; // Array of payment condition IDs, empty means "any" (default)
  discountType: DiscountType;
  discountValue: number;
}


export interface Combo {
  id: string;
  name: string;
  products: ComboProduct[];
  originalPrice: number;
  finalPrice: number; // The price after the default discount
  discountRules: ComboDiscountRule[];
  imageUrl: string;
  branchId: string;
}
