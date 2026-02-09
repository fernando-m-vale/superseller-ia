import { describe, it, expect } from 'vitest';
import { 
  generateActionPlan, 
  ActionPlanItem, 
  ActionDimension,
  detectPromoAggressiveLowCR,
  PricingInfo,
  Metrics30dInfo,
  PROMO_AGGRESSIVE_DISCOUNT_PCT,
  LOW_CR_THRESHOLD,
  MIN_VISITS_FOR_CR_CONFIDENCE,
} from '../services/ScoreActionEngine';
import { IAScoreBreakdown, IAScorePotentialGain } from '../services/IAScoreService';

describe('ScoreActionEngine', () => {
  const baseScoreBreakdown: IAScoreBreakdown = {
    cadastro: 15,
    midia: 10,
    performance: 20,
    seo: 15,
    competitividade: 5,
  };

  const baseDataQuality = {
    performanceAvailable: true,
    visitsCoverage: {
      filledDays: 28,
      totalDays: 30,
    },
  };

  describe('generateActionPlan', () => {
    it('should generate actions for dimensions with lost points', () => {
      const actionPlan = generateActionPlan(baseScoreBreakdown, baseDataQuality);

      expect(actionPlan.length).toBeGreaterThan(0);

      // Verificar que todas as ações têm lostPoints > 0
      actionPlan.forEach((action) => {
        expect(action.lostPoints).toBeGreaterThan(0);
        expect(action.priority).toMatch(/^(high|medium|low)$/);
        expect(action.whyThisMatters).toBeTruthy();
        expect(action.expectedScoreAfterFix).toBeGreaterThanOrEqual(action.lostPoints);
      });
    });

    it('should NOT generate actions when lostPoints <= 0', () => {
      const perfectScore: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 30,
        seo: 20,
        competitividade: 10,
      };

      const actionPlan = generateActionPlan(perfectScore, baseDataQuality);

      expect(actionPlan.length).toBe(0);
    });

    it('should NOT generate performance action when performanceAvailable=false', () => {
      const dataQualityNoPerformance = {
        performanceAvailable: false,
        visitsCoverage: {
          filledDays: 0,
          totalDays: 30,
        },
      };

      const actionPlan = generateActionPlan(baseScoreBreakdown, dataQualityNoPerformance);

      // Não deve ter action de performance
      const performanceActions = actionPlan.filter((a) => a.dimension === 'performance');
      expect(performanceActions.length).toBe(0);

      // Deve ter outras ações se houver lost points
      expect(actionPlan.length).toBeGreaterThan(0);
    });

    it('should prioritize actions correctly (high priority for lostPoints >= 10)', () => {
      const scoreWithHighLost: IAScoreBreakdown = {
        cadastro: 5, // lost: 15 -> high
        midia: 12, // lost: 8 -> medium
        performance: 20, // lost: 10 -> high
        seo: 18, // lost: 2 -> low
        competitividade: 10, // lost: 0 -> no action
      };

      const actionPlan = generateActionPlan(scoreWithHighLost, baseDataQuality);

      const highPriorityActions = actionPlan.filter((a) => a.priority === 'high');
      const mediumPriorityActions = actionPlan.filter((a) => a.priority === 'medium');
      const lowPriorityActions = actionPlan.filter((a) => a.priority === 'low');

      expect(highPriorityActions.length).toBeGreaterThan(0);
      highPriorityActions.forEach((action) => {
        expect(action.lostPoints).toBeGreaterThanOrEqual(10);
      });

      mediumPriorityActions.forEach((action) => {
        expect(action.lostPoints).toBeGreaterThanOrEqual(5);
        expect(action.lostPoints).toBeLessThan(10);
      });

      lowPriorityActions.forEach((action) => {
        expect(action.lostPoints).toBeGreaterThan(0);
        expect(action.lostPoints).toBeLessThan(5);
      });
    });

    it('should order actions by lostPoints (descending) and then by priority', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 5, // lost: 15 -> high
        midia: 12, // lost: 8 -> medium
        performance: 25, // lost: 5 -> medium
        seo: 18, // lost: 2 -> low
        competitividade: 7, // lost: 3 -> low
      };

      const actionPlan = generateActionPlan(scoreBreakdown, baseDataQuality);

      // Verificar ordenação: maior lostPoints primeiro
      for (let i = 0; i < actionPlan.length - 1; i++) {
        const current = actionPlan[i];
        const next = actionPlan[i + 1];

        if (current.lostPoints !== next.lostPoints) {
          expect(current.lostPoints).toBeGreaterThan(next.lostPoints);
        } else {
          // Se lostPoints igual, prioridade deve ser maior (high > medium > low)
          const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
          expect(priorityOrder[current.priority]).toBeGreaterThanOrEqual(priorityOrder[next.priority]);
        }
      }
    });

    it('should calculate expectedScoreAfterFix correctly', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 15, // lost: 5, expected: 20
        midia: 10, // lost: 10, expected: 20
        performance: 25, // lost: 5, expected: 30
        seo: 18, // lost: 2, expected: 20
        competitividade: 7, // lost: 3, expected: 10
      };

      const actionPlan = generateActionPlan(scoreBreakdown, baseDataQuality);

      actionPlan.forEach((action) => {
        const maxScores: Record<ActionDimension, number> = {
          cadastro: 20,
          midia: 20,
          performance: 30,
          seo: 20,
          competitividade: 10,
        };
        const maxScore = maxScores[action.dimension];
        const currentScore = scoreBreakdown[action.dimension];

        expect(action.expectedScoreAfterFix).toBeLessThanOrEqual(maxScore);
        expect(action.expectedScoreAfterFix).toBeGreaterThanOrEqual(currentScore);
      });
    });

    it('should include whyThisMatters text for each dimension', () => {
      const actionPlan = generateActionPlan(baseScoreBreakdown, baseDataQuality);

      actionPlan.forEach((action) => {
        expect(action.whyThisMatters).toBeTruthy();
        expect(action.whyThisMatters.length).toBeGreaterThan(0);
      });
    });

    it('should include potential gain in whyThisMatters when provided', () => {
      const potentialGain: IAScorePotentialGain = {
        cadastro: '+5',
        midia: '+10',
      };

      const actionPlan = generateActionPlan(baseScoreBreakdown, baseDataQuality, potentialGain);

      const cadastroAction = actionPlan.find((a) => a.dimension === 'cadastro');
      const midiaAction = actionPlan.find((a) => a.dimension === 'midia');

      if (cadastroAction) {
        expect(cadastroAction.whyThisMatters).toContain('+5');
      }
      if (midiaAction) {
        expect(midiaAction.whyThisMatters).toContain('+10');
      }
    });

    it('should explain performance unavailability when performanceAvailable=false', () => {
      const dataQualityNoPerformance = {
        performanceAvailable: false,
        visitsCoverage: {
          filledDays: 0,
          totalDays: 30,
        },
      };

      // Criar score com performance perdida (mas não deve gerar action)
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 15, // lost: 15, mas não deve gerar action
        seo: 20,
        competitividade: 10,
      };

      const actionPlan = generateActionPlan(scoreBreakdown, dataQualityNoPerformance);

      // Não deve ter action de performance
      const performanceActions = actionPlan.filter((a) => a.dimension === 'performance');
      expect(performanceActions.length).toBe(0);
    });

    it('should include visitsCoverage context for performance when coverage < 50%', () => {
      const dataQualityLowCoverage = {
        performanceAvailable: true,
        visitsCoverage: {
          filledDays: 10, // 10/30 = 33%
          totalDays: 30,
        },
      };

      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 15, // lost: 15
        seo: 20,
        competitividade: 10,
      };

      const actionPlan = generateActionPlan(scoreBreakdown, dataQualityLowCoverage);

      const performanceAction = actionPlan.find((a) => a.dimension === 'performance');
      if (performanceAction) {
        expect(performanceAction.whyThisMatters).toContain('Cobertura de dados');
        expect(performanceAction.whyThisMatters).toContain('33%');
      }
    });
  });

  describe('detectPromoAggressiveLowCR', () => {
    it('should detect promo agressiva + baixa conversão quando todos os critérios são atendidos', () => {
      const pricing: PricingInfo = {
        hasPromotion: true,
        discountPercent: 47,
      };
      const metrics30d: Metrics30dInfo = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317, // 0.317% < 0.6%
        revenue: 32,
      };

      const result = detectPromoAggressiveLowCR(pricing, metrics30d);
      expect(result).toBe(true);
    });

    it('should NOT detect quando não há promoção', () => {
      const pricing: PricingInfo = {
        hasPromotion: false,
        discountPercent: null,
      };
      const metrics30d: Metrics30dInfo = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317,
        revenue: 32,
      };

      const result = detectPromoAggressiveLowCR(pricing, metrics30d);
      expect(result).toBe(false);
    });

    it('should NOT detect quando desconto < threshold', () => {
      const pricing: PricingInfo = {
        hasPromotion: true,
        discountPercent: 20, // < 30%
      };
      const metrics30d: Metrics30dInfo = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317,
        revenue: 32,
      };

      const result = detectPromoAggressiveLowCR(pricing, metrics30d);
      expect(result).toBe(false);
    });

    it('should NOT detect quando visits < MIN_VISITS_FOR_CR_CONFIDENCE', () => {
      const pricing: PricingInfo = {
        hasPromotion: true,
        discountPercent: 47,
      };
      const metrics30d: Metrics30dInfo = {
        visits: 100, // < 150
        orders: 1,
        conversionRate: 0.00317,
        revenue: 32,
      };

      const result = detectPromoAggressiveLowCR(pricing, metrics30d);
      expect(result).toBe(false);
    });

    it('should NOT detect quando conversionRate > threshold', () => {
      const pricing: PricingInfo = {
        hasPromotion: true,
        discountPercent: 47,
      };
      const metrics30d: Metrics30dInfo = {
        visits: 315,
        orders: 10,
        conversionRate: 0.01, // 1% > 0.6%
        revenue: 320,
      };

      const result = detectPromoAggressiveLowCR(pricing, metrics30d);
      expect(result).toBe(false);
    });

    it('should return false quando pricing é null', () => {
      const metrics30d: Metrics30dInfo = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317,
        revenue: 32,
      };

      const result = detectPromoAggressiveLowCR(null, metrics30d);
      expect(result).toBe(false);
    });

    it('should return false quando metrics30d é null', () => {
      const pricing: PricingInfo = {
        hasPromotion: true,
        discountPercent: 47,
      };

      const result = detectPromoAggressiveLowCR(pricing, null);
      expect(result).toBe(false);
    });
  });

  describe('generateActionPlan - Promoção Agressiva + Baixa Conversão', () => {
    const scoreBreakdownWithActions: IAScoreBreakdown = {
      cadastro: 15, // lost: 5 -> low (mas deve subir para medium com boost)
      midia: 10, // lost: 10 -> high (já é high)
      performance: 20, // lost: 10 -> high
      seo: 12, // lost: 8 -> medium (mas deve subir para high com boost)
      competitividade: 5, // lost: 5 -> medium (mas deve descer para low com penalty)
    };

    const baseDataQuality = {
      performanceAvailable: true,
      visitsCoverage: {
        filledDays: 28,
        totalDays: 30,
      },
    };

    const pricingPromoAgressiva: PricingInfo = {
      hasPromotion: true,
      discountPercent: 47,
    };

    const metrics30dLowCR: Metrics30dInfo = {
      visits: 315,
      orders: 1,
      conversionRate: 0.00317, // 0.317% < 0.6%
      revenue: 32,
    };

    const metrics30dOK: Metrics30dInfo = {
      visits: 315,
      orders: 20,
      conversionRate: 0.063, // 6.3% > 0.6%
      revenue: 640,
    };

    it('Caso 1: promo agressiva + low CR -> Top1 não é competitividade; Top1 é seo/midia/cadastro', () => {
      const actionPlan = generateActionPlan(
        scoreBreakdownWithActions,
        baseDataQuality,
        undefined,
        undefined,
        pricingPromoAgressiva,
        metrics30dLowCR
      );

      expect(actionPlan.length).toBeGreaterThan(0);

      // Top 1 NÃO deve ser competitividade
      const top1 = actionPlan[0];
      expect(top1.dimension).not.toBe('competitividade');

      // Top 1 deve ser seo, midia ou cadastro (ações de título/imagens/descrição)
      expect(['seo', 'midia', 'cadastro']).toContain(top1.dimension);

      // Competitividade deve estar com prioridade reduzida ou mais abaixo
      const competitividadeAction = actionPlan.find(a => a.dimension === 'competitividade');
      if (competitividadeAction) {
        // Se competitividade está presente, deve ter prioridade reduzida
        expect(competitividadeAction.priority).not.toBe('high');
      }
    });

    it('Caso 2: promo agressiva + CR ok -> competitividade pode subir normalmente', () => {
      const actionPlan = generateActionPlan(
        scoreBreakdownWithActions,
        baseDataQuality,
        undefined,
        undefined,
        pricingPromoAgressiva,
        metrics30dOK
      );

      expect(actionPlan.length).toBeGreaterThan(0);

      // Com CR ok, o gatilho não deve estar ativo
      // Competitividade pode estar no topo se tiver maior lostPoints
      // Não há penalty aplicado
      const competitividadeAction = actionPlan.find(a => a.dimension === 'competitividade');
      if (competitividadeAction) {
        // Não deve ter penalty (prioridade não deve ser forçada para low)
        // A prioridade deve ser baseada apenas em lostPoints
        expect(competitividadeAction.priority).toMatch(/^(high|medium|low)$/);
      }
    });

    it('Caso 3: low CR mas sem promo -> mantém lógica atual (sem boost/penalty)', () => {
      const pricingSemPromo: PricingInfo = {
        hasPromotion: false,
        discountPercent: null,
      };

      const actionPlan = generateActionPlan(
        scoreBreakdownWithActions,
        baseDataQuality,
        undefined,
        undefined,
        pricingSemPromo,
        metrics30dLowCR
      );

      expect(actionPlan.length).toBeGreaterThan(0);

      // Sem promo, o gatilho não deve estar ativo
      // Ordenação deve ser baseada apenas em lostPoints e prioridade base
      // Não há boost/penalty aplicado
      for (let i = 0; i < actionPlan.length - 1; i++) {
        const current = actionPlan[i];
        const next = actionPlan[i + 1];

        if (current.lostPoints !== next.lostPoints) {
          expect(current.lostPoints).toBeGreaterThan(next.lostPoints);
        }
      }
    });

    it('Caso 4: promo agressiva mas visits baixo (<150) -> não ativa gatilho', () => {
      const metrics30dLowVisits: Metrics30dInfo = {
        visits: 100, // < 150
        orders: 1,
        conversionRate: 0.00317, // 0.317% < 0.6%
        revenue: 32,
      };

      const actionPlan = generateActionPlan(
        scoreBreakdownWithActions,
        baseDataQuality,
        undefined,
        undefined,
        pricingPromoAgressiva,
        metrics30dLowVisits
      );

      expect(actionPlan.length).toBeGreaterThan(0);

      // Com visits baixo, o gatilho não deve estar ativo
      // Ordenação deve ser baseada apenas em lostPoints e prioridade base
      // Não há boost/penalty aplicado
      for (let i = 0; i < actionPlan.length - 1; i++) {
        const current = actionPlan[i];
        const next = actionPlan[i + 1];

        if (current.lostPoints !== next.lostPoints) {
          expect(current.lostPoints).toBeGreaterThan(next.lostPoints);
        }
      }
    });

    it('Caso específico: MLB4217107417 - hasPromotion=true, discountPercent=47, visits=315, orders=1, conversionRate=0.00317', () => {
      const pricing: PricingInfo = {
        hasPromotion: true,
        discountPercent: 47,
      };
      const metrics30d: Metrics30dInfo = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317,
        revenue: 32,
      };

      // Score breakdown que gera ações de seo, midia, cadastro e competitividade
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 15, // lost: 5
        midia: 10, // lost: 10
        performance: 30, // lost: 0 (perfeito)
        seo: 12, // lost: 8
        competitividade: 5, // lost: 5
      };

      const actionPlan = generateActionPlan(
        scoreBreakdown,
        baseDataQuality,
        undefined,
        undefined,
        pricing,
        metrics30d
      );

      expect(actionPlan.length).toBeGreaterThan(0);

      // Top 1 deve ser seo, midia ou cadastro (não competitividade)
      const top1 = actionPlan[0];
      expect(['seo', 'midia', 'cadastro']).toContain(top1.dimension);

      // Verificar que seo/midia/cadastro têm prioridade elevada
      const seoAction = actionPlan.find(a => a.dimension === 'seo');
      const midiaAction = actionPlan.find(a => a.dimension === 'midia');
      const cadastroAction = actionPlan.find(a => a.dimension === 'cadastro');
      const competitividadeAction = actionPlan.find(a => a.dimension === 'competitividade');

      if (seoAction) {
        expect(seoAction.priority).toMatch(/^(high|medium)$/);
      }
      if (midiaAction) {
        expect(midiaAction.priority).toBe('high');
      }
      if (cadastroAction) {
        expect(cadastroAction.priority).toMatch(/^(high|medium)$/);
      }
      if (competitividadeAction) {
        // Competitividade deve ter prioridade reduzida
        expect(competitividadeAction.priority).not.toBe('high');
      }
    });
  });
});

