import { describe, it, expect } from 'vitest';
import { generateHacks } from '../HackEngine';
import type { ListingSignals } from '../SignalsBuilder';

describe('HackEngine - ml_category_adjustment acionável (HOTFIX 09.5)', () => {
  it('includes category breadcrumb + benchmark CR evidence and suggestedActionUrl', () => {
    const signals: ListingSignals = {
      status: 'active',
      categoryId: 'MLB1234',
      categoryPath: ['Moda Infantil', 'Meias', '3D'],
      isCatalog: false,
      price: 100,
      hasPromotion: false,
      currency: 'BRL',
      availableQuantity: 10,
      isOutOfStock: false,
      shippingMode: 'me2',
      isFreeShipping: false,
      isFullEligible: false,
      picturesCount: 8,
      hasVideo: false,
      hasClips: true,
      variationsCount: 0,
      hasVariations: false,
      isKitHeuristic: false,
      metrics30d: {
        visits: 500,
        orders: 2,
        conversionRate: 0.5, // 0.5%
      },
      benchmark: {
        medianPrice: 95,
        p25Price: 80,
        p75Price: 120,
        baselineConversionRate: 1.0, // 1.0%
        baselineConversionConfidence: 'medium',
        baselineSampleSize: 500,
      },
    };

    const result = generateHacks({
      version: 'v1',
      marketplace: 'mercadolivre',
      tenantId: 't1',
      listingId: '00000000-0000-0000-0000-000000000001',
      listingIdExt: 'MLB3923303743',
      signals,
      nowUtc: new Date('2026-02-23T00:00:00Z'),
      history: [],
    });

    const hack = result.hacks.find((h) => h.id === 'ml_category_adjustment');
    expect(hack).toBeTruthy();
    expect(hack?.evidence.join(' | ')).toContain('Moda Infantil > Meias > 3D');
    expect(hack?.evidence.join(' | ')).toContain('Conversão atual');
    expect(hack?.evidence.join(' | ')).toContain('Baseline (categoria)');
    expect(hack?.suggestedActionUrl).toMatch(/mercadolivre\.com\.br\/anuncios\/MLB\d+\/modificar/);
  });
});

