import { describe, it, expect } from 'vitest';
import { healthScore, type ListingDailyMetric } from '../src/healthScore';

function generateISODate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

describe('healthScore', () => {
  it('(a) happy path with 5 days of varied values returns valid score', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(4), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(3), impressions: 1200, visits: 150, orders: 15, revenue: 750 },
      { date: generateISODate(2), impressions: 800, visits: 80, orders: 8, revenue: 400 },
      { date: generateISODate(1), impressions: 1500, visits: 200, orders: 20, revenue: 1000 },
      { date: generateISODate(0), impressions: 1100, visits: 120, orders: 12, revenue: 600 },
    ];

    const score = healthScore(metrics);
    expect(score).not.toBeNull();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(typeof score).toBe('number');
  });

  it('(b) windowDays=3 filters correctly and returns consistent value', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(6), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(5), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(4), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(2), impressions: 2000, visits: 300, orders: 30, revenue: 1500 },
      { date: generateISODate(1), impressions: 2000, visits: 300, orders: 30, revenue: 1500 },
      { date: generateISODate(0), impressions: 2000, visits: 300, orders: 30, revenue: 1500 },
    ];

    const scoreWithWindow = healthScore(metrics, { windowDays: 3 });
    expect(scoreWithWindow).not.toBeNull();

    const last3Metrics = metrics.slice(-3);
    const scoreDirectLast3 = healthScore(last3Metrics);
    expect(scoreWithWindow).toBeCloseTo(scoreDirectLast3!, 2);
  });

  it('(c) all values equal (constant CTR/CVR/revenue/orders) returns score ~50.00', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(4), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(3), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(2), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(1), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(0), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
    ];

    const score = healthScore(metrics);
    expect(score).not.toBeNull();
    expect(score).toBeCloseTo(50.00, 2);
  });

  it('(d) entries with zeros (impressions=0, visits=0) do not break, CTR/CVR=0', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(4), impressions: 0, visits: 0, orders: 0, revenue: 0 },
      { date: generateISODate(3), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(2), impressions: 0, visits: 0, orders: 0, revenue: 100 },
      { date: generateISODate(1), impressions: 1200, visits: 120, orders: 12, revenue: 600 },
      { date: generateISODate(0), impressions: 800, visits: 80, orders: 8, revenue: 400 },
    ];

    const score = healthScore(metrics);
    expect(score).not.toBeNull();
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('(e) negative values or NaN are ignored, if < minDays after filtering returns null', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(4), impressions: -100, visits: 50, orders: 5, revenue: 250 },
      { date: generateISODate(3), impressions: 1000, visits: -50, orders: 10, revenue: 500 },
      { date: generateISODate(2), impressions: 1000, visits: 100, orders: NaN, revenue: 500 },
      { date: generateISODate(1), impressions: 1000, visits: 100, orders: 10, revenue: -500 },
    ];

    const score = healthScore(metrics);
    expect(score).toBeNull();
  });

  it('(f) empty array returns null', () => {
    const score = healthScore([]);
    expect(score).toBeNull();
  });

  it('(g) minDays greater than available quantity returns null', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(1), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(0), impressions: 1200, visits: 120, orders: 12, revenue: 600 },
    ];

    const score = healthScore(metrics, { minDays: 5 });
    expect(score).toBeNull();
  });

  it('(h) custom weights alter the result compared to default', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(4), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(3), impressions: 1200, visits: 150, orders: 15, revenue: 750 },
      { date: generateISODate(2), impressions: 800, visits: 80, orders: 8, revenue: 400 },
      { date: generateISODate(1), impressions: 1500, visits: 200, orders: 20, revenue: 1000 },
      { date: generateISODate(0), impressions: 1100, visits: 120, orders: 12, revenue: 600 },
    ];

    const scoreDefault = healthScore(metrics);
    const scoreCustom = healthScore(metrics, {
      weights: { ctr: 0.5, cvr: 0.3, revenue: 0.1, orders: 0.1 },
    });

    expect(scoreDefault).not.toBeNull();
    expect(scoreCustom).not.toBeNull();
    expect(scoreDefault).not.toBeCloseTo(scoreCustom!, 2);
  });

  it('(i) date ordering: out-of-order dates are sorted, windowDays picks last N correctly', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(0), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(4), impressions: 2000, visits: 200, orders: 20, revenue: 1000 },
      { date: generateISODate(2), impressions: 1500, visits: 150, orders: 15, revenue: 750 },
      { date: generateISODate(3), impressions: 1800, visits: 180, orders: 18, revenue: 900 },
      { date: generateISODate(1), impressions: 1200, visits: 120, orders: 12, revenue: 600 },
    ];

    const scoreWindow2 = healthScore(metrics, { windowDays: 2, minDays: 2 });
    expect(scoreWindow2).not.toBeNull();

    const sortedMetrics = [...metrics].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const last2 = sortedMetrics.slice(-2);
    const scoreLast2Direct = healthScore(last2, { minDays: 2 });
    
    expect(scoreWindow2).toBeCloseTo(scoreLast2Direct!, 2);
  });

  it('edge case: single day with minDays=1 returns valid score', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(0), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
    ];

    const score = healthScore(metrics, { minDays: 1 });
    expect(score).not.toBeNull();
    expect(score).toBeCloseTo(50.00, 2);
  });

  it('edge case: invalid date strings are filtered out', () => {
    const metrics: ListingDailyMetric[] = [
      { date: 'invalid-date', impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(1), impressions: 1200, visits: 120, orders: 12, revenue: 600 },
      { date: generateISODate(0), impressions: 800, visits: 80, orders: 8, revenue: 400 },
    ];

    const score = healthScore(metrics);
    expect(score).toBeNull();
  });

  it('edge case: undefined metrics returns null', () => {
    const score = healthScore(undefined as unknown as ListingDailyMetric[]);
    expect(score).toBeNull();
  });

  it('returns integer with 2 decimal places', () => {
    const metrics: ListingDailyMetric[] = [
      { date: generateISODate(4), impressions: 1000, visits: 100, orders: 10, revenue: 500 },
      { date: generateISODate(3), impressions: 1200, visits: 150, orders: 15, revenue: 750 },
      { date: generateISODate(2), impressions: 800, visits: 80, orders: 8, revenue: 400 },
      { date: generateISODate(1), impressions: 1500, visits: 200, orders: 20, revenue: 1000 },
      { date: generateISODate(0), impressions: 1100, visits: 120, orders: 12, revenue: 600 },
    ];

    const score = healthScore(metrics);
    expect(score).not.toBeNull();
    
    const scoreStr = score!.toString();
    const decimalPart = scoreStr.split('.')[1];
    if (decimalPart) {
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    }
  });
});
