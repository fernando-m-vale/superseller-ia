import { describe, expect, it } from 'vitest';
import {
  buildDeterministicMvpActions,
  buildExecutionRoadmap,
  buildFunnelBottleneckDiagnosis,
  buildVerdictText,
} from '../services/AnalysisResponseBuilders';

describe('AnalysisResponseBuilders', () => {
  it('diferencia dois gargalos SEARCH por motivos distintos', () => {
    const titleDriven = buildFunnelBottleneckDiagnosis({
      metrics30d: { visits: 32, orders: 0, conversionRate: 0 },
      listingTitle: 'Caixa de Som Bluetooth Incrivel',
      analysisV21: {
        title_fix: {
          problem: 'O título prioriza narrativa e não explicita modelo, potência e autonomia.',
        },
      },
    });

    const categoryDriven = buildFunnelBottleneckDiagnosis({
      metrics30d: { visits: 18, orders: 0, conversionRate: 0 },
      listingTitle: 'Kit completo premium',
      dataQualityWarnings: ['Categoria possivelmente desalinhada com a intenção de busca'],
    });

    expect(titleDriven.primaryBottleneck).toBe('SEARCH');
    expect(titleDriven.explanation).toContain('atributos pouco claros');
    expect(categoryDriven.primaryBottleneck).toBe('SEARCH');
    expect(categoryDriven.explanation).toContain('categoria desalinhada');
    expect(titleDriven.recommendedFocus).not.toEqual(categoryDriven.recommendedFocus);
  });

  it('diferencia dois gargalos CONVERSION por causas distintas', () => {
    const trustDriven = buildFunnelBottleneckDiagnosis({
      metrics30d: { visits: 260, orders: 1, conversionRate: 0.0038 },
      hasPromotion: true,
      discountPercent: 35,
      picturesCount: 3,
      analysisV21: {
        image_plan: [{ action: 'Trocar imagem principal por prova de uso e detalhe do material' }],
      },
    });

    const faqDriven = buildFunnelBottleneckDiagnosis({
      metrics30d: { visits: 240, orders: 2, conversionRate: 0.0083 },
      picturesCount: 7,
      analysisV21: {
        description_fix: {
          diagnostic: 'Compatibilidade, instalação e prazo de uso ainda não estão respondidos no anúncio.',
        },
      },
    });

    expect(trustDriven.primaryBottleneck).toBe('CONVERSION');
    expect(trustDriven.explanation).toContain('falta de confiança');
    expect(faqDriven.primaryBottleneck).toBe('CONVERSION');
    expect(faqDriven.explanation).toContain('dúvidas não respondidas');
    expect(trustDriven.explanation).not.toEqual(faqDriven.explanation);
  });

  it('reforça no veredito que promoção ativa com baixa conversão pede clareza antes de preço', () => {
    const verdict = buildVerdictText({
      listingTitle: 'Tênis Corrida Pro',
      metrics30d: { visits: 310, orders: 1, conversionRate: 0.0032 },
      hasPromotion: true,
      discountPercent: 40,
      picturesCount: 3,
      analysisV21: {
        image_plan: [{ action: 'Adicionar imagem principal com tênis no pé e destaque de amortecimento' }],
        description_fix: {
          diagnostic: 'A página cita benefícios, mas ainda não sustenta por que este modelo vale a decisão.',
        },
      },
      topActions: [
        { title: 'Atualizar descrição com blocos prontos' },
        { title: 'Executar plano de imagens do diagnóstico' },
      ],
      benchmark: { confidence: 'good', sampleSize: 22, baselineConversionRate: 0.018 },
    });

    expect(verdict).toContain('Gargalo principal: CONVERSION');
    expect(verdict).toContain('Antes de mexer em preço');
    expect(verdict).toContain('menos de preço e mais de convencimento');
  });

  it('mantém utilidade sem promoção e com baixa descoberta', () => {
    const verdict = buildVerdictText({
      listingTitle: 'Refil Purificador X200',
      metrics30d: { visits: 26, orders: 0, conversionRate: 0 },
      hasPromotion: false,
      analysisV21: {
        title_fix: {
          problem: 'O título não deixa claro modelo compatível e capacidade do refil.',
        },
      },
      topActions: [{ title: 'Reescrever título com busca real' }],
      benchmark: { confidence: 'unavailable', sampleSize: 0, baselineConversionRate: null },
    });

    expect(verdict).toContain('Gargalo principal: SEARCH');
    expect(verdict).toContain('atributos pouco claros');
    expect(verdict).toContain('descoberta');
  });

  it('evita depender de benchmark unavailable e prioriza sinais internos', () => {
    const verdict = buildVerdictText({
      listingTitle: 'Aspirador Vertical 2 em 1',
      metrics30d: { visits: 145, orders: 1, conversionRate: 0.0069 },
      hasPromotion: false,
      picturesCount: 5,
      analysisV21: {
        description_fix: {
          diagnostic: 'A página não responde autonomia, ruído e uso em cantos.',
        },
      },
      topActions: [{ title: 'Transformar dúvidas comuns em FAQ visível' }],
      benchmark: { confidence: 'unavailable', sampleSize: 0, baselineConversionRate: null },
    });

    const actions = buildDeterministicMvpActions({
      listingTitle: 'Aspirador Vertical 2 em 1',
      metrics30d: { visits: 145, orders: 1, conversionRate: 0.0069 },
      hasPromotion: false,
      picturesCount: 5,
      analysisV21: {
        description_fix: {
          diagnostic: 'A página não responde autonomia, ruído e uso em cantos.',
          optimized_copy: 'FAQ pronta com autonomia, ruído e uso em tapete.',
        },
        price_fix: {
          action: 'Comparar preço com concorrentes diretos',
        },
      },
      benchmark: { confidence: 'unavailable', sampleSize: 0, baselineConversionRate: null },
    });

    expect(verdict).toContain('sinais internos de oferta, clareza e estrutura');
    expect(actions.some((action) => action.actionKey === 'compet_price_positioning')).toBe(false);
  });

  it('aumenta contraste entre anúncios e marca ação principal + suporte no roadmap', () => {
    const searchActions = buildDeterministicMvpActions({
      listingTitle: 'Cabo HDMI 2m 4K',
      metrics30d: { visits: 20, orders: 0, conversionRate: 0 },
      picturesCount: 6,
      analysisV21: {
        title_fix: {
          after: 'Cabo HDMI 2.1 4K 2m Ultra High Speed',
          problem: 'O título atual é genérico e não compete por buscas específicas.',
        },
      },
      maxItems: 3,
    });

    const conversionActions = buildDeterministicMvpActions({
      listingTitle: 'Cadeira Office Ergonômica',
      metrics30d: { visits: 280, orders: 1, conversionRate: 0.0035 },
      hasPromotion: true,
      discountPercent: 25,
      picturesCount: 4,
      analysisV21: {
        title_fix: {
          after: 'Cadeira Office Ergonômica Mesh Ajuste Lombar',
          problem: 'O título pode ganhar precisão comercial.',
        },
        description_fix: {
          diagnostic: 'A página apresenta a cadeira, mas ainda não sustenta conforto, ajuste e confiança para a decisão.',
          optimized_copy: 'Bloco de prova com ajustes, garantia e peso suportado.',
        },
        image_plan: [{ action: 'Trocar imagem principal por cena de uso com apoio lombar visível' }],
      },
      maxItems: 3,
    });

    const roadmap = buildExecutionRoadmap({
      bottleneckDiagnosis: buildFunnelBottleneckDiagnosis({
        listingTitle: 'Cadeira Office Ergonômica',
        metrics30d: { visits: 280, orders: 1, conversionRate: 0.0035 },
        hasPromotion: true,
        discountPercent: 25,
        picturesCount: 4,
        analysisV21: {
          description_fix: {
            diagnostic: 'A página apresenta a cadeira, mas ainda não sustenta conforto, ajuste e confiança para a decisão.',
          },
          image_plan: [{ action: 'Trocar imagem principal por cena de uso com apoio lombar visível' }],
        },
      }),
      growthHacks: conversionActions,
    });

    expect(searchActions[0]?.actionKey).toBe('seo_title_refresh');
    expect(conversionActions[0]?.actionKey).toBe('performance_conversion_funnel');
    expect(searchActions[0]?.title).not.toEqual(conversionActions[0]?.title);
    expect(roadmap[0]?.reason).toContain('Ação principal');
    expect(roadmap[1]?.reason).toContain('Ação de suporte');
  });
});
