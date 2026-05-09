
import { calculatePivotData, calculateTotals, generatePeriods, getPeriodBoundaries } from './daily-history.utils';
import { startOfDay } from 'date-fns';
import type { StockEntry, Product } from '@/lib/types';

describe('Daily History Utils', () => {
    const d1 = new Date(2026, 4, 1, 10, 0, 0);
    const d2 = new Date(2026, 4, 2, 10, 0, 0);
    const d2_late = new Date(2026, 4, 2, 15, 0, 0);
    const d3 = new Date(2026, 4, 3, 10, 0, 0);

    const mockProducts: Product[] = [
        { 
            id: 'p1', name: 'Product A', category: 'Cat1', organizationId: 'org1', branchId: 'b1', 
            price: 10, isDeleted: false, imageUrl: '', branchIds: ['b1'], lowStockThreshold: 0, 
            isSalable: true, purchasePrice: 0, marginValue: 0, marginType: 'percentage' 
        },
        { 
            id: 'p2', name: 'Product B', category: 'Cat2', organizationId: 'org1', branchId: 'b1', 
            price: 20, isDeleted: false, imageUrl: '', branchIds: ['b1'], lowStockThreshold: 0, 
            isSalable: true, purchasePrice: 0, marginValue: 0, marginType: 'percentage' 
        }
    ];

    const mockEntries: StockEntry[] = [
        { id: 'e1', productId: 'p1', productName: 'Product A', branchId: 'b1', organizationId: 'org1', date: d1, quantity: 10, type: 'entry', userId: 'u1', userName: 'User' },
        { id: 'e2', productId: 'p1', productName: 'Product A', branchId: 'b1', organizationId: 'org1', date: d2, quantity: 5, type: 'entry', userId: 'u1', userName: 'User' },
        { id: 'e3', productId: 'p1', productName: 'Product A', branchId: 'b1', organizationId: 'org1', date: d2_late, quantity: -3, type: 'adjustment', userId: 'u1', userName: 'User' },
        { id: 'e4', productId: 'p2', productName: 'Product B', branchId: 'b1', organizationId: 'org1', date: d2, quantity: 20, type: 'entry', userId: 'u1', userName: 'User' },
    ];

    const dateRange = {
        from: new Date(2026, 4, 1),
        to: new Date(2026, 4, 3)
    };

    test('generatePeriods should create correct dates for daily granularity', () => {
        const periods = generatePeriods(dateRange, 'day');
        expect(periods.length).toBe(3);
        expect(startOfDay(periods[0]).getTime()).toBe(startOfDay(d1).getTime());
    });

    test('calculatePivotData should correctly group and calculate stock flow', () => {
        const periods = generatePeriods(dateRange, 'day');
        const pivotData = calculatePivotData(mockProducts, mockEntries, periods, 'day', '', 'all');

        expect(pivotData.length).toBe(2);
        
        const prodA = pivotData.find(p => p.id === 'p1');
        const keyDay1 = startOfDay(d1).toISOString();
        const keyDay2 = startOfDay(d2).toISOString();

        expect(prodA?.periods[keyDay1]).toBeDefined();
        expect(prodA?.periods[keyDay1].initial).toBe(0);
        expect(prodA?.periods[keyDay1].entries).toBe(10);
        expect(prodA?.periods[keyDay1].final).toBe(10);

        expect(prodA?.periods[keyDay2].initial).toBe(10);
        expect(prodA?.periods[keyDay2].entries).toBe(5);
        expect(prodA?.periods[keyDay2].exits).toBe(3);
        expect(prodA?.periods[keyDay2].final).toBe(12);
    });

    test('calculateTotals should correctly aggregate values from all products', () => {
        const periods = generatePeriods(dateRange, 'day');
        const pivotData = calculatePivotData(mockProducts, mockEntries, periods, 'day', '', 'all');
        const totals = calculateTotals(pivotData, periods, 'day');

        const keyDay2 = startOfDay(d2).toISOString();
        expect(totals[keyDay2].initial).toBe(10);
        expect(totals[keyDay2].entries).toBe(25);
        expect(totals[keyDay2].exits).toBe(3);
        expect(totals[keyDay2].final).toBe(32);
    });
});
