import { describe, expect, it } from 'vitest';
import type { AIAnalyzeInputV21 } from '../../types/ai-analyze-input';
import type { AIAnalysisResultExpert } from '../../types/ai-analysis-expert';
import {
  applyPersonalizationToExpertAnalysis,
  buildListingPersonalizationContext,
} from '../ListingPersonalizationEngine';

function makeInput(overrides?: Partial<AIAnalyzeInputV21>): AIAnalyzeInputV21 {
  const base: AIAnalyzeInputV21 = {
    meta: {
      tenantId: 'tenant-1',
      marketplace: 'mercadolivre',
      listingId: 'listing-1',
      analyzedAt: new Date('2026-03-10T12:00:00.000Z').toISOString(),
      periodDays: 30,
    },
    listing: {
      title: 'Meias 3D Crazy Socks Diversao E Conforto Em Cada Passo',
      description: 'Kit de meias com visual 3D, toque macio e uso no dia a dia.',
      category: 'Moda infantil',
      price: 60,
      currency: 'BRL',
      stock: 121,
      status: 'active',
      createdAt: new Date('2026-03-01T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-03-10T12:00:00.000Z').toISOString(),
      price_base: 60,
      price_final: 32,
      has_promotion: true,
      discount_percent: 47,
      description_length: 64,
    },
    media: {
      imageCount: 6,
      hasImages: true,
      hasVideo: false,
      hasClips: false,
      videoCount: 0,
    },
    performance: {
      periodDays: 30,
      visits: 180,
      orders: 2,
      revenue: 64,
      conversionRate: 0.011,
    },
    dataQuality: {
      missing: [],
      warnings: [],
      completenessScore: 100,
      visitsCoverage: {
        filledDays: 30,
        totalDays: 30,
      },
      performanceAvailable: true,
      sources: {
        performance: 'listing_metrics_daily',
      },
      visits_status: 'ok',
    },
  };

  return { ...base, ...overrides };
}

function makeAnalysis(): AIAnalysisResultExpert {
  return {
    verdict: 'Anuncio generico e pouco especifico para converter mais.',
    title_fix: {
      problem: 'Titulo atual pouco trabalhado.',
      impact: 'Perde busca qualificada.',
      before: 'Meias 3D Crazy Socks Diversao E Conforto Em Cada Passo',
      after: 'Produto incrivel premium promocao',
    },
    image_plan: [
      { image: 1, action: 'Mostrar a capa' },
      { image: 2, action: 'Mostrar detalhe' },
      { image: 3, action: 'Mostrar uso' },
    ],
    description_fix: {
      diagnostic: 'Descricao muito generica.',
      optimized_copy: 'Este produto e ideal para quem quer qualidade e praticidade.',
    },
    price_fix: {
      diagnostic: 'Preco competitivo.',
      action: 'Destacar promocao ativa.',
    },
    algorithm_hacks: [],
    final_action_plan: ['D0: Ajustar titulo', 'D1: Ajustar descricao', 'D2: Ajustar imagens', 'D3: Revisar preco', 'D4: Monitorar CTR', 'D5: Monitorar conversao', 'D6: Revisar anuncio'],
    meta: {
      version: 'ml-sales-v22',
      model: 'gpt-4o',
      analyzed_at: new Date('2026-03-10T12:00:00.000Z').toISOString(),
      prompt_version: 'ml-sales-v22',
    },
  };
}

describe('ListingPersonalizationEngine', () => {
  it('gera 3 estrategias de titulo realmente distintas com analise do titulo atual', () => {
    const context = buildListingPersonalizationContext({
      title: 'Fone Bluetooth Bluetooth Sem Fio Produto Premium',
      description: 'Fone sem fio com uso no dia a dia, estojo e recarga rapida.',
      categoryLabel: 'Eletronicos',
      categoryPath: ['Audio', 'Fones Bluetooth'],
      price: 199,
      priceFinal: 159,
      hasPromotion: true,
      discountPercent: 20,
      visits: 90,
      conversionRate: 0.01,
      stock: 15,
    });

    expect(context.currentTitleAnalysis.repeatedTerms).toContain('Bluetooth');
    expect(context.currentTitleAnalysis.genericTerms).toContain('Premium');
    expect(context.titleStrategies).toHaveLength(3);
    expect(new Set(context.titleStrategies.map((item) => item.title)).size).toBe(3);
  });

  it('pos-processa titulo e descricao para ficarem mais especificos sem quebrar contrato', () => {
    const input = makeInput();
    input.personalization = buildListingPersonalizationContext({
      title: input.listing.title,
      description: input.listing.description,
      categoryLabel: 'Moda infantil',
      categoryPath: ['Moda', 'Moda infantil', 'Meias infantis'],
      price: input.listing.price_base,
      priceFinal: input.listing.price_final,
      hasPromotion: input.listing.has_promotion,
      discountPercent: input.listing.discount_percent,
      visits: input.performance.visits,
      conversionRate: input.performance.conversionRate,
      stock: input.listing.stock,
    });

    const result = applyPersonalizationToExpertAnalysis(input, makeAnalysis());

    expect(result.title_fix.after).not.toBe('Produto incrivel premium promocao');
    expect(result.title_fix.problem).toContain('SEO:');
    expect(result.title_fix.problem).toContain('Conversao:');
    expect(result.title_fix.problem).toContain('Oferta:');
    expect(result.description_fix.optimized_copy).not.toContain('Este produto e ideal para');
    expect(result.description_fix.optimized_copy).toContain('Destaques');
    expect(result.description_fix.optimized_copy).toContain('Informacoes praticas');
  });
});
