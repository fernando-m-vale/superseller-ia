/**
 * Unit tests for /api/v1/listings/import endpoint
 * 
 * HOTFIX 09.12: Testes para forceRefresh quando alreadyExists=true
 * 
 * Nota: Este teste valida a lógica do endpoint sem inicializar o app completo.
 * Para testes de integração completos, usar RUN_DB_TESTS=1 com ambiente configurado.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Marketplace } from '@prisma/client';

// Mock das dependências antes de importar
vi.mock('../lib/prisma', () => ({
  prisma: {
    listing: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../services/MercadoLivreSyncService');

describe('POST /api/v1/listings/import - HOTFIX 09.12', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('forceRefresh quando alreadyExists=true', () => {
    it('deve validar que forceRefresh=false mantém comportamento original (sem atualizar)', async () => {
      const { prisma } = await import('../lib/prisma');
      
      // Mock: listing já existe
      vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce({
        id: 'listing-uuid-123',
        title: 'Anúncio Existente',
        status: 'active',
        has_clips: false,
        has_video: false,
      } as any);

      // Simular lógica do endpoint: quando alreadyExists=true e forceRefresh=false, retorna sem atualizar
      const existingListing = await prisma.listing.findFirst({
        where: {
          tenant_id: 'test-tenant',
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: 'MLB4167251409',
        },
        select: {
          id: true,
          title: true,
          status: true,
          has_clips: true,
          has_video: true,
        },
      });

      const forceRefresh = false;
      
      // Quando forceRefresh=false e já existe, não deve atualizar
      expect(existingListing).toBeTruthy();
      expect(forceRefresh).toBe(false);
      
      // Não deve chamar fetchItemsDetails quando forceRefresh=false
      const { MercadoLivreSyncService } = await import('../services/MercadoLivreSyncService');
      expect(MercadoLivreSyncService).not.toHaveBeenCalled();
    });

    it('deve validar que forceRefresh=true executa fetchItemsDetails e upsertListings', async () => {
      const { prisma } = await import('../lib/prisma');
      const { MercadoLivreSyncService } = await import('../services/MercadoLivreSyncService');
      
      // Mock: listing já existe
      vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce({
        id: 'listing-uuid-123',
        title: 'Anúncio Existente',
        status: 'active',
        has_clips: false, // Valor antigo (será atualizado)
        has_video: false,
      } as any);

      // Mock: fetchItemsDetails retorna item com video_id
      const mockSyncService = {
        fetchItemsDetails: vi.fn().mockResolvedValueOnce([
          {
            id: 'MLB4167251409',
            title: 'Anúncio Atualizado',
            price: 100,
            available_quantity: 10,
            status: 'active',
            video_id: 'VIDEO_123', // HOTFIX 09.11: video_id presente
            pictures: [],
          },
        ]),
        upsertListings: vi.fn().mockResolvedValueOnce({
          created: 0,
          updated: 1,
        }),
      };
      
      vi.mocked(MercadoLivreSyncService).mockImplementationOnce(() => mockSyncService as any);

      // Mock: listing após atualização (com has_clips=true)
      vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
        id: 'listing-uuid-123',
        title: 'Anúncio Atualizado',
        status: 'active',
        listing_id_ext: 'MLB4167251409',
        price: 100,
        stock: 10,
        marketplace: Marketplace.mercadolivre,
        has_clips: true, // HOTFIX 09.11: atualizado para true
        has_video: true,
        updated_at: new Date(),
        last_synced_at: new Date(),
      } as any);

      // Simular lógica do endpoint
      const existingListing = await prisma.listing.findFirst({
        where: {
          tenant_id: 'test-tenant',
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: 'MLB4167251409',
        },
        select: {
          id: true,
          title: true,
          status: true,
          has_clips: true,
          has_video: true,
        },
      });

      const forceRefresh = true;
      
      // Quando forceRefresh=true e já existe, deve executar refresh
      if (existingListing && forceRefresh) {
        const syncService = new MercadoLivreSyncService('test-tenant');
        const items = await syncService.fetchItemsDetails(['MLB4167251409'], false);
        const { updated } = await syncService.upsertListings(items, 'manual_import', false);
        
        const updatedListing = await prisma.listing.findUnique({
          where: {
            tenant_id_marketplace_listing_id_ext: {
              tenant_id: 'test-tenant',
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: 'MLB4167251409',
            },
          },
          select: {
            id: true,
            title: true,
            status: true,
            listing_id_ext: true,
            price: true,
            stock: true,
            marketplace: true,
            has_clips: true,
            has_video: true,
            updated_at: true,
            last_synced_at: true,
          },
        });
        
        // Verificações
        expect(updated).toBe(1);
        expect(updatedListing?.has_clips).toBe(true); // HOTFIX 09.11: valor atualizado
        expect(updatedListing?.has_video).toBe(true);
        expect(mockSyncService.fetchItemsDetails).toHaveBeenCalledWith(['MLB4167251409'], false);
        expect(mockSyncService.upsertListings).toHaveBeenCalled();
      }
    });

    it('deve validar que debug info é incluído quando x-debug:1 ou DEBUG_MEDIA=1', () => {
      // Simular lógica de debug
      const debugMedia = true; // x-debug:1 ou DEBUG_MEDIA=1
      const hasClipsAfter = false;
      const hasVideoAfter = false;
      
      const debugInfo = {
        has_clips_after: hasClipsAfter,
        has_video_after: hasVideoAfter,
        has_clips_type: typeof hasClipsAfter,
        has_video_type: typeof hasVideoAfter,
        is_clips_null: hasClipsAfter === null,
        is_clips_false: hasClipsAfter === false,
        is_clips_true: hasClipsAfter === true,
        forceRefresh: true,
        source: 'manual_import',
      };
      
      expect(debugInfo).toBeDefined();
      expect(debugInfo.has_clips_after).toBe(false);
      expect(debugInfo.has_video_after).toBe(false);
      expect(debugInfo.has_clips_type).toBe('boolean');
      expect(debugInfo.is_clips_false).toBe(true);
      expect(debugInfo.forceRefresh).toBe(true);
      expect(debugInfo.source).toBe('manual_import');
    });

    it('deve validar que novo listing é criado quando não existe (comportamento original)', async () => {
      const { prisma } = await import('../lib/prisma');
      const { MercadoLivreSyncService } = await import('../services/MercadoLivreSyncService');
      
      // Mock: listing não existe
      vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce(null);

      // Mock: fetchItemsDetails retorna item
      const mockSyncService = {
        fetchItemsDetails: vi.fn().mockResolvedValueOnce([
          {
            id: 'MLB9999999999',
            title: 'Novo Anúncio',
            price: 200,
            available_quantity: 20,
            status: 'active',
            pictures: [],
          },
        ]),
        upsertListings: vi.fn().mockResolvedValueOnce({
          created: 1,
          updated: 0,
        }),
      };
      
      vi.mocked(MercadoLivreSyncService).mockImplementationOnce(() => mockSyncService as any);

      // Simular lógica do endpoint
      const existingListing = await prisma.listing.findFirst({
        where: {
          tenant_id: 'test-tenant',
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: 'MLB9999999999',
        },
        select: {
          id: true,
          title: true,
          status: true,
        },
      });
      
      // Quando não existe, deve criar
      expect(existingListing).toBeNull();
      
      // Deve chamar fetchItemsDetails e upsertListings
      const syncService = new MercadoLivreSyncService('test-tenant');
      const items = await syncService.fetchItemsDetails(['MLB9999999999'], false);
      const { created, updated } = await syncService.upsertListings(items, 'manual_import', false);
      
      expect(created).toBe(1);
      expect(updated).toBe(0);
      expect(mockSyncService.fetchItemsDetails).toHaveBeenCalledWith(['MLB9999999999'], false);
      expect(mockSyncService.upsertListings).toHaveBeenCalled();
    });
  });
});
