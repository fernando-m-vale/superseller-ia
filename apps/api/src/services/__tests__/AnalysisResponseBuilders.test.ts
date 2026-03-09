import { describe, expect, it } from 'vitest';
import { buildDeterministicMvpActions, buildVerdictText } from '../AnalysisResponseBuilders';

describe('AnalysisResponseBuilders', () => {
  it('respeita teto maximo sem obrigatoriedade de preencher 15', () => {
    const actions = buildDeterministicMvpActions({
      listingIdExt: 'MLB123456789',
      listingTitle: 'Produto X',
      picturesCount: 9,
      metrics30d: {
        visits: 40,
        orders: 1,
        conversionRate: 0.025,
      },
      hasPromotion: false,
      maxItems: 15,
      mediaVerdict: { canSuggestClip: false },
      benchmark: {
        confidence: 'unavailable',
        sampleSize: 0,
      },
    });

    expect(actions.length).toBeLessThan(15);
  });

  it('nao gera clip quando canSuggestClip=false', () => {
    const actions = buildDeterministicMvpActions({
      listingIdExt: 'MLB123456789',
      picturesCount: 3,
      hackActions: [
        {
          id: 'midia_video_clip',
          title: 'Publicar clip curto de demonstracao',
          summary: 'Clip com prova de uso',
          impact: 'high',
          priority: 'high',
          confidence: 90,
          evidence: ['Visitas 300'],
        },
      ],
      metrics30d: {
        visits: 300,
        orders: 2,
        conversionRate: 0.01,
      },
      hasPromotion: false,
      mediaVerdict: { canSuggestClip: false },
      benchmark: {
        confidence: 'high',
        sampleSize: 120,
      },
    });

    expect(actions.some((a) => a.actionKey === 'midia_video_clip')).toBe(false);
  });

  it('nao gera clip automatico quando deteccao e inconclusiva via warning da API', () => {
    const actions = buildDeterministicMvpActions({
      listingIdExt: 'MLB123456789',
      picturesCount: 4,
      metrics30d: {
        visits: 380,
        orders: 2,
        conversionRate: 0.009,
      },
      mediaVerdict: { canSuggestClip: true, hasClipDetected: null },
      dataQualityWarnings: ['clips_not_detectable_via_items_api'],
      hackActions: [
        {
          id: 'midia_video_clip',
          title: 'Publicar clip curto de demonstracao',
          summary: 'Adicionar clip para aumentar conversao',
          impact: 'high',
          priority: 'high',
          confidence: 95,
          evidence: ['visitas 380'],
        },
      ],
      benchmark: {
        confidence: 'high',
        sampleSize: 120,
      },
    });

    expect(actions.some((a) => a.actionKey === 'midia_video_clip')).toBe(false);
    const manual = actions.find((a) => a.actionKey === 'midia_clip_manual_validation');
    expect(manual).toBeDefined();
    expect(manual?.priority).toBe('low');
    expect(manual?.impact).toBe('low');
  });

  it('nao gera acao forte de benchmark quando benchmark unavailable', () => {
    const actions = buildDeterministicMvpActions({
      listingIdExt: 'MLB123456789',
      hackActions: [
        {
          id: 'compet_price_positioning',
          title: 'Recalibrar preco versus concorrencia direta',
          summary: 'Ajustar preco final frente ao benchmark da categoria',
          impact: 'high',
          priority: 'high',
          confidence: 88,
          evidence: ['Benchmark categoria'],
        },
        {
          id: 'compet_manual_check',
          title: 'Verificar categoria especifica',
          summary: 'Validar manualmente se categoria esta adequada',
          impact: 'medium',
          priority: 'medium',
          confidence: 55,
          evidence: ['Categoria atual'],
        },
      ],
      metrics30d: {
        visits: 260,
        orders: 3,
        conversionRate: 0.012,
      },
      mediaVerdict: { canSuggestClip: true },
      benchmark: {
        confidence: 'unavailable',
        sampleSize: 0,
      },
    });

    const strongBenchmark = actions.find((a) => a.actionKey === 'compet_price_positioning');
    const manual = actions.find((a) => a.actionKey === 'compet_manual_check');

    expect(strongBenchmark).toBeUndefined();
    expect(manual).toBeDefined();
    expect(manual?.impact).toBe('low');
  });

  it('ordena a primeira acao recomendada pela melhor prioridade real', () => {
    const actions = buildDeterministicMvpActions({
      listingIdExt: 'MLB123456789',
      picturesCount: 4,
      hackActions: [
        {
          id: 'generic_high',
          title: 'Melhorar proposta percebida',
          summary: 'Refinar oferta para ganho incremental',
          impact: 'high',
          priority: 'high',
          confidence: 45,
          evidence: [],
        },
        {
          id: 'specific_cr_fix',
          title: 'Corrigir conversao com prova visual e FAQ',
          summary: 'Com 420 visitas e 3 pedidos (CR 0.71%), atuar em imagens e duvidas recorrentes.',
          impact: 'high',
          priority: 'high',
          confidence: 90,
          evidence: ['420 visitas', '3 pedidos', 'CR 0.71%'],
        },
      ],
      metrics30d: {
        visits: 420,
        orders: 3,
        conversionRate: 0.0071,
      },
      hasPromotion: true,
      discountPercent: 35,
      mediaVerdict: { canSuggestClip: true },
      benchmark: {
        confidence: 'high',
        sampleSize: 300,
      },
    });

    expect(actions[0]?.actionKey).toBe('specific_cr_fix');
  });

  it('permite varias acoes quando ha evidencias internas concretas', () => {
    const actions = buildDeterministicMvpActions({
      listingIdExt: 'MLB123456789',
      picturesCount: 8,
      metrics30d: {
        visits: 60,
        orders: 1,
        conversionRate: 0.016,
      },
      benchmark: {
        confidence: 'unavailable',
        sampleSize: 0,
      },
      analysisV21: {
        title_fix: {
          after: 'Mouse Gamer RGB 7200 DPI com 7 Botoes',
          before: 'Mouse',
          problem: 'Titulo atual nao captura intencao de compra',
        },
        description_fix: {
          optimized_copy: 'Descricao pronta para colar.\n\nBloco 2 com beneficios.',
          diagnostic: 'Descricao curta e generica',
        },
        image_plan: [
          { image: 1, action: 'Capa em fundo branco com produto completo' },
          { image: 2, action: 'Close do sensor e botoes laterais' },
          { image: 3, action: 'Produto em uso no setup gamer' },
        ],
      },
      generatedContent: {
        bullets: ['RGB personalizavel', 'Sensor 7200 DPI', 'Cabo reforcado'],
        seoDescription: { long: 'Descricao longa alternativa pronta.' },
      },
      mediaVerdict: { canSuggestClip: false },
    });

    expect(actions.length).toBeGreaterThan(1);
    expect(actions.some((a) => a.actionKey === 'seo_title_refresh')).toBe(true);
    expect(actions.some((a) => a.actionKey === 'seo_description_blocks')).toBe(true);
    expect(actions.some((a) => a.actionKey === 'midia_gallery_upgrade')).toBe(true);
  });

  it('benchmark ausente nao bloqueia acao suportada por evidencia interna', () => {
    const actions = buildDeterministicMvpActions({
      listingIdExt: 'MLB123456789',
      metrics30d: {
        visits: 40,
        orders: 1,
        conversionRate: 0.02,
      },
      benchmark: {
        confidence: 'unavailable',
        sampleSize: 0,
      },
      analysisV21: {
        description_fix: {
          optimized_copy: 'Descricao otimizada pronta para uso',
          diagnostic: 'Texto atual nao responde objecoes',
        },
      },
      mediaVerdict: { canSuggestClip: false },
    });

    expect(actions.some((a) => a.actionKey === 'seo_description_blocks')).toBe(true);
  });
});

