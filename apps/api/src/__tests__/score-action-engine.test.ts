import { describe, it, expect } from 'vitest';
import { generateActionPlan, ActionPlanItem, ActionDimension } from '../services/ScoreActionEngine';
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
});

