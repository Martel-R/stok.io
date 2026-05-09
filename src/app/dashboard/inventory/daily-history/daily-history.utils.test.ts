
import { calculatePivotData, calculateTotals, generatePeriods, getPeriodBoundaries } from './daily-history.utils';
import { startOfDay } from 'date-fns';
import type { StockEntry, Product } from '@/lib/types';

describe('Daily History Utils', () => {
    // Usar datas locais consistentes para evitar problemas de fuso horário em testes
    const d1 = new Date(2026, 4, 1, 10, 0, 0); // 1 de Maio
    const d2 = new Date(2026, 4, 2, 10, 0, 0); // 2 de Maio
    const d2_late = new Date(2026, 4, 2, 15, 0, 0); // 2 de Maio tarde
    const d3 = new Date(2026, 4, 3, 10, 0, 0); // 3 de Maio

    const mockProducts: Product[] = [
        { id: 'p1', name: 'Product A', category: 'Cat1', organizationId: 'org1', branchId: 'b1', price: 10, stock: 10, unit: 'un', isDeleted: false },
        { id: 'p2', name: 'Product B', category: 'Cat2', organizationId: 'org1', branchId: 'b1', price: 20, stock: 20, unit: 'un', isDeleted: false }
    ];

    const mockEntries: StockEntry[] = [
        { id: 'e1', productId: 'p1', productName: 'Product A', branchId: 'b1', organizationId: 'org1', date: d1, quantity: 10, type: 'entry', userId: 'u1', userName: 'User', createdAt: new Date() },
        { id: 'e2', productId: 'p1', productName: 'Product A', branchId: 'b1', organizationId: 'org1', date: d2, quantity: 5, type: 'entry', userId: 'u1', userName: 'User', createdAt: new Date() },
        { id: 'e3', productId: 'p1', productName: 'Product A', branchId: 'b1', organizationId: 'org1', date: d2_late, quantity: -3, type: 'adjustment', userId: 'u1', userName: 'User', createdAt: new Date() },
        { id: 'e4', productId: 'p2', productName: 'Product B', branchId: 'b1', organizationId: 'org1', date: d2, quantity: 20, type: 'entry', userId: 'u1', userName: 'User', createdAt: new Date() },
    ];

    const dateRange = {
        from: new Date(2026, 4, 1),
        to: new Date(2026, 4, 3)
    };

    test('generatePeriods should create correct dates for daily granularity', () => {
        const periods = generatePeriods(dateRange, 'day');
        // De 1 a 3 inclusive = 3 dias
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
        // Dia 1: Inicial 0, Entrada 10, Saída 0, Final 10
        expect(prodA?.periods[keyDay1].initial).toBe(0);
        expect(prodA?.periods[keyDay1].entries).toBe(10);
        expect(prodA?.periods[keyDay1].final).toBe(10);

        // Dia 2: Inicial 10, Entrada 5, Saída 3, Final 12
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
        // Dia 2 Totais: 
        // ProdA: In 10, Ent 5, Sai 3, Fin 12
        // ProdB: In 0, Ent 20, Sai 0, Fin 20
        // Total: In 10, Ent 25, Sai 3, Fin 32
        expect(totals[keyDay2].initial).toBe(10);
        expect(totals[keyDay2].entries).toBe(25);
        expect(totals[keyDay2].exits).toBe(3);
        expect(totals[keyDay2].final).toBe(32);
    });
});