describe('buildVerdictText', () => {
  it('cobre promocao ativa com conversao fraca', () => {
    const text = buildVerdictText({
      listingTitle: 'Mouse Gamer RGB 7200 DPI',
      metrics30d: { visits: 420, orders: 2, conversionRate: 0.0048 },
      hasPromotion: true,
      discountPercent: 35,
      topActions: [{ title: 'Reforcar prova visual e FAQ de objecoes' }],
    });

    expect(text).toContain('Promoção ativa');
    expect(text).toContain('Reforcar prova visual e FAQ de objecoes');
  });

  it('cobre sem promocao com zero pedidos', () => {
    const text = buildVerdictText({
      listingTitle: 'Fone Bluetooth TWS',
      metrics30d: { visits: 140, orders: 0, conversionRate: 0 },
      hasPromotion: false,
      topActions: [{ title: 'Reescrever oferta com beneficios e garantia' }],
    });

    expect(text).toContain('Sem promoção ativa');
    expect(text).toContain('0 pedidos');
  });

  it('cobre visitas altas com conversao fraca', () => {
    const text = buildVerdictText({
      listingTitle: 'Kit Ferramentas 129 pecas',
      metrics30d: { visits: 820, orders: 3, conversionRate: 0.0037 },
      hasPromotion: false,
      topActions: [{ title: 'Reorganizar bloco de decisao da descricao' }],
    });

    expect(text).toContain('820 visitas');
    expect(text).toMatch(/atencao|descoberta|decisao/i);
  });

  it('sinaliza benchmark unavailable sem afirmar comparacao objetiva', () => {
    const text = buildVerdictText({
      listingTitle: 'Smartwatch Sport',
      metrics30d: { visits: 310, orders: 2, conversionRate: 0.0064 },
      hasPromotion: false,
      topActions: [{ title: 'Ajustar posicionamento comercial' }],
      scoreBreakdown: { competitividade: 42, performance: 65, seo: 70, midia: 68, cadastro: 74 },
      benchmark: { confidence: 'unavailable', sampleSize: 0, baselineConversionRate: null },
    });

    expect(text).toContain('Benchmark externo está indisponível');
    expect(text.toLowerCase()).not.toContain('abaixo do baseline');
  });

  it('prioriza narrativa de SEO quando seo e dominante', () => {
    const text = buildVerdictText({
      listingTitle: 'Cadeira de Escritorio',
      metrics30d: { visits: 190, orders: 1, conversionRate: 0.0052 },
      hasPromotion: false,
      topActions: [{ title: 'Reescrever titulo com intencao de busca' }],
      scoreBreakdown: { seo: 28, midia: 66, cadastro: 63, competitividade: 59, performance: 62 },
      analysisV21: {
        title_fix: { problem: 'Titulo sem termos de busca relevantes', after: 'Cadeira Ergonomica Escritorio Ajustavel' },
        description_fix: { diagnostic: 'Descricao sem blocos de decisao' },
      },
    });

    expect(text).toMatch(/SEO|título|descrição|busca/i);
  });

  it('prioriza narrativa de midia quando midia e dominante', () => {
    const text = buildVerdictText({
      listingTitle: 'Aspirador Portatil',
      metrics30d: { visits: 260, orders: 2, conversionRate: 0.0077 },
      hasPromotion: false,
      picturesCount: 3,
      mediaVerdict: { canSuggestClip: true, hasClipDetected: false },
      topActions: [{ title: 'Atualizar galeria com provas de uso real' }],
      scoreBreakdown: { seo: 67, midia: 22, cadastro: 64, competitividade: 60, performance: 58 },
    });

    expect(text).toMatch(/mídia|media|galeria|visual|clip/i);
  });

  it('gera textos diferentes para cenarios diferentes', () => {
    const promoLowCr = buildVerdictText({
      listingTitle: 'Mouse Gamer RGB 7200 DPI',
      metrics30d: { visits: 420, orders: 2, conversionRate: 0.0048 },
      hasPromotion: true,
      discountPercent: 35,
      topActions: [{ title: 'Reforcar prova visual e FAQ de objecoes' }],
    });

    const noPromoZeroOrders = buildVerdictText({
      listingTitle: 'Fone Bluetooth TWS',
      metrics30d: { visits: 140, orders: 0, conversionRate: 0 },
      hasPromotion: false,
      topActions: [{ title: 'Reescrever oferta com beneficios e garantia' }],
    });

    const highVisitsLowCr = buildVerdictText({
      listingTitle: 'Kit Ferramentas 129 pecas',
      metrics30d: { visits: 820, orders: 3, conversionRate: 0.0037 },
      hasPromotion: false,
      topActions: [{ title: 'Reorganizar bloco de decisao da descricao' }],
    });

    expect(promoLowCr).not.toBe(noPromoZeroOrders);
    expect(promoLowCr).not.toBe(highVisitsLowCr);
    expect(noPromoZeroOrders).not.toBe(highVisitsLowCr);
  });
});

