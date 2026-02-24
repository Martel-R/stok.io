
import type { Organization, User, PaymentStatus } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

type OrgWithUser = Organization & { owner?: User };

/**
 * Helper to flatten objects and format dates for Excel
 */
const formatDataForExcel = (data: any[]) => {
    return data.map(item => {
        const newItem: any = {};
        for (const key in item) {
            const value = item[key];
            // Converte Timestamps do Firestore
            if (value && typeof value === 'object' && 'seconds' in value) {
                newItem[key] = format(new Date(value.seconds * 1000), 'dd/MM/yyyy HH:mm');
            } else if (Array.isArray(value)) {
                newItem[key] = JSON.stringify(value);
            } else if (typeof value === 'object' && value !== null) {
                newItem[key] = JSON.stringify(value);
            } else {
                newItem[key] = value;
            }
        }
        return newItem;
    });
};

/**
 * Exports all organization data to a multi-sheet Excel file.
 */
export async function exportOrganizationData(orgId: string, orgName: string) {
    const collectionsToExport = [
        { name: 'Usuarios', id: 'users' },
        { name: 'Filiais', id: 'branches' },
        { name: 'Produtos', id: 'products' },
        { name: 'Vendas', id: 'sales' },
        { name: 'Clientes', id: 'customers' },
        { name: 'Servicos', id: 'services' },
        { name: 'Atendimentos', id: 'attendances' },
        { name: 'Agendamentos', id: 'appointments' },
        { name: 'Despesas', id: 'expenses' },
        { name: 'Prontuarios', id: 'clinicalRecords' }
    ];

    const workbook = XLSX.utils.book_new();

    for (const col of collectionsToExport) {
        const q = query(collection(db, col.id), where("organizationId", "==", orgId));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (data.length > 0) {
            const formattedData = formatDataForExcel(data);
            const worksheet = XLSX.utils.json_to_sheet(formattedData);
            XLSX.utils.book_append_sheet(workbook, worksheet, col.name);
        }
    }

    // Gerar o arquivo e disparar o download
    const fileName = `Backup_${orgName.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

/**
 * Filter organizations by search term and payment status.
 */
export function filterOrganizations(
    organizations: OrgWithUser[], 
    searchTerm: string, 
    statusFilter: string
): OrgWithUser[] {
    const term = searchTerm.toLowerCase().trim();
    
    return organizations.filter(org => {
        const matchesSearch = !term || 
                             org.name.toLowerCase().includes(term) || 
                             org.owner?.name?.toLowerCase().includes(term) ||
                             org.owner?.email?.toLowerCase().includes(term);
        
        const matchesStatus = statusFilter === 'all' || org.paymentStatus === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
}

/**
 * Calculate dashboard stats from organizations.
 */
export function calculateStats(organizations: Organization[]) {
    const total = organizations.length;
    const active = organizations.filter(o => o.paymentStatus === 'active').length;
    const overdue = organizations.filter(o => o.paymentStatus === 'overdue').length;
    const locked = organizations.filter(o => o.paymentStatus === 'locked').length;
    
    // MRR (Receita Recorrente Mensal) - Soma dos preços dos planos das orgs ativas
    const mrr = organizations
        .filter(o => o.paymentStatus === 'active' && o.subscription?.price)
        .reduce((sum, o) => sum + (o.subscription?.price || 0), 0);

    // Receita em Atraso - Soma do valor das parcelas 'pending' de orgs 'overdue'
    const overdueRevenue = organizations
        .filter(o => o.paymentStatus === 'overdue')
        .reduce((sum, o) => {
            const pendingAmount = o.subscription?.paymentRecords
                ?.filter(p => p.status === 'pending')
                .reduce((pSum, p) => pSum + p.amount, 0) || 0;
            return sum + pendingAmount;
        }, 0);
    
    return { total, active, overdue, locked, mrr, overdueRevenue };
}
