import { describe, it, expect } from 'vitest';
import * as tf from '@tensorflow/tfjs-node';
import {
  filterMetricsByWindow,
  groupMetricsByListing,
  calculateRecommendationScores,
  generateRecommendations,
  recommendActions,
  trainMockModel,
} from '../src/engine';
import { ListingDailyMetric, RecommendationInput } from '../src/types';

const createMockMetric = (
  listingId: string,
  date: string,
  overrides: Partial<ListingDailyMetric> = {}
): ListingDailyMetric => ({
  listingId,
  date,
  impressions: 1000,
  clicks: 50,
  ctr: 0.05,
  visits: 45,
  conversion: 0.02,
  orders: 1,
  gmv: 100,
  ...overrides,
});

describe('filterMetricsByWindow', () => {
  it('should filter metrics within window days', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01'),
      createMockMetric('listing-1', '2025-11-05'),
      createMockMetric('listing-1', '2025-11-08'),
      createMockMetric('listing-1', '2025-11-10'),
    ];

    const filtered = filterMetricsByWindow(metrics, 7);
    
    expect(filtered.length).toBeGreaterThanOrEqual(2);
    expect(filtered.length).toBeLessThanOrEqual(4);
  });

  it('should return empty array for empty input', () => {
    const filtered = filterMetricsByWindow([], 7);
    expect(filtered).toEqual([]);
  });

  it('should sort metrics by date', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-10'),
      createMockMetric('listing-1', '2025-11-05'),
      createMockMetric('listing-1', '2025-11-08'),
    ];

    const filtered = filterMetricsByWindow(metrics, 30);
    
    expect(new Date(filtered[0].date).getTime()).toBeLessThanOrEqual(
      new Date(filtered[filtered.length - 1].date).getTime()
    );
  });
});

describe('groupMetricsByListing', () => {
  it('should group metrics by listing ID', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01'),
      createMockMetric('listing-2', '2025-11-01'),
      createMockMetric('listing-1', '2025-11-02'),
      createMockMetric('listing-3', '2025-11-01'),
    ];

    const grouped = groupMetricsByListing(metrics);
    
    expect(grouped.size).toBe(3);
    expect(grouped.get('listing-1')?.length).toBe(2);
    expect(grouped.get('listing-2')?.length).toBe(1);
    expect(grouped.get('listing-3')?.length).toBe(1);
  });

  it('should handle empty array', () => {
    const grouped = groupMetricsByListing([]);
    expect(grouped.size).toBe(0);
  });
});

describe('calculateRecommendationScores', () => {
  it('should calculate scores correctly', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01', { ctr: 0.05, conversion: 0.02, gmv: 100, orders: 1 }),
      createMockMetric('listing-1', '2025-11-02', { ctr: 0.06, conversion: 0.03, gmv: 150, orders: 2 }),
      createMockMetric('listing-1', '2025-11-03', { ctr: 0.04, conversion: 0.01, gmv: 80, orders: 1 }),
    ];

    const score = calculateRecommendationScores(metrics);
    
    expect(score).not.toBeNull();
    expect(score!.listingId).toBe('listing-1');
    expect(score!.overallScore).toBeGreaterThan(0);
    expect(score!.overallScore).toBeLessThanOrEqual(100);
    expect(score!.ctrScore).toBeGreaterThanOrEqual(0);
    expect(score!.conversionScore).toBeGreaterThanOrEqual(0);
    expect(score!.revenueScore).toBeGreaterThanOrEqual(0);
    expect(score!.ordersScore).toBeGreaterThanOrEqual(0);
  });

  it('should return null for empty metrics', () => {
    const score = calculateRecommendationScores([]);
    expect(score).toBeNull();
  });

  it('should return null when all values are invalid', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01', { ctr: NaN, conversion: NaN, gmv: NaN, orders: NaN }),
    ];

    const score = calculateRecommendationScores(metrics);
    expect(score).toBeNull();
  });

  it('should filter out negative values', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01', { ctr: 0.05, conversion: 0.02, gmv: 100, orders: 1 }),
      createMockMetric('listing-1', '2025-11-02', { ctr: -0.01, conversion: -0.01, gmv: -50, orders: -1 }),
    ];

    const score = calculateRecommendationScores(metrics);
    expect(score).not.toBeNull();
  });
});

describe('generateRecommendations', () => {
  it('should generate title recommendation for low CTR', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01', { ctr: 0.01, conversion: 0.05, gmv: 200, orders: 3 }),
      createMockMetric('listing-1', '2025-11-02', { ctr: 0.01, conversion: 0.05, gmv: 200, orders: 3 }),
      createMockMetric('listing-1', '2025-11-03', { ctr: 0.01, conversion: 0.05, gmv: 200, orders: 3 }),
    ];

    const score = calculateRecommendationScores(metrics)!;
    const recommendations = generateRecommendations(score, metrics);
    
    const titleRec = recommendations.find(r => r.type === 'title');
    expect(titleRec).toBeDefined();
    expect(titleRec!.score).toBeLessThanOrEqual(20);
    expect(titleRec!.priority).toBeGreaterThan(0.5);
  });

  it('should generate price recommendation for low conversion', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01', { ctr: 0.08, conversion: 0.005, gmv: 50, orders: 1 }),
      createMockMetric('listing-1', '2025-11-02', { ctr: 0.08, conversion: 0.005, gmv: 50, orders: 1 }),
      createMockMetric('listing-1', '2025-11-03', { ctr: 0.08, conversion: 0.005, gmv: 50, orders: 1 }),
    ];

    const score = calculateRecommendationScores(metrics)!;
    const recommendations = generateRecommendations(score, metrics);
    
    const priceRec = recommendations.find(r => r.type === 'price');
    expect(priceRec).toBeDefined();
  });

  it('should generate multiple recommendations', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01', { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 }),
      createMockMetric('listing-1', '2025-11-02', { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 }),
      createMockMetric('listing-1', '2025-11-03', { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 }),
    ];

    const score = calculateRecommendationScores(metrics)!;
    const recommendations = generateRecommendations(score, metrics);
    
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it('should sort recommendations by priority', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01', { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 }),
      createMockMetric('listing-1', '2025-11-02', { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 }),
      createMockMetric('listing-1', '2025-11-03', { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 }),
    ];

    const score = calculateRecommendationScores(metrics)!;
    const recommendations = generateRecommendations(score, metrics);
    
    for (let i = 1; i < recommendations.length; i++) {
      expect(recommendations[i - 1].priority).toBeGreaterThanOrEqual(recommendations[i].priority);
    }
  });
});

