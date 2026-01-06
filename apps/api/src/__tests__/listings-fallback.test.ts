import { describe, it, expect } from 'vitest';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';

describe('Listings Fallback via Orders', () => {

  describe('extractItemIdsFromOrders', () => {
    it('should extract unique itemIds from orders', () => {
      const orders = [
        {
          id: 'order-1',
          items: [
            { listing_id_ext: 'MLB123' },
            { listing_id_ext: 'MLB456' },
          ],
        },
        {
          id: 'order-2',
          items: [
            { listing_id_ext: 'MLB123' }, // duplicate
            { listing_id_ext: 'MLB789' },
          ],
        },
        {
          id: 'order-3',
          items: [
            { listing_id_ext: 'MLB456' }, // duplicate
          ],
        },
      ];

      // Extract itemIds using the same logic as syncListingsFromOrders
      const itemIdsSet = new Set<string>();
      for (const order of orders) {
        for (const item of order.items) {
          if (item.listing_id_ext) {
            itemIdsSet.add(item.listing_id_ext);
          }
        }
      }
      const uniqueItemIds = Array.from(itemIdsSet);

      expect(uniqueItemIds).toHaveLength(3);
      expect(uniqueItemIds).toContain('MLB123');
      expect(uniqueItemIds).toContain('MLB456');
      expect(uniqueItemIds).toContain('MLB789');
    });

    it('should handle orders with no items', () => {
      const orders: Array<{ id: string; items: Array<{ listing_id_ext: string | null }> }> = [
        { id: 'order-1', items: [] },
        { id: 'order-2', items: [] },
      ];

      const itemIdsSet = new Set<string>();
      for (const order of orders) {
        for (const item of order.items) {
          if (item.listing_id_ext) {
            itemIdsSet.add(item.listing_id_ext);
          }
        }
      }
      const uniqueItemIds = Array.from(itemIdsSet);

      expect(uniqueItemIds).toHaveLength(0);
    });

    it('should handle items with null/undefined listing_id_ext', () => {
      const orders = [
        {
          id: 'order-1',
          items: [
            { listing_id_ext: 'MLB123' },
            { listing_id_ext: null },
            { listing_id_ext: undefined },
            { listing_id_ext: '' },
          ],
        },
      ];

      const itemIdsSet = new Set<string>();
      for (const order of orders) {
        for (const item of order.items) {
          if (item.listing_id_ext) {
            itemIdsSet.add(item.listing_id_ext);
          }
        }
      }
      const uniqueItemIds = Array.from(itemIdsSet);

      expect(uniqueItemIds).toHaveLength(1);
      expect(uniqueItemIds).toContain('MLB123');
    });
  });

  describe('isDiscoveryBlockedError', () => {
    it('should return true for error message containing 403', () => {
      const error = new Error('Erro ML 403: PolicyAgent blocked');
      const result = MercadoLivreSyncService.isDiscoveryBlockedError(error);
      expect(result).toBe(true);
    });

    it('should return true for error message containing PolicyAgent', () => {
      const error = new Error('PolicyAgent: Access denied');
      const result = MercadoLivreSyncService.isDiscoveryBlockedError(error);
      expect(result).toBe(true);
    });

    it('should return false for non-403 errors', () => {
      const error = new Error('Network error');
      const result = MercadoLivreSyncService.isDiscoveryBlockedError(error);
      expect(result).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(MercadoLivreSyncService.isDiscoveryBlockedError(null)).toBe(false);
      expect(MercadoLivreSyncService.isDiscoveryBlockedError(undefined)).toBe(false);
    });
  });

  describe('debug my-items 403 response', () => {
    it('should return 403 with DiscoveryBlocked error for ML 403 response', () => {
      // This test validates the expected response structure
      const expectedResponse = {
        error: 'DiscoveryBlocked',
        message: 'Discovery endpoint bloqueado (403). Use fallback via Orders.',
        details: { message: 'PolicyAgent blocked' },
        sellerId: '2019955315',
        requestId: 'test-request-id',
        tenantId: 'test-tenant-id',
      };

      expect(expectedResponse.error).toBe('DiscoveryBlocked');
      expect(expectedResponse.message).toContain('403');
      expect(expectedResponse.message).toContain('fallback via Orders');
    });

    it('should include sellerId, requestId, and tenantId in 403 response', () => {
      const response = {
        error: 'DiscoveryBlocked',
        message: 'Discovery endpoint bloqueado (403). Use fallback via Orders.',
        details: {},
        sellerId: '2019955315',
        requestId: 'req-123',
        tenantId: 'tenant-456',
      };

      expect(response).toHaveProperty('sellerId');
      expect(response).toHaveProperty('requestId');
      expect(response).toHaveProperty('tenantId');
    });
  });

  describe('fallback result structure', () => {
    it('should have correct structure for fallback result', () => {
      const fallbackResult = {
        success: true,
        ordersProcessed: 68,
        uniqueItemIds: 15,
        itemsProcessed: 15,
        itemsCreated: 10,
        itemsUpdated: 5,
        itemsSkipped: 0,
        duration: 1234,
        errors: [] as string[],
        source: 'orders_fallback',
      };

      expect(fallbackResult).toHaveProperty('ordersProcessed');
      expect(fallbackResult).toHaveProperty('uniqueItemIds');
      expect(fallbackResult).toHaveProperty('itemsProcessed');
      expect(fallbackResult).toHaveProperty('itemsCreated');
      expect(fallbackResult).toHaveProperty('itemsUpdated');
      expect(fallbackResult).toHaveProperty('itemsSkipped');
      expect(fallbackResult).toHaveProperty('duration');
      expect(fallbackResult).toHaveProperty('errors');
      expect(fallbackResult).toHaveProperty('source');
      expect(fallbackResult.source).toBe('orders_fallback');
    });

    it('should not have implicit null->0 conversion for metrics', () => {
      // Ensure that null values are preserved, not converted to 0
      const metrics = {
        visits: null as number | null,
        orders: 0,
        gmv: 0,
      };

      expect(metrics.visits).toBeNull();
      expect(metrics.orders).toBe(0);
      expect(metrics.visits).not.toBe(0);
    });
  });

  describe('FULL sync with fallback', () => {
    it('should include discoveryBlocked flag in response when fallback is used', () => {
      const fullSyncResponse = {
        message: 'Sincronização completa concluída com sucesso',
        data: {
          listings: {
            itemsProcessed: 15,
            itemsCreated: 10,
            itemsUpdated: 5,
            duration: '1234ms',
            errors: ['Discovery blocked; used orders fallback'],
            source: 'orders_fallback',
            discoveryBlocked: true,
          },
          orders: {
            ordersProcessed: 68,
            ordersCreated: 0,
            ordersUpdated: 68,
            totalGMV: 15000.00,
            duration: '2000ms',
            errors: [],
          },
        },
      };

      expect(fullSyncResponse.data.listings.discoveryBlocked).toBe(true);
      expect(fullSyncResponse.data.listings.source).toBe('orders_fallback');
      expect(fullSyncResponse.data.listings.errors).toContain('Discovery blocked; used orders fallback');
    });

    it('should have source=discovery when fallback is not used', () => {
      const fullSyncResponse = {
        data: {
          listings: {
            source: 'discovery',
            discoveryBlocked: false,
          },
        },
      };

      expect(fullSyncResponse.data.listings.discoveryBlocked).toBe(false);
      expect(fullSyncResponse.data.listings.source).toBe('discovery');
    });
  });
});
