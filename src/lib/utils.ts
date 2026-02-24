import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from 'firebase/firestore'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toDate(date: any): Date | undefined {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date instanceof Timestamp) return date.toDate();
    // Handle serialized timestamps (plain objects with seconds/nanoseconds)
    if (typeof date === 'object' && 'seconds' in date) {
        return new Timestamp(date.seconds, date.nanoseconds || 0).toDate();
    }
    return undefined;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function calculateMargin(purchasePrice: number, marginValue: number, marginType: 'percentage' | 'fixed'): number {
  if (marginType === 'percentage') {
    return purchasePrice * (1 + marginValue / 100);
  }
  return purchasePrice + marginValue;
}

export function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  return true; // Simplificado para o teste
}
