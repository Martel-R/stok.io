

export type UserRole = 'admin' | 'manager' | 'atendimento' | 'customer' | 'professional';
export type PaymentStatus = 'active' | 'overdue' | 'locked';

export interface ModulePermissions {
    view: boolean;
    edit: boolean;
    delete: boolean;
}

export interface EnabledModules {
    dashboard: ModulePermissions;
    products: ModulePermissions;
    combos: ModulePermissions;
    inventory: ModulePermissions;
    pos: ModulePermissions;
    assistant: ModulePermissions;
    reports: ModulePermissions;
    settings: ModulePermissions;
    kits: ModulePermissions;
    customers: ModulePermissions;
    appointments: ModulePermissions;
    services: ModulePermissions;
    expenses: ModulePermissions;
    backup: ModulePermissions;
    subscription: ModulePermissions;
    chat?: ModulePermissions;
}

export interface PermissionProfile {
    id: string;
    name: string;
    organizationId: string;
    permissions: EnabledModules;
    isDeleted?: boolean;
}

export interface TimeSlot {
    start: string; // "HH:mm"
    end: string;   // "HH:mm"
}

export interface DayAvailability {
    enabled: boolean;
    slots: TimeSlot[];
}

export interface Availability {
    sunday: DayAvailability;
    monday: DayAvailability;
    tuesday: DayAvailability;
    wednesday: DayAvailability;
    thursday: DayAvailability;
    friday: DayAvailability;
    saturday: DayAvailability;
}


export interface User {
  id: string;
  name: string;
  email: string;
  role: string; // Can be a role name or a permission profile ID
  avatar: string;
  password?: string;
  organizationId: string;
  paymentStatus?: PaymentStatus;
  enabledModules?: EnabledModules;
  customerId?: string; // Link to customer profile if role is 'customer'
  availability?: Availability;
  isImpersonating?: boolean;
  isDeleted?: boolean;
}

export type AnamnesisQuestionType = 'text' | 'boolean' | 'boolean_with_text' | 'integer' | 'decimal';

export interface AnamnesisQuestion {
    id: string;
    organizationId: string;
    label: string;
    type: AnamnesisQuestionType;
    order: number;
    isDeleted?: boolean;
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
    branchId?: string; // Added for portal requests
    anamnesisAnswers?: AnamnesisAnswer[];
    isDeleted?: boolean;
}

export interface ServiceProduct {
    productId: string;
    productName: string;
    quantity: number;
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
    linkedProducts: ServiceProduct[];
    isDeleted?: boolean;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'rescheduled' | 'pending-confirmation' | 'in-progress-payment-pending';

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
    attendanceId?: string;
    isDeleted?: boolean;
}

export interface AttendanceItem {
    id: string; // Can be product or service ID
    name: string;
    type: 'product' | 'service';
    quantity: number;
    price: number;
    total: number;
}

export type AttendanceStatus = 'pending' | 'in-progress' | 'completed';
export type AttendancePaymentStatus = 'pending' | 'paid';

export interface Attendance {
    id: string;
    organizationId: string;
    branchId: string;
    appointmentId: string;
    customerId: string;
    customerName: string;
    professionalId: string;
    professionalName: string;
    date: any; // server timestamp
    items: AttendanceItem[];
    notes?: string;
    photos: string[];
    status: AttendanceStatus;
    paymentStatus: AttendancePaymentStatus;
    total: number;
}

export interface Supplier {
    id: string;
    name: string;
    cnpj?: string;
    ie?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    organizationId: string;
    isDeleted?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  branchId: string; // Este campo não será mais usado para lógica de filial única
  branchIds: string[]; // Novo campo para múltiplas filiais
  organizationId: string;
  lowStockThreshold: number;
  isSalable: boolean;
  barcode?: string;
  order?: number;
  purchasePrice: number;
  marginValue: number;
  marginType: 'percentage' | 'fixed';
  supplierId?: string;
  supplierName?: string;
  code?: string;
  brand?: string;
  model?: string;
  isPerishable?: boolean;
  ncm?: string;
  cfop?: string;
  unitOfMeasure?: string;
  isDeleted?: boolean;
}

export type PaymentConditionType = 'credit' | 'debit' | 'cash' | 'pix';

export interface PaymentCondition {
    id: string;
    name: string;
    type: PaymentConditionType;
    fee: number;
    feeType: 'percentage' | 'fixed';
    organizationId: string;
    maxInstallments?: number;
    isDeleted?: boolean;
}

export interface PaymentDetail {
    conditionId: string;
    conditionName: string;
    type: PaymentConditionType;
    amount: number;
    installments: number;
    receiptCode?: string;
}

