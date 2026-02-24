
import { filterOrganizations, calculateStats } from "./super-admin.utils";
import type { Organization, User, PaymentStatus } from "@/lib/types";

type OrgWithUser = Organization & { owner?: User };

describe('Super-Admin Business Logic', () => {
  const mockOrgs: OrgWithUser[] = [
    { 
      id: '1', name: 'Tech Corp', ownerId: 'o1', paymentStatus: 'active' as PaymentStatus, 
      enabledModules: {} as any, 
      owner: { id: 'o1', name: 'John Doe', email: 'john@tech.com' } as User 
    },
    { 
      id: '2', name: 'Bakery SA', ownerId: 'o2', paymentStatus: 'overdue' as PaymentStatus, 
      enabledModules: {} as any, 
      owner: { id: 'o2', name: 'Maria Silva', email: 'maria@bakery.com' } as User 
    },
    { 
      id: '3', name: 'Locked Inc', ownerId: 'o3', paymentStatus: 'locked' as PaymentStatus, 
      enabledModules: {} as any, 
      owner: { id: 'o3', name: 'Peter Pan', email: 'peter@neverland.com' } as User 
    },
  ];

  describe('filterOrganizations', () => {
    it('should return all organizations if no filter is applied', () => {
      const result = filterOrganizations(mockOrgs, '', 'all');
      expect(result).toHaveLength(3);
    });

    it('should filter by organization name', () => {
      const result = filterOrganizations(mockOrgs, 'Tech', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Tech Corp');
    });

    it('should filter by owner name', () => {
      const result = filterOrganizations(mockOrgs, 'Maria', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].owner?.name).toBe('Maria Silva');
    });

    it('should filter by owner email', () => {
      const result = filterOrganizations(mockOrgs, 'neverland.com', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].owner?.email).toBe('peter@neverland.com');
    });

    it('should filter by payment status', () => {
      const result = filterOrganizations(mockOrgs, '', 'active');
      expect(result).toHaveLength(1);
      expect(result[0].paymentStatus).toBe('active');
    });

    it('should combine search term and status filter', () => {
      const result = filterOrganizations(mockOrgs, 'Tech', 'active');
      expect(result).toHaveLength(1);
      
      const noResult = filterOrganizations(mockOrgs, 'Tech', 'locked');
      expect(noResult).toHaveLength(0);
    });
  });

  describe('calculateStats', () => {
    it('should calculate stats correctly', () => {
      const stats = calculateStats(mockOrgs);
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.overdue).toBe(1);
      expect(stats.locked).toBe(1);
    });

    it('should return zero stats for empty list', () => {
      const stats = calculateStats([]);
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
    });
  });
});
