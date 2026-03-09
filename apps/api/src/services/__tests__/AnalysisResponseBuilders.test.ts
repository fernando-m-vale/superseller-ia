import { describe, expect, it } from 'vitest';
import { buildDeterministicMvpActions } from '../AnalysisResponseBuilders';

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
});

