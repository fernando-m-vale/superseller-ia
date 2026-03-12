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

    it('deve usar shipping real persistido e derivados comerciais/reputação', () => {
      const listing = {
        id: 'test',
        title: 'Produto Premium',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 89.9,
        price_base: 109.9,
        price_effective: 89.9,
        stock: 10,
        status: ListingStatus.active,
        has_promotion: true,
        is_free_shipping: true,
        shipping_mode: 'me2',
        is_full_eligible: true,
        logistic_type: 'fulfillment',
        listing_type_id: 'gold_special',
        brand: 'Acme',
        model: 'Turbo X',
        gtin: '7890000000001',
        warranty: '12 meses',
        condition: 'new',
        questions_count: 7,
        reviews_count: 32,
        rating_average: 4.8,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      const signals = buildSignals({
        listing,
        pricing: {
          hasPromotion: true,
        },
      });

      expect(signals.isFreeShipping).toBe(true);
      expect(signals.shippingMode).toBe('me2');
      expect(signals.isFullEligible).toBe(true);
      expect(signals.logisticType).toBe('fulfillment');
      expect(signals.originalPrice).toBe(109.9);
      expect(signals.promotionalPrice).toBe(89.9);
      expect(signals.hasBrand).toBe(true);
      expect(signals.hasModel).toBe(true);
      expect(signals.hasGtin).toBe(true);
      expect(signals.hasWarranty).toBe(true);
      expect(signals.reviewHealth).toBe('strong');
      expect(signals.socialProofStrength).toBe('moderate');
    });

    it('deve sinalizar prova social fraca e cadastro comercial incompleto com linguagem neutra', () => {
      const listing = {
        id: 'test',
        title: 'Produto Essencial',
        tenant_id: 'tenant-1',
        marketplace: 'mercadolivre' as const,
        listing_id_ext: 'MLB123',
        price: 59.9,
        stock: 3,
        status: ListingStatus.active,
        has_promotion: false,
        is_free_shipping: false,
        shipping_mode: null,
        is_full_eligible: null,
        brand: null,
        model: null,
        gtin: null,
        warranty: null,
        questions_count: 1,
        reviews_count: 2,
        rating_average: 4.2,
        created_at: new Date(),
        updated_at: new Date(),
      } as Listing;

      const signals = buildSignals({
        listing,
        pricing: {
          hasPromotion: false,
        },
      });

      expect(signals.isFreeShipping).toBe(false);
      expect(signals.isFullEligible).toBeNull();
      expect(signals.hasBrand).toBe(false);
      expect(signals.hasGtin).toBe(false);
      expect(signals.reviewHealth).toBe('weak');
      expect(signals.socialProofStrength).toBe('weak');
    });
  });
});
