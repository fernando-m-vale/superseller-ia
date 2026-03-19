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

    expect(verdict).toContain('Problema principal:');
    expect(verdict).toContain('Por que isso está acontecendo:');
    expect(verdict).toContain('O que fazer primeiro:');
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

    expect(verdict).toContain('Problema principal:');
    expect(verdict).toContain('modelo compatível');
    expect(verdict).toContain('buscas');
  });

  it('incorpora causa raiz dominante e ação prioritária ao verdict textual', () => {
    const verdict = buildVerdictText({
      listingTitle: 'Fone Bluetooth X',
      metrics30d: { visits: 52, orders: 0, conversionRate: 0.004 },
      topActions: [{ title: 'Trocar imagem principal' }],
      rootCause: {
        diagnosisRootCause: 'visual_low_ctr',
        rootCauseConfidence: 82,
        rootCauseSummary: 'O principal gargalo parece estar no clique por fragilidade visual e CTR baixo.',
        primaryRecommendation: 'Melhorar a imagem principal antes de aumentar verba.',
      },
    });

    expect(verdict).toContain('Problema principal:');
    expect(verdict).toContain('O que fazer primeiro:');
    expect(verdict).toContain('imagem principal');
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

    expect(verdict).toContain('autonomia, ruído e uso em cantos');
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
    expect([
      'performance_conversion_funnel',
      'compet_promo_validation',
      'performance_offer_trust',
      'seo_description_blocks',
    ]).toContain(conversionActions[0]?.actionKey);
    expect(searchActions[0]?.title).not.toEqual(conversionActions[0]?.title);
    expect(roadmap[0]?.reason).toContain('Ação principal');
    expect(roadmap[1]?.reason).toContain('Ação de suporte');
  });

  it('garante ação correspondente quando o veredito aponta categoria como problema prioritário', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Kit completo premium',
      metrics30d: { visits: 18, orders: 0, conversionRate: 0 },
      dataQualityWarnings: ['Categoria possivelmente desalinhada com a intenção de busca'],
      maxItems: 5,
    });

    expect(actions.some((action) => action.title.includes('categoria'))).toBe(true);
  });

  it('rebaixa hacks para oportunidades extras e mantém ações principais na frente', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Cadeira Office Ergonômica',
      metrics30d: { visits: 280, orders: 1, conversionRate: 0.0035 },
      hasPromotion: true,
      discountPercent: 25,
      picturesCount: 4,
      analysisV21: {
        description_fix: {
          diagnostic: 'A página apresenta a cadeira, mas ainda não sustenta conforto, ajuste e confiança para a decisão.',
          optimized_copy: 'Bloco de prova com ajustes, garantia e peso suportado.',
        },
      },
      hackActions: [
        {
          id: 'ml_psychological_pricing',
          title: 'Aplicar preço psicológico',
          summary: 'Testar fechamento em 9 para aumentar percepção de oportunidade.',
          impact: 'high',
          priority: 'high',
          confidence: 80,
          evidence: ['Preço atual acima de concorrentes em faixa crítica'],
        },
      ],
      benchmark: { confidence: 'good', sampleSize: 18, baselineConversionRate: 0.018 },
      maxItems: 6,
    });

    const hackIndex = actions.findIndex((action) => action.actionKey === 'ml_psychological_pricing');
    expect(hackIndex).toBeGreaterThan(0);
    expect(actions[0]?.actionKey).not.toBe('ml_psychological_pricing');
    expect(actions[hackIndex]?.summary).toContain('Oportunidade extra complementar');
  });

  it('mantém ações principais priorizadas pelo gargalo do funil mesmo com oportunidades extras', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Cabo HDMI 2m 4K',
      metrics30d: { visits: 20, orders: 0, conversionRate: 0 },
      picturesCount: 6,
      analysisV21: {
        title_fix: {
          after: 'Cabo HDMI 2.1 4K 2m Ultra High Speed',
          problem: 'O título atual é genérico e não compete por buscas específicas.',
        },
      },
      hackActions: [
        {
          id: 'ml_smart_variations',
          title: 'Explorar variações inteligentes',
          summary: 'Criar variações para capturar buscas complementares.',
          impact: 'medium',
          priority: 'medium',
          confidence: 75,
          evidence: ['Sem variações ativas'],
        },
      ],
      maxItems: 5,
    });

    expect(actions[0]?.actionKey).toMatch(/seo_title/);
    expect(actions[actions.length - 1]?.actionKey).toBe('ml_smart_variations');
  });

  it('agrupa cards em immediate, support e best_practice sem clip na prioridade principal', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Aspirador Vertical 2 em 1',
      metrics30d: { visits: 210, orders: 2, conversionRate: 0.0095 },
      picturesCount: 5,
      analysisV21: {
        description_fix: {
          diagnostic: 'A descrição não responde autonomia, ruído e uso em cantos.',
          optimized_copy: 'Blocos com autonomia, ruído e uso em canto.',
        },
        image_plan: [{ action: 'Destacar autonomia e bicos na imagem principal' }],
      },
      mediaVerdict: { canSuggestClip: false, hasClipDetected: null },
      hackActions: [
        {
          id: 'support_check',
          title: 'Reforçar FAQ com dúvidas de uso',
          summary: 'Adicionar respostas rápidas para reduzir dúvidas secundárias.',
          impact: 'medium',
          priority: 'medium',
          confidence: 72,
          evidence: ['Dúvidas recorrentes'],
        },
        {
          id: 'best_practice_check',
          title: 'Padronizar checklist de revisão semanal',
          summary: 'Boa prática para acompanhar o anúncio depois dos ajustes principais.',
          impact: 'low',
          priority: 'low',
          confidence: 55,
          evidence: ['Rotina operacional'],
        },
      ],
      rootCause: {
        diagnosisRootCause: 'content_low_conversion',
        primaryRecommendation: 'Reescrever descrição e atributos para responder dúvidas e ajudar o cliente a decidir.',
      },
      maxItems: 6,
    });

    expect(actions.filter((action) => action.actionGroup === 'immediate').length).toBeLessThanOrEqual(3);
    expect(actions[0]?.actionGroup).toBe('immediate');
    expect(actions.some((action) => action.actionGroup === 'support')).toBe(true);
    expect(actions.some((action) => action.actionGroup === 'best_practice' || action.actionGroup === 'support')).toBe(true);
    expect(actions[0]?.title.toLowerCase()).toMatch(/descrição|atribut|dúvida|duvida/);
    expect(actions[0]?.title.toLowerCase()).not.toContain('clip');
  });

  it('gera verdict mais curto e orientado a ação', () => {
    const verdict = buildVerdictText({
      listingTitle: 'Cadeira Office Ergonômica',
      metrics30d: { visits: 280, orders: 1, conversionRate: 0.0035 },
      analysisV21: {
        description_fix: {
          diagnostic: 'A descrição ainda não explica ajuste lombar, peso suportado e garantia.',
        },
      },
      rootCause: {
        diagnosisRootCause: 'content_low_conversion',
        primaryRecommendation: 'Reescrever descrição e atributos para responder dúvidas e ajudar o cliente a decidir.',
      },
      topActions: [{ title: 'Reescrever descrição com benefícios e dúvidas respondidas' }],
    });

    expect(verdict.split('\n')).toHaveLength(3);
    expect(verdict.length).toBeLessThan(420);
    expect(verdict).not.toMatch(/fricção de conversão|oportunidade complementar|estágio do funil/i);
  });

  it('não deixa mídia liderar quando a análise visual já está forte', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Notebook Gamer RTX',
      metrics30d: { visits: 220, orders: 2, conversionRate: 0.0091 },
      picturesCount: 7,
      visualAnalysis: {
        visual_score: 84,
        strengths: ['Imagem principal forte e leitura visual boa no grid.'],
      },
      analysisV21: {
        description_fix: {
          diagnostic: 'A descrição não responde autonomia, upgrade, garantia e cenário de uso.',
          optimized_copy: 'Notebook com RTX para jogos e trabalho, com bloco de garantia, upgrade e FAQ pronto para copiar.',
        },
        image_plan: [{ action: 'Ajustar detalhe lateral como melhoria secundária da galeria' }],
      },
      rootCause: {
        diagnosisRootCause: 'content_low_conversion',
        primaryRecommendation: 'Reescrever descrição e FAQ antes de insistir em mídia.',
      },
      maxItems: 5,
    });

    expect(actions[0]?.pillar).not.toBe('midia');
    expect(['seo_description_blocks', 'performance_conversion_funnel']).toContain(actions[0]?.actionKey);
    expect(actions.some((action) => action.actionKey === 'midia_gallery_upgrade')).toBe(true);
    expect(actions.find((action) => action.actionKey === 'midia_gallery_upgrade')?.actionGroup).not.toBe('immediate');
  });

  it('consolida cards redundantes de imagem em um único card principal', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Panela Antiaderente',
      metrics30d: { visits: 140, orders: 1, conversionRate: 0.0071 },
      picturesCount: 3,
      analysisV21: {
        image_plan: [
          { action: 'Trocar imagem principal por cena de uso com alimento pronto' },
          { action: 'Adicionar close do revestimento e do cabo' },
        ],
      },
      maxItems: 6,
    });

    const mediaCards = actions.filter((action) => action.actionKey === 'midia_gallery_upgrade');
    expect(mediaCards).toHaveLength(1);
    expect(mediaCards[0]?.title).toBe('Atualizar imagem principal e galeria com prova visual');
  });

  it('reduz ruído de benchmark ausente sem vazar mensagem no card principal', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Aspirador Vertical 2 em 1',
      metrics30d: { visits: 145, orders: 1, conversionRate: 0.0069 },
      picturesCount: 5,
      analysisV21: {
        description_fix: {
          diagnostic: 'A página não responde autonomia, ruído e uso em cantos.',
          optimized_copy: 'Bloco pronto com autonomia, ruído, bicos e perguntas frequentes.',
        },
        price_fix: {
          action: 'Comparar preço com benchmark da categoria',
        },
      },
      benchmark: { confidence: 'unavailable', sampleSize: 0, baselineConversionRate: null },
    });

    expect(actions.some((action) => action.actionKey === 'compet_price_positioning')).toBe(false);
    expect(actions.some((action) => /benchmark|indispon/i.test(`${action.title} ${action.summary} ${action.description}`))).toBe(false);
  });

  it('mantém clip rebaixado e não usa ausência de clip como gatilho principal', () => {
    const diagnosis = buildFunnelBottleneckDiagnosis({
      listingTitle: 'Copo Térmico Inox',
      metrics30d: { visits: 118, orders: 3, conversionRate: 0.0254 },
      picturesCount: 7,
      mediaVerdict: { canSuggestClip: false, hasClipDetected: false },
      visualAnalysis: {
        visual_score: 80,
        strengths: ['Imagem principal clara e boa leitura do produto.'],
      },
      analysisV21: {
        title_fix: {
          problem: 'O título ainda pode ficar mais específico para buscas de capacidade e material.',
        },
      },
    });

    expect(diagnosis.primaryBottleneck).toBe('CLICK');
    expect(diagnosis.explanation).not.toContain('imagem principal pouco clara');
  });

  it('expõe payload executável de descrição quando houver material pronto', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Cadeira Office Ergonômica',
      metrics30d: { visits: 280, orders: 1, conversionRate: 0.0035 },
      analysisV21: {
        description_fix: {
          diagnostic: 'A descrição ainda não explica ajuste lombar, peso suportado e garantia.',
          optimized_copy: 'Ajuste lombar, apoio de braços, peso suportado e garantia em copy pronta para copiar.',
        },
      },
      rootCause: {
        diagnosisRootCause: 'content_low_conversion',
      },
    });

    const descriptionAction = actions.find((action) => action.actionKey === 'seo_description_blocks');
    expect(descriptionAction?.title).toBe('Aplicar descrição pronta com benefícios, prova e FAQ');
    expect(descriptionAction?.executionPayload?.diagnostic).toContain('ajuste lombar');
    expect(descriptionAction?.executionPayload?.readyCopy).toContain('copy pronta');
    expect(descriptionAction?.executionPayload?.practicalApplication).toContain('FAQ');
  });

  it('não trunca artificialmente o verdictText montado no backend', () => {
    const longDiagnostic = 'A descrição atual não explica autonomia real, compatibilidade com acessórios, cenário de uso em apartamento, rotina de limpeza rápida e diferença prática entre os modos de potência para quem está comparando opções na categoria.';
    const verdict = buildVerdictText({
      listingTitle: 'Aspirador Vertical Turbo',
      metrics30d: { visits: 210, orders: 1, conversionRate: 0.0047 },
      analysisV21: {
        description_fix: {
          diagnostic: longDiagnostic,
        },
      },
      topActions: [{ title: 'Reescrever descrição com benefícios, FAQ e aplicações reais' }],
    });

    expect(verdict).toContain(longDiagnostic);
    expect(verdict).not.toContain('…');
  });

  it('colapsa ações semanticamente equivalentes de título em uma única ação principal', () => {
    const actions = buildDeterministicMvpActions({
      listingTitle: 'Refil Purificador X200',
      metrics30d: { visits: 28, orders: 0, conversionRate: 0 },
      analysisV21: {
        title_fix: {
          after: 'Refil Purificador X200 Compatível 9 3/4 Pol',
          problem: 'O título não deixa claro modelo compatível, medida e atributo principal de busca.',
        },
      },
      hackActions: [
        {
          id: 'title_a',
          title: 'Reescrever título com busca real e atributos principais',
          summary: 'Deixar o título mais encontrável para buscas de alta intenção.',
          impact: 'high',
          priority: 'high',
          confidence: 88,
          evidence: ['Baixa descoberta'],
        },
        {
          id: 'title_b',
          title: 'Reescrever título com mais clareza de busca',
          summary: 'Tornar o título mais específico para o comprador certo.',
          impact: 'high',
          priority: 'high',
          confidence: 84,
          evidence: ['Termos genéricos'],
        },
      ],
      maxItems: 6,
    });

    const titleActions = actions.filter((action) => action.pillar === 'seo' && /titulo|título/i.test(action.title));
    expect(titleActions).toHaveLength(1);
  });
});
