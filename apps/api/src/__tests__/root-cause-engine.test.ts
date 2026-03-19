import { describe, expect, it } from 'vitest';
import { diagnoseRootCause } from '../services/RootCauseEngine';

describe('RootCauseEngine', () => {
  it('detecta visual_low_ctr quando visual e ctr de ads convergem para baixo clique', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 42, orders: 0, conversionRate: 0.004 },
      visualAnalysis: { visual_score: 41, main_improvements: ['Trocar imagem principal'] },
      adsIntelligence: {
        status: 'available',
        metrics: { ctr: 0.0049, clicks: 33, spend: 120, roas: 0.7 },
      },
      dataQuality: { completenessScore: 84, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });

    expect(result.diagnosisRootCause).toBe('visual_low_ctr');
    expect(result.rootCauseStage).toBe('click');
    expect(result.rootCauseConfidence).toBeGreaterThanOrEqual(50);
    expect(result.primaryRecommendation).toContain('imagem principal');
  });

  it('detecta seo_low_discovery quando o anúncio parece saudável mas com pouca descoberta', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 28, orders: 1, conversionRate: 0.035 },
      visualAnalysis: { visual_score: 82 },
      scoreBreakdown: { seo: 8, midia: 16, competitividade: 8 },
      analysisV21: {
        title_fix: {
          problem: 'O título não explicita modelo compatível e capacidade buscada no marketplace.',
        },
      },
      dataQuality: { completenessScore: 90, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });

    expect(result.diagnosisRootCause).toBe('seo_low_discovery');
    expect(result.rootCauseStage).toBe('discovery');
    expect(result.primaryRecommendation).toContain('título');
  });

  it('detecta price_low_conversion quando há tráfego e preço pouco competitivo', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 260, orders: 2, conversionRate: 0.0076 },
      pricingNormalized: { finalPriceForDisplay: 179.9, hasPromotion: false },
      promo: { hasPromotion: false, discountPercent: 0 },
      benchmark: {
        benchmarkSummary: {
          stats: { medianPrice: 149.9 },
          baselineConversion: { conversionRate: 0.019 },
        },
      },
      scoreBreakdown: { competitividade: 3 },
      dataQuality: { completenessScore: 88, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });

    expect(result.diagnosisRootCause).toBe('price_low_conversion');
    expect(result.signalsUsed.priceCompetitiveSignal).toBe('weak');
    expect(result.estimatedImpact).toBe('high');
  });

  it('detecta trust_low_conversion quando reviews/rating puxam a decisão para baixo', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 210, orders: 2, conversionRate: 0.0095 },
      listing: {
        rating_average: 3.9,
        reviews_count: 6,
        questions_count: 11,
        warranty: null,
      },
      dataQuality: { completenessScore: 82, visitsCoverage: { filledDays: 28, totalDays: 30 } },
    });

    expect(result.diagnosisRootCause).toBe('trust_low_conversion');
    expect(result.signalsUsed.trustSignal).toBe('weak');
    expect(result.primaryRecommendation).toContain('confiança');
  });

  it('detecta ads_traffic_low_return quando há spend alto e roas fraco', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 180, orders: 3, conversionRate: 0.016 },
      adsIntelligence: {
        status: 'available',
        metrics: {
          ctr: 0.011,
          clicks: 48,
          spend: 240,
          roas: 0.92,
          ordersAttributed: 1,
          conversionRateAds: 0.01,
        },
        signals: {
          hasTrafficFromAds: true,
          adsEfficiencyLevel: 'moderate',
          adsProfitabilitySignal: 'negative',
        },
      },
      dataQuality: { completenessScore: 86, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });

    expect(result.diagnosisRootCause).toBe('ads_traffic_low_return');
    expect(result.rootCauseStage).toBe('ads');
    expect(result.primaryRecommendation).toContain('campanha');
  });

  it('retorna mixed_signal quando duas causas ficam muito próximas', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 180, orders: 2, conversionRate: 0.008 },
      pricingNormalized: { finalPriceForDisplay: 159.9, hasPromotion: false },
      benchmark: {
        benchmarkSummary: {
          stats: { medianPrice: 144.9 },
        },
      },
      listing: {
        rating_average: 4.0,
        reviews_count: 4,
        questions_count: 9,
      },
      dataQuality: { completenessScore: 78, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });

    expect(result.diagnosisRootCause).toBe('mixed_signal');
    expect(result.rootCauseConfidence).toBeLessThanOrEqual(58);
  });

  it('retorna insufficient_data quando os sinais disponíveis são insuficientes', () => {
    const result = diagnoseRootCause({
      dataQuality: { completenessScore: 32, visitsCoverage: { filledDays: 2, totalDays: 30 }, performanceAvailable: false },
    });

    expect(result.diagnosisRootCause).toBe('insufficient_data');
    expect(result.rootCauseConfidence).toBeLessThanOrEqual(34);
    expect(result.recommendationPriority).toBe('low');
  });

  it('calcula confiança mais alta para um caso forte do que para um caso ambíguo', () => {
    const strong = diagnoseRootCause({
      metrics30d: { visits: 260, orders: 2, conversionRate: 0.0076 },
      pricingNormalized: { finalPriceForDisplay: 179.9, hasPromotion: false },
      promo: { hasPromotion: false, discountPercent: 0 },
      benchmark: {
        benchmarkSummary: {
          stats: { medianPrice: 149.9 },
          baselineConversion: { conversionRate: 0.019 },
        },
      },
      scoreBreakdown: { competitividade: 3 },
      dataQuality: { completenessScore: 90, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });
    const ambiguous = diagnoseRootCause({
      metrics30d: { visits: 180, orders: 2, conversionRate: 0.009 },
      pricingNormalized: { finalPriceForDisplay: 159.9, hasPromotion: false },
      benchmark: { benchmarkSummary: { stats: { medianPrice: 149.9 } } },
      listing: { rating_average: 4.1, reviews_count: 8, questions_count: 8 },
      dataQuality: { completenessScore: 80, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });

    expect(strong.rootCauseConfidence).toBeGreaterThan(ambiguous.rootCauseConfidence);
  });

  it('reduz confiança quando benchmark está ausente e ads estão parciais', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 180, orders: 2, conversionRate: 0.011 },
      adsIntelligence: {
        status: 'partial',
        metrics: { ctr: 0.014, spend: 240, roas: 0.9, clicks: 52, ordersAttributed: 0 },
        signals: { hasTrafficFromAds: true, adsEfficiencyLevel: 'weak', adsProfitabilitySignal: 'negative' },
      },
      analysisV21: {
        description_fix: {
          diagnostic: 'Descrição suficiente, sem sinais fortes de dúvida de conteúdo.',
        },
      },
      dataQuality: { completenessScore: 78, visitsCoverage: { filledDays: 16, totalDays: 30 } },
    });

    expect(['ads_traffic_low_return', 'mixed_signal', 'content_low_conversion']).toContain(result.diagnosisRootCause);
    expect(result.rootCauseConfidence).toBeLessThan(80);
  });

  it('não força visual_low_ctr quando a análise visual já está forte e a página é o gargalo', () => {
    const result = diagnoseRootCause({
      metrics30d: { visits: 240, orders: 2, conversionRate: 0.0083, ctr: 0.014 },
      visualAnalysis: {
        visual_score: 86,
        main_improvements: ['Ajuste fino de galeria, sem urgência na imagem principal'],
      },
      analysisV21: {
        description_fix: {
          diagnostic: 'Descrição não responde compatibilidade, instalação e garantia, deixando objeções abertas.',
        },
      },
      adsIntelligence: {
        status: 'available',
        metrics: { ctr: 0.013, clicks: 41, spend: 110, roas: 1.8 },
      },
      dataQuality: { completenessScore: 88, visitsCoverage: { filledDays: 30, totalDays: 30 } },
    });

    expect(result.diagnosisRootCause).not.toBe('visual_low_ctr');
    expect(['content_low_conversion', 'mixed_signal']).toContain(result.diagnosisRootCause);
  });
});
