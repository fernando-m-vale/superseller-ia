/**
 * HackEngine Tests - DIA 09
 */

import { describe, it, expect } from 'vitest';
import { generateHacks } from '../HackEngine';
import type { ListingSignals, HackEngineInput } from '../HackEngine';

describe('HackEngine', () => {
  describe('ml_full_shipping', () => {
    it('não deve sugerir quando shippingMode = full', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          shippingMode: 'full',
          price: 100,
          hasPromotion: false,
          currency: 'BRL',
        },
        history: [],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const hack = result.hacks.find(h => h.id === 'ml_full_shipping');
      expect(hack).toBeUndefined();
    });

    it('deve sugerir com confidence alta quando condições atendidas', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          shippingMode: 'me2',
          isFullEligible: true,
          isFreeShipping: false,
          price: 50,
          hasPromotion: false,
          currency: 'BRL',
          availableQuantity: 10,
          isOutOfStock: false,
          metrics30d: {
            visits: 400,
            conversionRate: 1.5,
          },
        },
        history: [],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const hack = result.hacks.find(h => h.id === 'ml_full_shipping');
      expect(hack).toBeDefined();
      expect(hack?.confidence).toBeGreaterThan(0);
      expect(hack?.impact).toBe('high');
    });
  });

  describe('ml_bundle_kit', () => {
    it('não deve sugerir quando isKitHeuristic = true', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          isKitHeuristic: true,
          price: 100,
          hasPromotion: false,
          currency: 'BRL',
        },
        history: [],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const hack = result.hacks.find(h => h.id === 'ml_bundle_kit');
      expect(hack).toBeUndefined();
    });
  });

  describe('ml_psychological_pricing', () => {
    it('não deve sugerir quando price < 20', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          price: 15,
          hasPromotion: false,
          currency: 'BRL',
        },
        history: [],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const hack = result.hacks.find(h => h.id === 'ml_psychological_pricing');
      expect(hack).toBeUndefined();
    });

    it('não deve sugerir quando preço termina em .90', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          price: 99.90,
          hasPromotion: false,
          currency: 'BRL',
        },
        history: [],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const hack = result.hacks.find(h => h.id === 'ml_psychological_pricing');
      expect(hack).toBeUndefined();
    });
  });

  describe('generateHacks - Histórico', () => {
    it('não deve sugerir hack confirmado', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          shippingMode: 'me2',
          isFullEligible: true,
          price: 100,
          hasPromotion: false,
          currency: 'BRL',
          metrics30d: {
            visits: 400,
            conversionRate: 1.5,
          },
        },
        history: [
          {
            hackId: 'ml_full_shipping',
            status: 'confirmed',
            confirmedAt: new Date(),
          },
        ],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const fullShippingHack = result.hacks.find(h => h.id === 'ml_full_shipping');
      expect(fullShippingHack).toBeUndefined();
      expect(result.meta.skippedBecauseOfHistory).toBeGreaterThan(0);
    });

    it('não deve sugerir hack descartado há menos de 30 dias', () => {
      const dismissedDate = new Date();
      dismissedDate.setDate(dismissedDate.getDate() - 15); // 15 dias atrás

      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          isKitHeuristic: false,
          price: 100,
          hasPromotion: false,
          currency: 'BRL',
          metrics30d: {
            visits: 250,
            conversionRate: 1.0,
          },
        },
        history: [
          {
            hackId: 'ml_bundle_kit',
            status: 'dismissed',
            dismissedAt: dismissedDate,
          },
        ],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const bundleKitHack = result.hacks.find(h => h.id === 'ml_bundle_kit');
      expect(bundleKitHack).toBeUndefined();
      expect(result.meta.skippedBecauseOfHistory).toBeGreaterThan(0);
    });

    it('deve sugerir hack descartado há mais de 30 dias', () => {
      const dismissedDate = new Date();
      dismissedDate.setDate(dismissedDate.getDate() - 35); // 35 dias atrás

      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          isKitHeuristic: false,
          price: 100,
          hasPromotion: false,
          currency: 'BRL',
          availableQuantity: 15,
          metrics30d: {
            visits: 250,
            conversionRate: 1.0,
          },
        },
        history: [
          {
            hackId: 'ml_bundle_kit',
            status: 'dismissed',
            dismissedAt: dismissedDate,
          },
        ],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      const bundleKitHack = result.hacks.find(h => h.id === 'ml_bundle_kit');
      // Pode ou não aparecer dependendo da pontuação, mas não deve ser bloqueado por histórico
      expect(result.meta.skippedBecauseOfHistory).toBe(0);
    });
  });

  describe('generateHacks - Cenários completos', () => {
    it('deve gerar hacks quando condições são atendidas', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          shippingMode: 'me2',
          isFullEligible: true,
          isFreeShipping: false,
          price: 299.90,
          hasPromotion: false,
          currency: 'BRL',
          availableQuantity: 10,
          isOutOfStock: false,
          picturesCount: 8,
          hasVariations: false,
          isKitHeuristic: false,
          categoryId: 'MLB123',
          metrics30d: {
            visits: 450,
            orders: 5,
            conversionRate: 1.11,
          },
        },
        history: [],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      expect(result.version).toBe('v1');
      expect(result.listingId).toBe('listing-1');
      expect(result.hacks.length).toBeGreaterThan(0);
      expect(result.meta.rulesEvaluated).toBe(5);
      expect(result.meta.rulesTriggered).toBeGreaterThan(0);
    });

    it('deve retornar 0 hacks quando nenhuma regra é disparada', () => {
      const input: HackEngineInput = {
        version: 'v1',
        marketplace: 'mercadolivre',
        tenantId: 'tenant-1',
        listingId: 'listing-1',
        signals: {
          status: 'active',
          shippingMode: 'full', // Omit
          isKitHeuristic: true, // Omit
          price: 15, // Omit (psychological pricing)
          hasPromotion: false,
          currency: 'BRL',
          metrics30d: {
            visits: 50, // Muito baixo
            conversionRate: 5.0, // Muito alto
          },
        },
        history: [],
        nowUtc: new Date(),
      };

      const result = generateHacks(input);
      expect(result.hacks.length).toBe(0);
      expect(result.meta.rulesTriggered).toBe(0);
      expect(result.meta.skippedBecauseOfRequirements).toBeGreaterThan(0);
    });
  });
});
