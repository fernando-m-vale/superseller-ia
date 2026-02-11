import { describe, it, expect } from 'vitest';
import { rankGaps, normalizeBenchmarkInsights } from '../services/BenchmarkInsightsService';
import { BenchmarkResult, BenchmarkStats, BaselineConversion } from '../services/BenchmarkService';

describe('BenchmarkInsightsService', () => {
  describe('rankGaps', () => {
    it('deve retornar máximo 3 gaps ordenados por prioridade', () => {
      const listing = {
        picturesCount: 3,
        hasClips: false,
        titleLength: 40,
        price: 100,
        hasPromotion: true,
        discountPercent: 47,
      };

      const stats: BenchmarkStats = {
        medianPicturesCount: 8,
        percentageWithVideo: 60,
        medianPrice: 90,
        medianTitleLength: 60,
        sampleSize: 20,
      };

      const baselineConversion: BaselineConversion = {
        conversionRate: 0.01,
        sampleSize: 50,
        totalVisits: 5000,
        confidence: 'high',
      };

      const metrics30d = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317,
      };

      const gaps = rankGaps(listing, stats, baselineConversion, metrics30d);

      expect(gaps.length).toBeLessThanOrEqual(3);
      
      // Verificar ordenação: Impact DESC, Effort ASC, Confidence DESC
      if (gaps.length > 1) {
        for (let i = 0; i < gaps.length - 1; i++) {
          const current = gaps[i];
          const next = gaps[i + 1];
          
          const impactOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
          const effortOrder: Record<string, number> = { low: 1, medium: 2, high: 3 };
          const confidenceOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
          
          // Se impact igual, verificar effort
          if (impactOrder[current.impact] === impactOrder[next.impact]) {
            if (effortOrder[current.effort] === effortOrder[next.effort]) {
              // Se effort igual, verificar confidence
              expect(confidenceOrder[current.confidence]).toBeGreaterThanOrEqual(confidenceOrder[next.confidence]);
            } else {
              expect(effortOrder[current.effort]).toBeLessThanOrEqual(effortOrder[next.effort]);
            }
          } else {
            expect(impactOrder[current.impact]).toBeGreaterThanOrEqual(impactOrder[next.impact]);
          }
        }
      }
    });

    it('deve retornar gap de imagens quando picturesCount < medianPicturesCount', () => {
      const listing = {
        picturesCount: 3,
        hasClips: null,
        titleLength: 50,
        price: 100,
        hasPromotion: false,
        discountPercent: null,
      };

      const stats: BenchmarkStats = {
        medianPicturesCount: 8,
        percentageWithVideo: 30,
        medianPrice: 90,
        medianTitleLength: 50,
        sampleSize: 20,
      };

      const baselineConversion: BaselineConversion = {
        conversionRate: null,
        sampleSize: 0,
        totalVisits: 0,
        confidence: 'unavailable',
      };

      const metrics30d = {
        visits: 100,
        orders: 0,
        conversionRate: null,
      };

      const gaps = rankGaps(listing, stats, baselineConversion, metrics30d);

      const imageGap = gaps.find(g => g.dimension === 'images');
      expect(imageGap).toBeDefined();
      expect(imageGap?.id).toBe('gap_images');
      expect(imageGap?.impact).toBe('high');
      expect(imageGap?.effort).toBe('low');
    });

    it('deve retornar gap de vídeo quando categoria tem alta % com vídeo e listing sem clip', () => {
      const listing = {
        picturesCount: 8,
        hasClips: false,
        titleLength: 50,
        price: 100,
        hasPromotion: false,
        discountPercent: null,
      };

      const stats: BenchmarkStats = {
        medianPicturesCount: 8,
        percentageWithVideo: 60,
        medianPrice: 90,
        medianTitleLength: 50,
        sampleSize: 20,
      };

      const baselineConversion: BaselineConversion = {
        conversionRate: null,
        sampleSize: 0,
        totalVisits: 0,
        confidence: 'unavailable',
      };

      const metrics30d = {
        visits: 100,
        orders: 0,
        conversionRate: null,
      };

      const gaps = rankGaps(listing, stats, baselineConversion, metrics30d);

      const videoGap = gaps.find(g => g.dimension === 'video');
      expect(videoGap).toBeDefined();
      expect(videoGap?.id).toBe('gap_video');
      expect(videoGap?.impact).toBe('high');
    });

    it('deve retornar gap de conversão vs promo quando promo ativa e CR abaixo do baseline', () => {
      const listing = {
        picturesCount: 8,
        hasClips: true,
        titleLength: 60,
        price: 100,
        hasPromotion: true,
        discountPercent: 47,
      };

      const stats: BenchmarkStats = {
        medianPicturesCount: 8,
        percentageWithVideo: 50,
        medianPrice: 90,
        medianTitleLength: 60,
        sampleSize: 20,
      };

      const baselineConversion: BaselineConversion = {
        conversionRate: 0.01,
        sampleSize: 50,
        totalVisits: 5000,
        confidence: 'high',
      };

      const metrics30d = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317,
      };

      const gaps = rankGaps(listing, stats, baselineConversion, metrics30d);

      const conversionGap = gaps.find(g => g.id === 'gap_conversion_vs_promo');
      expect(conversionGap).toBeDefined();
      expect(conversionGap?.dimension).toBe('description');
      expect(conversionGap?.impact).toBe('high');
    });

    it('NÃO deve retornar gap de conversão quando baseline indisponível', () => {
      const listing = {
        picturesCount: 8,
        hasClips: true,
        titleLength: 60,
        price: 100,
        hasPromotion: true,
        discountPercent: 47,
      };

      const stats: BenchmarkStats = {
        medianPicturesCount: 8,
        percentageWithVideo: 50,
        medianPrice: 90,
        medianTitleLength: 60,
        sampleSize: 20,
      };

      const baselineConversion: BaselineConversion = {
        conversionRate: null,
        sampleSize: 0,
        totalVisits: 0,
        confidence: 'unavailable',
      };

      const metrics30d = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317,
      };

      const gaps = rankGaps(listing, stats, baselineConversion, metrics30d);

      const conversionGap = gaps.find(g => g.id === 'gap_conversion_vs_promo');
      expect(conversionGap).toBeUndefined();
    });
  });

  describe('normalizeBenchmarkInsights', () => {
    it('deve retornar estrutura vazia quando benchmark indisponível', () => {
      const listing = {
        picturesCount: 5,
        hasClips: null,
        titleLength: 50,
        price: 100,
        hasPromotion: false,
        discountPercent: null,
      };

      const metrics30d = {
        visits: 100,
        orders: 0,
        conversionRate: null,
      };

      const insights = normalizeBenchmarkInsights(null, listing, metrics30d);

      expect(insights.confidence).toBe('unavailable');
      expect(insights.wins).toEqual([]);
      expect(insights.losses).toEqual([]);
      expect(insights.criticalGaps).toEqual([]);
    });

    it('deve normalizar wins e losses do benchmark', () => {
      const benchmarkResult: BenchmarkResult = {
        benchmarkSummary: {
          categoryId: 'MLB123',
          sampleSize: 20,
          computedAt: new Date().toISOString(),
          confidence: 'high',
          stats: {
            medianPicturesCount: 8,
            percentageWithVideo: 50,
            medianPrice: 90,
            medianTitleLength: 60,
            sampleSize: 20,
          },
          baselineConversion: {
            conversionRate: 0.01,
            sampleSize: 50,
            totalVisits: 5000,
            confidence: 'high',
          },
        },
        youWinHere: ['Você tem 10 imagens, acima da média'],
        youLoseHere: ['Você tem 3 imagens, abaixo da média'],
        tradeoffs: 'Tradeoffs',
        recommendations: [],
      };

      const listing = {
        picturesCount: 3,
        hasClips: false,
        titleLength: 50,
        price: 100,
        hasPromotion: false,
        discountPercent: null,
      };

      const metrics30d = {
        visits: 100,
        orders: 0,
        conversionRate: null,
      };

      const insights = normalizeBenchmarkInsights(benchmarkResult, listing, metrics30d);

      expect(insights.confidence).toBe('high');
      expect(insights.wins.length).toBeGreaterThan(0);
      expect(insights.losses.length).toBeGreaterThan(0);
      expect(insights.wins[0].message).toContain('Você tem');
      expect(insights.losses[0].message).toContain('Você tem');
    });
  });
});
