

export type UserRole = 'admin' | 'manager' | 'atendimento' | 'customer' | 'professional';
export type PaymentStatus = 'active' | 'overdue' | 'locked';

export interface EnabledModules {
    dashboard: boolean;
    products: boolean;
    combos: boolean;
    inventory: boolean;
    pos: boolean;
    assistant: boolean;
    reports: boolean;
    settings: boolean;
    kits: boolean;
    customers: boolean;
    appointments: boolean;
    services: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  password?: string;
  organizationId: string;
  paymentStatus?: PaymentStatus;
  enabledModules?: EnabledModules;
  customerId?: string; // Link to customer profile if role is 'customer'
}

export type AnamnesisQuestionType = 'text' | 'boolean' | 'boolean_with_text' | 'integer' | 'decimal';

export interface AnamnesisQuestion {
    id: string;
    organizationId: string;
    label: string;
    type: AnamnesisQuestionType;
    order: number;
}

export interface AnamnesisAnswer {
    questionId: string;
    questionLabel: string;
    answer: any; // Can be string, boolean, number, or object for boolean_with_text
}


export interface Customer {
    id: string;
    userId?: string; // Link to User account if one exists
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    address: string;
    isActive: boolean;
    organizationId: string;
    anamnesisAnswers?: AnamnesisAnswer[];
}

export interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    duration: number; // in minutes
    price: number;
    professionalIds: string[]; // IDs of users with 'professional' role
    isActive: boolean;
    organizationId: string;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'rescheduled';

export interface Appointment {
    id: string;
    customerId: string;
    customerName: string;
    serviceId: string;
    serviceName: string;
    professionalId: string;
    professionalName: string;
    start: Date;
    end: Date;
    status: AppointmentStatus;
    notes?: string;
    organizationId: string;
    branchId: string;
}


export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  branchId: string;
  organizationId: string;
  lowStockThreshold: number;
  isSalable: boolean;
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
  items: any[]; // Simplified for historical data viewing
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
    taxRate: number; // Stored as a percentage, e.g., 8 for 8%
    organizationId: string;
}

export type StockEntryType = 'entry' | 'adjustment' | 'sale' | 'transfer';

export interface StockEntry {
    id: string;
    productId: string;
    productName: string;
    // Positive for additions, negative for subtractions
    quantity: number;
    type: StockEntryType;
    date: any; // ServerTimestamp
    userId: string;
    userName: string;
    branchId: string;
    organizationId: string;
    notes?: string;
    // For transfers
    relatedBranchId?: string;
    relatedBranchName?: string;
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

export interface Kit {
  id: string;
  name: string;
  eligibleProductIds: string[];
  numberOfItems: number;
  discountType: DiscountType;
  discountValue: number;
  imageUrl: string;
  branchId: string;
  organizationId: string;
}


export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    paymentStatus: PaymentStatus;
    enabledModules: EnabledModules;
}
