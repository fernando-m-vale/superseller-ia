import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BenchmarkService, CompetitorItem, BenchmarkStats } from '../services/BenchmarkService';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    listing: {
      findMany: vi.fn(),
    },
    listingMetricsDaily: {
      findMany: vi.fn(),
    },
  })),
}));

describe('BenchmarkService', () => {
  const tenantId = 'test-tenant-id';
  let benchmarkService: BenchmarkService;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    benchmarkService = new BenchmarkService(tenantId);
    mockPrisma = (PrismaClient as any).mock.results[0]?.value || {
      listing: { findMany: vi.fn() },
      listingMetricsDaily: { findMany: vi.fn() },
    };
  });

  describe('calculateBenchmarkStats', () => {
    it('should calculate median pictures count correctly', () => {
      const competitors: CompetitorItem[] = [
        { id: '1', title: 'Item 1', price: 100, pictures_count: 5, has_video: null, category_id: 'MLB123' },
        { id: '2', title: 'Item 2', price: 200, pictures_count: 8, has_video: true, category_id: 'MLB123' },
        { id: '3', title: 'Item 3', price: 150, pictures_count: 6, has_video: false, category_id: 'MLB123' },
        { id: '4', title: 'Item 4', price: 180, pictures_count: 10, has_video: true, category_id: 'MLB123' },
        { id: '5', title: 'Item 5', price: 120, pictures_count: 7, has_video: null, category_id: 'MLB123' },
      ];

      // Acessar método privado via reflection ou testar indiretamente
      // Por enquanto, vamos testar via calculateBenchmark completo
      const result = (benchmarkService as any).calculateBenchmarkStats(competitors);

      expect(result.medianPicturesCount).toBe(7); // Mediana de [5,6,7,8,10] = 7
      expect(result.percentageWithVideo).toBeCloseTo(66.67, 1); // 2 com vídeo de 3 detectáveis (exclui null: 2 true, 1 false, 2 null)
      expect(result.medianPrice).toBe(150); // Mediana de [100,120,150,180,200] = 150
      expect(result.medianTitleLength).toBeGreaterThan(0);
      expect(result.sampleSize).toBe(5);
    });

    it('should handle empty competitors array', () => {
      const result = (benchmarkService as any).calculateBenchmarkStats([]);

      expect(result.medianPicturesCount).toBe(0);
      expect(result.percentageWithVideo).toBe(0);
      expect(result.medianPrice).toBe(0);
      expect(result.medianTitleLength).toBe(0);
      expect(result.sampleSize).toBe(0);
    });
  });

  describe('generateWinLose', () => {
    it('should identify gaps in pictures count', () => {
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
        percentageWithVideo: 60,
        medianPrice: 100,
        medianTitleLength: 60,
        sampleSize: 20,
      };

      const baselineConversion = {
        conversionRate: null,
        sampleSize: 0,
        totalVisits: 0,
        confidence: 'unavailable' as const,
      };

      const metrics30d = {
        visits: 200,
        orders: 2,
        conversionRate: 0.01,
      };

      const result = (benchmarkService as any).generateWinLose(
        listing,
        stats,
        baselineConversion,
        metrics30d
      );

      expect(result.youLoseHere.length).toBeGreaterThan(0);
      expect(result.youLoseHere.some((item: string) => item.includes('imagens'))).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should identify wins when above median', () => {
      const listing = {
        picturesCount: 10,
        hasClips: true,
        titleLength: 70,
        price: 90,
        hasPromotion: false,
        discountPercent: null,
      };

      const stats: BenchmarkStats = {
        medianPicturesCount: 6,
        percentageWithVideo: 40,
        medianPrice: 100,
        medianTitleLength: 50,
        sampleSize: 20,
      };

      const baselineConversion = {
        conversionRate: null,
        sampleSize: 0,
        totalVisits: 0,
        confidence: 'unavailable' as const,
      };

      const metrics30d = {
        visits: 200,
        orders: 5,
        conversionRate: 0.025,
      };

      const result = (benchmarkService as any).generateWinLose(
        listing,
        stats,
        baselineConversion,
        metrics30d
      );

      expect(result.youWinHere.length).toBeGreaterThan(0);
      expect(result.youWinHere.some((item: string) => item.includes('imagens'))).toBe(true);
    });

    it('should apply promo agressiva + low CR rule (Dia 03)', () => {
      const listing = {
        picturesCount: 5,
        hasClips: null,
        titleLength: 50,
        price: 32,
        hasPromotion: true,
        discountPercent: 47,
      };

      const stats: BenchmarkStats = {
        medianPicturesCount: 6,
        percentageWithVideo: 50,
        medianPrice: 60,
        medianTitleLength: 55,
        sampleSize: 20,
      };

      const baselineConversion = {
        conversionRate: null,
        sampleSize: 0,
        totalVisits: 0,
        confidence: 'unavailable' as const,
      };

      const metrics30d = {
        visits: 315,
        orders: 1,
        conversionRate: 0.00317, // < 0.006
      };

      const result = (benchmarkService as any).generateWinLose(
        listing,
        stats,
        baselineConversion,
        metrics30d
      );

      expect(result.youLoseHere.some((item: string) => item.includes('Promoção forte'))).toBe(true);
      expect(result.recommendations.some((item: string) => item.includes('título') || item.includes('imagens'))).toBe(true);
    });
  });

  describe('calculateBaselineConversion', () => {
    it('should return unavailable when sample size is too small', async () => {
      const prismaMock = {
        listing: {
          findMany: vi.fn().mockResolvedValue([
            { id: '1' },
            { id: '2' },
          ]),
        },
        listingMetricsDaily: {
          findMany: vi.fn(),
        },
      } as any;
      
      const serviceWithMock = new BenchmarkService(tenantId, prismaMock);
      const result = await (serviceWithMock as any).calculateBaselineConversion('MLB123');

      expect(result.conversionRate).toBeNull();
      expect(result.confidence).toBe('unavailable');
      expect(result.sampleSize).toBe(2);
    });

    it('should return unavailable when total visits is too low', async () => {
      const prismaMock = {
        listing: {
          findMany: vi.fn().mockResolvedValue(
            Array(40).fill(null).map((_, i) => ({ id: `listing-${i}` }))
          ),
        },
        listingMetricsDaily: {
          findMany: vi.fn().mockResolvedValue([
            { visits: 10, orders: 1 },
            { visits: 5, orders: 0 },
          ]),
        },
      } as any;
      
      const serviceWithMock = new BenchmarkService(tenantId, prismaMock);
      const result = await (serviceWithMock as any).calculateBaselineConversion('MLB123');

      expect(result.conversionRate).toBeNull();
      expect(result.confidence).toBe('unavailable');
    });

    it('should calculate conversion rate when data is sufficient', async () => {
      const prismaMock = {
        listing: {
          findMany: vi.fn().mockResolvedValue(
            Array(50).fill(null).map((_, i) => ({ id: `listing-${i}` }))
          ),
        },
        listingMetricsDaily: {
          findMany: vi.fn().mockResolvedValue([
            { visits: 500, orders: 10 },
            { visits: 500, orders: 10 },
          ]),
        },
      } as any;
      
      const serviceWithMock = new BenchmarkService(tenantId, prismaMock);
      const result = await (serviceWithMock as any).calculateBaselineConversion('MLB123');

      expect(result.conversionRate).toBeCloseTo(0.02, 3);
      expect(result.confidence).toBe('medium'); // 50 listings >= 30, 1000 visits >= 1000 = medium
      expect(result.totalVisits).toBe(1000);
    });
  });

  describe('calculateBenchmark', () => {
    it('should return null when no competitors found', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { results: [] },
      });

      const result = await benchmarkService.calculateBenchmark(
        {
          id: 'listing-1',
          listingIdExt: 'MLB123',
          categoryId: 'MLB1234',
          picturesCount: 5,
          hasClips: null,
          title: 'Test Item',
          price: 100,
          hasPromotion: false,
          discountPercent: null,
        },
        {
          visits: 200,
          orders: 2,
          conversionRate: 0.01,
        }
      );

      expect(result).toBeNull();
    });

    it('should calculate benchmark with competitors', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          results: [
            { id: 'comp1', title: 'Competitor 1', price: 100, pictures: [{}, {}], category_id: 'MLB1234' },
            { id: 'comp2', title: 'Competitor 2', price: 120, pictures: [{}, {}, {}], video_id: 'vid1', category_id: 'MLB1234' },
            { id: 'comp3', title: 'Competitor 3', price: 110, pictures: [{}, {}], category_id: 'MLB1234' },
          ],
        },
      });

      mockPrisma.listing.findMany.mockResolvedValue([]); // Baseline unavailable

      const result = await benchmarkService.calculateBenchmark(
        {
          id: 'listing-1',
          listingIdExt: 'MLB123',
          categoryId: 'MLB1234',
          picturesCount: 2,
          hasClips: null,
          title: 'Test Item',
          price: 100,
          hasPromotion: false,
          discountPercent: null,
        },
        {
          visits: 200,
          orders: 2,
          conversionRate: 0.01,
        }
      );

      expect(result).not.toBeNull();
      expect(result?.benchmarkSummary).toBeDefined();
      expect(result?.youWinHere.length).toBeGreaterThan(0);
      expect(result?.youLoseHere.length).toBeGreaterThan(0);
      expect(result?.recommendations.length).toBeGreaterThan(0);
      expect(result?.tradeoffs).toBeTruthy();
    });
  });
});
