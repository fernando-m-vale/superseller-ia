import { describe, expect, it } from 'vitest';
import { enrichAnalyzeResponseWithConsultingIntelligence } from '../services/AnalyzeConsultingEnricher';

describe('AnalyzeConsultingEnricher', () => {
  it('enriquece o payload sem remover campos existentes', () => {
    const payload = {
      listingId: 'listing-1',
      score: 67,
      critique: 'Diagnóstico base',
      cacheHit: true,
      growthHacks: [{ title: 'Trocar imagem principal' }],
      metrics30d: { visits: 55, orders: 0, conversionRate: 0.004 },
      visualAnalysis: { visual_score: 43, main_improvements: ['Melhorar capa'] },
      adsIntelligence: {
        status: 'available' as const,
        metrics: { ctr: 0.0051, spend: 90, roas: 0.8, clicks: 24 },
      },
      pricingNormalized: { finalPriceForDisplay: 129.9, hasPromotion: false },
      promo: { hasPromotion: false, discountPercent: 0 },
      dataQuality: {
        completenessScore: 88,
        warnings: ['brand_missing_or_unstructured'],
        visitsCoverage: { filledDays: 30, totalDays: 30 },
      },
    };

    const result = enrichAnalyzeResponseWithConsultingIntelligence(payload, {
      listing: {
        title: 'Produto teste',
        brand: null,
        model: 'XPTO',
        is_free_shipping: true,
      },
    });

    expect(result.listingId).toBe('listing-1');
    expect(result.cacheHit).toBe(true);
    expect(result.diagnosisRootCause).toBe('visual_low_ctr');
    expect(result.rootCauseSummary).toContain('clique');
    expect(result.signalsUsed.visualScore).toBe(43);
    expect(result.primaryRecommendation).toBeTruthy();
  });

  it('mantém o comportamento em payload de latest com novos campos populados', () => {
    const payload = {
      listingId: 'listing-2',
      score: 74,
      critique: 'Diagnóstico latest',
      growthHacks: [],
      metrics30d: { visits: 190, orders: 2, conversionRate: 0.01 },
      pricingNormalized: { finalPriceForDisplay: 199.9, hasPromotion: false },
      promo: { hasPromotion: false, discountPercent: 0 },
      benchmark: {
        benchmarkSummary: {
          stats: { medianPrice: 165.9 },
          baselineConversion: { conversionRate: 0.019 },
        },
      },
      dataQuality: {
        completenessScore: 84,
        warnings: [],
        visitsCoverage: { filledDays: 30, totalDays: 30 },
      },
    };

    const result = enrichAnalyzeResponseWithConsultingIntelligence(payload, {
      listing: {
        title: 'Produto latest',
        brand: 'Marca',
        model: 'Modelo',
        rating_average: 4.6,
        reviews_count: 32,
        questions_count: 1,
        is_free_shipping: true,
        is_full_eligible: true,
      },
    });

    expect(result.listingId).toBe('listing-2');
    expect(result.score).toBe(74);
    expect(result.diagnosisRootCause).toBe('price_low_conversion');
    expect(result.estimatedImpact).toBe('high');
    expect(result.recommendationPriority).toBe('high');
  });
});
