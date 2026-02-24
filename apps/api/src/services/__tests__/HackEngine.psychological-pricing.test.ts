/**
 * Testes unitários para HackEngine - ml_psychological_pricing
 * HOTFIX 09.9: Validar regra de não sugerir quando já termina em .90 ou .99
 */

import { describe, it, expect } from 'vitest';
import { generateHacks } from '../HackEngine';
import type { HackEngineInput } from '../HackEngine';

describe('HackEngine - ml_psychological_pricing (HOTFIX 09.9)', () => {
  const baseInput: Omit<HackEngineInput, 'signals'> = {
    version: 'v1',
    marketplace: 'mercadolivre',
    tenantId: 'tenant-1',
    listingId: 'listing-1',
    history: [],
    nowUtc: new Date(),
  };

  it('não deve sugerir quando preço termina em .90', () => {
    const input: HackEngineInput = {
      ...baseInput,
      signals: {
        status: 'active',
        price: 66.90,
        hasPromotion: false,
        currency: 'BRL',
        metrics30d: {
          visits: 300,
          orders: 10,
          conversionRate: 0.02,
        },
      },
    };

    const result = generateHacks(input);
    const hack = result.hacks.find(h => h.id === 'ml_psychological_pricing');
    expect(hack).toBeUndefined();
  });

  it('não deve sugerir quando preço termina em .99', () => {
    const input: HackEngineInput = {
      ...baseInput,
      signals: {
        status: 'active',
        price: 66.99,
        hasPromotion: false,
        currency: 'BRL',
        metrics30d: {
          visits: 300,
          orders: 10,
          conversionRate: 0.02,
        },
      },
    };

    const result = generateHacks(input);
    const hack = result.hacks.find(h => h.id === 'ml_psychological_pricing');
    expect(hack).toBeUndefined();
  });

  it('deve sugerir quando preço termina em .93 (não é .90 ou .99)', () => {
    const input: HackEngineInput = {
      ...baseInput,
      signals: {
        status: 'active',
        price: 66.93,
        hasPromotion: false,
        currency: 'BRL',
        metrics30d: {
          visits: 300,
          orders: 10,
          conversionRate: 0.02,
        },
      },
    };

    const result = generateHacks(input);
    const hack = result.hacks.find(h => h.id === 'ml_psychological_pricing');
    expect(hack).toBeDefined();
    expect(hack?.title).toBe('Ajustar Preço Psicológico');
  });

  it('deve sugerir quando preço termina em .00 (redondo)', () => {
    const input: HackEngineInput = {
      ...baseInput,
      signals: {
        status: 'active',
        price: 100.00,
        hasPromotion: false,
        currency: 'BRL',
        metrics30d: {
          visits: 300,
          orders: 10,
          conversionRate: 0.02,
        },
      },
    };

    const result = generateHacks(input);
    const hack = result.hacks.find(h => h.id === 'ml_psychological_pricing');
    // .00 não é .90 ou .99, então pode sugerir (mas com score diferente)
    expect(hack).toBeDefined();
  });

  it('não deve sugerir quando preço < 20', () => {
    const input: HackEngineInput = {
      ...baseInput,
      signals: {
        status: 'active',
        price: 15.50,
        hasPromotion: false,
        currency: 'BRL',
        metrics30d: {
          visits: 300,
          orders: 10,
          conversionRate: 0.02,
        },
      },
    };

    const result = generateHacks(input);
    const hack = result.hacks.find(h => h.id === 'ml_psychological_pricing');
    expect(hack).toBeUndefined();
  });
});
