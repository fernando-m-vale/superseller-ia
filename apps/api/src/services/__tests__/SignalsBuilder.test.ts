/**
 * SignalsBuilder Tests - DIA 09
 */

import { describe, it, expect } from 'vitest';
import { Listing, ListingStatus } from '@prisma/client';
import { isKitHeuristic, buildSignals } from '../SignalsBuilder';

describe('SignalsBuilder', () => {
  describe('isKitHeuristic', () => {
    it('deve retornar true quando título contém "kit"', () => {
      const listing = {
        id: 'test',
        title: 'Kit Completo de Ferramentas',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      expect(isKitHeuristic(listing)).toBe(true);
    });

    it('deve retornar true quando título contém "combo"', () => {
      const listing = {
        id: 'test',
        title: 'Combo Especial',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      expect(isKitHeuristic(listing)).toBe(true);
    });

    it('deve retornar true quando título contém "conjunto"', () => {
      const listing = {
        id: 'test',
        title: 'Conjunto de Panelas',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      expect(isKitHeuristic(listing)).toBe(true);
    });

    it('deve retornar true quando título contém "c/"', () => {
      const listing = {
        id: 'test',
        title: 'Produto A c/ Acessório',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      expect(isKitHeuristic(listing)).toBe(true);
    });

    it('deve retornar true quando variationsCount >= 2 e título sugere múltiplos itens', () => {
      const listing = {
        id: 'test',
        title: 'Produto A + Produto B',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      expect(isKitHeuristic(listing, 2)).toBe(true);
    });

    it('deve retornar false quando não há indicadores de kit', () => {
      const listing = {
        id: 'test',
        title: 'Produto Simples',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      expect(isKitHeuristic(listing, 0)).toBe(false);
    });

    it('deve ser case-insensitive', () => {
      const listing = {
        id: 'test',
        title: 'KIT COMPLETO',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      expect(isKitHeuristic(listing)).toBe(true);
    });
  });

  describe('buildSignals', () => {
    it('deve construir signals básicos corretamente', () => {
      const listing = {
        id: 'test',
        title: 'Produto Teste',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        has_promotion: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      const signals = buildSignals({
        listing,
        pricing: {
          hasPromotion: false,
        },
      });

      expect(signals.status).toBe('active');
      expect(signals.price).toBe(100);
      expect(signals.hasPromotion).toBe(false);
      expect(signals.currency).toBe('BRL');
      expect(signals.availableQuantity).toBe(10);
      expect(signals.isOutOfStock).toBe(false);
    });

    it('deve incluir isKitHeuristic quando aplicável', () => {
      const listing = {
        id: 'test',
        title: 'Kit Completo',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 100,
        stock: 10,
        status: ListingStatus.active,
        has_promotion: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      const signals = buildSignals({
        listing,
        pricing: {
          hasPromotion: false,
        },
      });

      expect(signals.isKitHeuristic).toBe(true);
    });
  });
});
