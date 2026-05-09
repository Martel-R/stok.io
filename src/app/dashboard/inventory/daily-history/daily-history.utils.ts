
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StockEntry, Product } from '@/lib/types';

export type Granularity = 'day' | 'week' | 'month';

export interface PeriodData {
    initial: number;
    entries: number;
    exits: number;
    final: number;
    details: StockEntry[];
    periodStart: Date;
    periodEnd: Date;
}

export interface ProductPivot {
    id: string;
    name: string;
    category?: string;
    periods: Record<string, PeriodData>;
}

export const getPeriodBoundaries = (date: Date, granularity: Granularity) => {
    switch (granularity) {
        case 'day':
            return { start: startOfDay(date), end: endOfDay(date) };
        case 'week':
            return { start: startOfWeek(date, { locale: ptBR }), end: endOfWeek(date, { locale: ptBR }) };
        case 'month':
            return { start: startOfMonth(date), end: endOfMonth(date) };
    }
};

export const generatePeriods = (dateRange: { from: Date, to: Date }, granularity: Granularity) => {
    const start = startOfDay(dateRange.from);
    const end = endOfDay(dateRange.to);

    switch (granularity) {
        case 'day': return eachDayOfInterval({ start, end });
        case 'week': return eachWeekOfInterval({ start, end }, { locale: ptBR });
        case 'month': return eachMonthOfInterval({ start, end });
        default: return [];
    }
};

export const calculatePivotData = (
    products: Product[],
    allStockEntries: StockEntry[],
    periods: Date[],
    granularity: Granularity,
    searchQuery: string,
    selectedCategory: string
) => {
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return filteredProducts.map(product => {
        const productEntries = allStockEntries.filter(e => e.productId === product.id);
        const periodMap: Record<string, PeriodData> = {};

        periods.forEach(periodDate => {
            const { start: periodStart, end: periodEnd } = getPeriodBoundaries(periodDate, granularity);
            const key = periodStart.toISOString();

            const initialStock = productEntries
                .filter(e => e.date < periodStart)
                .reduce((sum, e) => sum + e.quantity, 0);

            const periodEntries = productEntries.filter(e => e.date >= periodStart && e.date <= periodEnd);
            const inQty = periodEntries.filter(e => e.quantity > 0).reduce((sum, e) => sum + e.quantity, 0);
            const outQty = Math.abs(periodEntries.filter(e => e.quantity < 0).reduce((sum, e) => sum + e.quantity, 0));
            
            periodMap[key] = {
                initial: initialStock,
                entries: inQty,
                exits: outQty,
                final: initialStock + inQty - outQty,
                details: periodEntries,
                periodStart,
                periodEnd
            };
        });

        return { id: product.id, name: product.name, category: product.category, periods: periodMap };
    }).sort((a, b) => a.name.localeCompare(b.name));
};

export const calculateTotals = (pivotData: ProductPivot[], periods: Date[], granularity: Granularity) => {
    const periodTotals: Record<string, { initial: number, entries: number, exits: number, final: number }> = {};

    periods.forEach(period => {
        const { start: periodStart } = getPeriodBoundaries(period, granularity);
        const key = periodStart.toISOString();
        periodTotals[key] = { initial: 0, entries: 0, exits: 0, final: 0 };
    });

    pivotData.forEach(prod => {
        Object.entries(prod.periods).forEach(([key, data]) => {
            if (periodTotals[key]) {
                periodTotals[key].initial += data.initial;
                periodTotals[key].entries += data.entries;
                periodTotals[key].exits += data.exits;
                periodTotals[key].final += data.final;
            }
        });
    });
    return periodTotals;
};