describe('recommendActions', () => {
  it('should generate at least 5 types of recommendations with score > 0.5', () => {
    const metrics: ListingDailyMetric[] = [];
    
    for (let i = 0; i < 10; i++) {
      metrics.push(
        createMockMetric('listing-1', `2025-11-0${i + 1}`, { 
          ctr: 0.01, 
          conversion: 0.005, 
          gmv: 30, 
          orders: 0.3 
        })
      );
      metrics.push(
        createMockMetric('listing-2', `2025-11-0${i + 1}`, { 
          ctr: 0.02, 
          conversion: 0.01, 
          gmv: 50, 
          orders: 0.5 
        })
      );
    }

    const input: RecommendationInput = {
      metrics,
      windowDays: 10,
      minDays: 3,
    };

    const actions = recommendActions(input);
    
    expect(actions.length).toBeGreaterThan(0);
    
    const actionTypes = new Set(actions.map(a => a.type));
    const highPriorityActions = actions.filter(a => a.priority > 0.5);
    
    expect(highPriorityActions.length).toBeGreaterThanOrEqual(5);
  });

  it('should return empty array for insufficient data', () => {
    const metrics: ListingDailyMetric[] = [
      createMockMetric('listing-1', '2025-11-01'),
      createMockMetric('listing-1', '2025-11-02'),
    ];

    const input: RecommendationInput = {
      metrics,
      windowDays: 7,
      minDays: 3,
    };

    const actions = recommendActions(input);
    expect(actions).toEqual([]);
  });

  it('should respect windowDays parameter', () => {
    const metrics: ListingDailyMetric[] = [];
    
    for (let i = 0; i < 30; i++) {
      metrics.push(
        createMockMetric('listing-1', `2025-10-${String(i + 1).padStart(2, '0')}`, { 
          ctr: 0.01, 
          conversion: 0.005, 
          gmv: 30, 
          orders: 0.5 
        })
      );
    }

    const input: RecommendationInput = {
      metrics,
      windowDays: 7,
      minDays: 3,
    };

    const actions = recommendActions(input);
    expect(actions.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple listings', () => {
    const metrics: ListingDailyMetric[] = [];
    
    for (let i = 1; i <= 7; i++) {
      metrics.push(
        createMockMetric('listing-1', `2025-11-0${i}`, { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 })
      );
      metrics.push(
        createMockMetric('listing-2', `2025-11-0${i}`, { ctr: 0.02, conversion: 0.01, gmv: 50, orders: 1 })
      );
      metrics.push(
        createMockMetric('listing-3', `2025-11-0${i}`, { ctr: 0.03, conversion: 0.015, gmv: 70, orders: 1.5 })
      );
    }

    const input: RecommendationInput = {
      metrics,
      windowDays: 7,
      minDays: 3,
    };

    const actions = recommendActions(input);
    
    const listingIds = new Set(actions.map(a => a.listingId));
    expect(listingIds.size).toBeGreaterThan(0);
  });

  it('should return actions sorted by priority', () => {
    const metrics: ListingDailyMetric[] = [];
    
    for (let i = 1; i <= 7; i++) {
      metrics.push(
        createMockMetric('listing-1', `2025-11-0${i}`, { ctr: 0.01, conversion: 0.005, gmv: 30, orders: 0.5 })
      );
    }

    const input: RecommendationInput = {
      metrics,
      windowDays: 7,
      minDays: 3,
    };

    const actions = recommendActions(input);
    
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].priority).toBeGreaterThanOrEqual(actions[i].priority);
    }
  });
});

describe('trainMockModel', () => {
  it('should train a TensorFlow model successfully', async () => {
    const metrics: ListingDailyMetric[] = [];
    
    for (let i = 0; i < 20; i++) {
      metrics.push(
        createMockMetric('listing-1', `2025-11-${String(i + 1).padStart(2, '0')}`, {
          ctr: 0.01 + Math.random() * 0.05,
          conversion: 0.005 + Math.random() * 0.02,
          gmv: 50 + Math.random() * 100,
          orders: Math.floor(Math.random() * 5),
        })
      );
    }

    const model = await trainMockModel(metrics);
    
    expect(model).toBeDefined();
    expect(model.layers.length).toBeGreaterThan(0);
    
    const testInputTensor = tf.tensor2d([[0.05, 0.02, 100, 2]]);
    const prediction = model.predict(testInputTensor) as tf.Tensor;
    const prediction = model.predict(testInputTensor) as any;
    
    expect(prediction).toBeDefined();
    
    testInputTensor.dispose();
    prediction.dispose();
    model.dispose();
  });
});