export type SaleStatus = 'completed' | 'cancelled';

export interface SaleItemProduct {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  type: 'product' | 'service';
}

export interface SaleItemKit {
  id: string;
  name: string;
  quantity: number;
  total: number;
  type: 'kit';
  chosenProducts: { id: string; name: string; price: number; }[];
}

export interface SaleItemCombo {
  id: string;
  name: string;
  quantity: number;
  originalPrice: number;
  finalPrice: number;
  type: 'combo';
  products: { productId: string; productName: string; quantity: number; productPrice: number }[];
}

export type SaleItem = SaleItemProduct | SaleItemKit | SaleItemCombo;

export interface Sale {
  id:string;
  items: SaleItem[];
  total: number;
  date: Date;
  cashier: string;
  branchId: string;
  organizationId: string;
  payments: PaymentDetail[];
  status: SaleStatus;
  attendanceId?: string; // Link to the attendance if sale came from one
  customerId?: string; // Link to customer for direct sales
}

export interface Branch {
    id: string;
    name: string;
    cnpj: string;
    location: string;
    userIds: string[];
    taxRate: number; // Stored as a percentage, e.g., 8 for 8%
    organizationId: string;
    allowNegativeStock?: boolean;
    isDeleted?: boolean;
}

export type StockEntryType = 'entry' | 'adjustment' | 'sale' | 'transfer' | 'cancellation';

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
    expirationDate?: any; // Timestamp
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
  isDeleted?: boolean;
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
  isDeleted?: boolean;
}

export interface BrandingSettings {
    logoUrl?: string;
    primaryColor?: string; // HSL format string e.g. "240 10% 3.9%"
}

export type PaymentRecordStatus = 'pending' | 'paid' | 'overdue';

export interface PaymentRecord {
    id: string;
    date: any; // Timestamp for the due date
    paidDate?: any; // Timestamp for when it was paid
    amount: number;
    paidAmount?: number;
    status: PaymentRecordStatus;
    recordedBy?: string; // User ID of admin who recorded it
    paymentMethod?: string;
    boletoUrl?: string;
    notes?: string;
}

export interface Subscription {
    planId?: string;
    planName: string;
    price: number;
    startDate: any; // Timestamp
    endDate: any; // Timestamp
    paymentRecords: PaymentRecord[];
    maxBranches: number;
    maxUsers: number;
}


export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    paymentStatus: PaymentStatus;
    enabledModules: EnabledModules;
    branding?: BrandingSettings;
    subscription?: Subscription;
    evolutionApiConfig?: EvolutionApiConfig;
}

export type ExpenseStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Expense {
    id: string;
    organizationId: string;
    branchId: string;
    description: string;
    amount: number;
    category: string;
    date: any; // Entry date/Launch date
    dueDate: any; // Vencimento
    paymentDate?: any; // Pagamento
    status: ExpenseStatus;
    notes?: string;
    supplierId?: string;
    supplierName?: string;
    userId: string;
    userName: string;
    linkedUserId?: string; // Para salários
    linkedUserName?: string; // Para salários
    nfeNumber?: string;
    receiptUrl?: string; // Comprovante
    paidAmount?: number;
    isDeleted?: boolean;
}

export interface PricingPlan {
    id: string;
    name: string;
    price: number;
    description: string;
    features: string[];
    maxBranches: number;
    maxUsers: number;
    isFeatured?: boolean;
    isDeleted?: boolean;
}

export type FormFieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'radio';

export interface FormField {
    id: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    options?: string[];
    placeholder?: string;
    order: number;
}

export interface FormTemplate {
    id: string;
    name: string;
    organizationId: string;
    fields: FormField[];
    isDeleted?: boolean;
}

export interface ClinicalRecord {
    id: string;
    customerId: string;
    customerName: string;
    professionalId: string;
    professionalName: string;
    date: any; // Timestamp
    templateId: string;
    templateName: string;
    answers: Record<string, any>;
    organizationId: string;
    branchId: string;
    status?: string; // Added status
    isDeleted?: boolean;
}

export type CustomerFormFieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'radio';

export interface CustomerFormField {
    id: string;
    label: string;
    type: CustomerFormFieldType;
    required: boolean;
    options?: string[];
    placeholder?: string;
    order: number;
}

export interface CustomerFormTemplate {
    id: string;
    name?: string; // Added name
    organizationId: string;
    fields: CustomerFormField[];
}

export interface EvolutionApiConfig {
    enabled: boolean;
    apiUrl: string;
    apiKey: string;
    instanceName: string;
    endpoint?: string;
}
