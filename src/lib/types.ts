

export type UserRole = 'admin' | 'manager' | 'cashier';
export type PaymentStatus = 'active' | 'overdue' | 'locked';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  password?: string;
  organizationId: string;
  paymentStatus?: PaymentStatus;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  branchId: string;
  organizationId: string;
}

export type PaymentConditionType = 'credit' | 'debit' | 'cash' | 'pix';

export interface PaymentCondition {
    id: string;
    name: string;
    type: PaymentConditionType;
    fee: number;
    feeType: 'percentage' | 'fixed';
    organizationId: string;
}

export interface PaymentDetail {
    conditionId: string;
    conditionName: string;
    type: PaymentConditionType;
    amount: number;
    installments: number;
    receiptCode?: string;
}


export interface Sale {
  id:string;
  productId: string;
  productName: string;
  quantity: number;
  total: number;
  date: Date;
  cashier: string;
  branchId: string;
  organizationId: string;
  payments: PaymentDetail[];
}

export interface Branch {
    id: string;
    name: string;
    cnpj: string;
    location: string;
    userIds: string[];
    lowStockThreshold: number;
    taxRate: number; // Stored as a percentage, e.g., 8 for 8%
    organizationId: string;
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
    organizationId: string;
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
  organizationId: string;
}

export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    paymentStatus: PaymentStatus;
}

    