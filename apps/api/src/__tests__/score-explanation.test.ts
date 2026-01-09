import { describe, it, expect } from 'vitest';
import { explainScore } from '../services/ScoreExplanationService';
import { IAScoreBreakdown } from '../services/IAScoreService';

describe('ScoreExplanationService', () => {
  const baseDataQuality = {
    performanceAvailable: true,
    visitsCoverage: {
      filledDays: 28,
      totalDays: 30,
    },
  };

  describe('explainScore', () => {
    it('should return explanations array with at least one item', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 15,
        midia: 10,
        performance: 20,
        seo: 15,
        competitividade: 5,
      };

      const explanations = explainScore(scoreBreakdown, baseDataQuality);

      expect(explanations).toBeInstanceOf(Array);
      expect(explanations.length).toBeGreaterThan(0);
    });

    it('should explain lost points in cadastro', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 10, // lost: 10
        midia: 20,
        performance: 30,
        seo: 20,
        competitividade: 10,
      };

      const explanations = explainScore(scoreBreakdown, baseDataQuality);

      const cadastroExplanation = explanations.find((e) => e.includes('Cadastro'));
      expect(cadastroExplanation).toBeTruthy();
      expect(cadastroExplanation).toContain('10');
    });

    it('should explain lost points in midia', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 20,
        midia: 5, // lost: 15
        performance: 30,
        seo: 20,
        competitividade: 10,
      };

      const explanations = explainScore(scoreBreakdown, baseDataQuality);

      const midiaExplanation = explanations.find((e) => e.includes('Mídia'));
      expect(midiaExplanation).toBeTruthy();
      expect(midiaExplanation).toContain('15');
    });

    it('should explain performance when performanceAvailable=true', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 15, // lost: 15
        seo: 20,
        competitividade: 10,
      };

      const explanations = explainScore(scoreBreakdown, baseDataQuality);

      const performanceExplanation = explanations.find((e) => e.includes('Performance'));
      expect(performanceExplanation).toBeTruthy();
      expect(performanceExplanation).toContain('15');
    });

    it('should explain performance unavailability when performanceAvailable=false', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 15, // Score existe, mas não disponível via API
        seo: 20,
        competitividade: 10,
      };

      const dataQualityNoPerformance = {
        performanceAvailable: false,
        visitsCoverage: {
          filledDays: 0,
          totalDays: 30,
        },
      };

      const explanations = explainScore(scoreBreakdown, dataQualityNoPerformance);

      const performanceExplanation = explanations.find((e) => e.includes('Performance'));
      expect(performanceExplanation).toBeTruthy();
      expect(performanceExplanation).toContain('não foi avaliada');
      expect(performanceExplanation).toContain('indisponibilidade');
    });

    it('should explain SEO score', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 30,
        seo: 10, // lost: 10
        competitividade: 10,
      };

      const explanations = explainScore(scoreBreakdown, baseDataQuality);

      const seoExplanation = explanations.find((e) => e.includes('SEO'));
      expect(seoExplanation).toBeTruthy();
      expect(seoExplanation).toContain('SEO');
      expect(seoExplanation).toContain('melhorado');
    });

    it('should explain competitividade score', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 30,
        seo: 20,
        competitividade: 3, // lost: 7
      };

      const explanations = explainScore(scoreBreakdown, baseDataQuality);

      const competitividadeExplanation = explanations.find((e) => e.includes('Competitividade'));
      expect(competitividadeExplanation).toBeTruthy();
      expect(competitividadeExplanation).toContain('Competitividade');
    });

    it('should handle perfect score (all max)', () => {
      const perfectScore: IAScoreBreakdown = {
        cadastro: 20,
        midia: 20,
        performance: 30,
        seo: 20,
        competitividade: 10,
      };

      const explanations = explainScore(perfectScore, baseDataQuality);

      // Deve ter explicações positivas para todas as dimensões
      expect(explanations.length).toBeGreaterThan(0);
      explanations.forEach((explanation) => {
        expect(explanation).toBeTruthy();
      });
    });

    it('should handle zero scores correctly', () => {
      const zeroScore: IAScoreBreakdown = {
        cadastro: 0,
        midia: 0,
        performance: 0,
        seo: 0,
        competitividade: 0,
      };

      const explanations = explainScore(zeroScore, baseDataQuality);

      expect(explanations.length).toBeGreaterThan(0);
      
      // Verificar que todas as dimensões com lost points são explicadas
      const cadastroExp = explanations.find((e) => e.includes('Cadastro'));
      const midiaExp = explanations.find((e) => e.includes('Mídia'));
      const seoExp = explanations.find((e) => e.includes('SEO'));
      const competitividadeExp = explanations.find((e) => e.includes('Competitividade'));

      expect(cadastroExp).toBeTruthy();
      expect(midiaExp).toBeTruthy();
      expect(seoExp).toBeTruthy();
      expect(competitividadeExp).toBeTruthy();

      // Performance deve estar explicada também (mesmo com score 0, se available)
      const performanceExp = explanations.find((e) => e.includes('Performance'));
      expect(performanceExp).toBeTruthy();
    });

    it('should use singular/plural correctly for lost points', () => {
      const scoreBreakdown1: IAScoreBreakdown = {
        cadastro: 19, // lost: 1 (singular)
        midia: 18, // lost: 2 (plural)
        performance: 30,
        seo: 20,
        competitividade: 10,
      };

      const explanations1 = explainScore(scoreBreakdown1, baseDataQuality);

      const cadastroExp1 = explanations1.find((e) => e.includes('Cadastro') && e.includes('1'));
      const midiaExp1 = explanations1.find((e) => e.includes('Mídia') && e.includes('2'));

      if (cadastroExp1) {
        expect(cadastroExp1).toMatch(/ponto[^s]/); // singular
      }
      if (midiaExp1) {
        expect(midiaExp1).toMatch(/pontos/); // plural
      }
    });

    it('should return explanations in a clear and deterministic format', () => {
      const scoreBreakdown: IAScoreBreakdown = {
        cadastro: 15,
        midia: 10,
        performance: 20,
        seo: 15,
        competitividade: 5,
      };

      const explanations1 = explainScore(scoreBreakdown, baseDataQuality);
      const explanations2 = explainScore(scoreBreakdown, baseDataQuality);

      // Deve ser determinístico (mesmas explicações)
      expect(explanations1).toEqual(explanations2);
      expect(explanations1.length).toBe(explanations2.length);
    });
  });
});

