import { describe, it, expect } from 'vitest';
import {
  buildAdsIntelligence,
  normalizeAdsMetricsSnapshot,
} from '../services/ads/MarketplaceAdsIntelligenceEngine';

describe('MarketplaceAdsIntelligenceEngine', () => {
  it('normalizes derived ratios without inventing missing values', () => {
    const snapshot = normalizeAdsMetricsSnapshot({
      status: 'partial',
      impressions: 1000,
      clicks: 20,
      spend: 40,
      ordersAttributed: 2,
      revenueAttributed: 160,
    });

    expect(snapshot.ctr).toBe(0.02);
    expect(snapshot.cpc).toBe(2);
    expect(snapshot.conversionRateAds).toBe(0.1);
    expect(snapshot.roas).toBe(4);
  });

  it('flags traffic without conversion', () => {
    const intelligence = buildAdsIntelligence(
      normalizeAdsMetricsSnapshot({
        status: 'available',
        impressions: 5000,
        clicks: 80,
        spend: 180,
        ordersAttributed: 0,
        revenueAttributed: 0,
      }),
      { provider: 'mercadolivre', integration: 'future_feed' },
    );

    expect(intelligence.diagnosis).toBe('ads_traffic_without_conversion');
    expect(intelligence.signals.hasTrafficFromAds).toBe(true);
    expect(intelligence.signals.hasAttributedSales).toBe(false);
    expect(intelligence.recommendations.some((item) => item.includes('convers'))).toBe(true);
  });

  it('flags high spend with weak return', () => {
    const intelligence = buildAdsIntelligence(
      normalizeAdsMetricsSnapshot({
        status: 'available',
        impressions: 3000,
        clicks: 45,
        spend: 220,
        ordersAttributed: 1,
        revenueAttributed: 120,
      }),
      { provider: 'mercadolivre', integration: 'future_feed' },
    );

    expect(intelligence.diagnosis).toBe('ads_spend_without_return');
    expect(intelligence.metrics.roas).toBeCloseTo(0.5455, 4);
    expect(intelligence.adsScore).toBeLessThan(50);
  });

  it('recognizes a healthy campaign', () => {
    const intelligence = buildAdsIntelligence(
      normalizeAdsMetricsSnapshot({
        status: 'available',
        impressions: 6000,
        clicks: 120,
        spend: 150,
        ordersAttributed: 6,
        revenueAttributed: 720,
      }),
      { provider: 'mercadolivre', integration: 'future_feed' },
    );

    expect(intelligence.diagnosis).toBe('ads_healthy');
    expect(intelligence.signals.adsProfitabilitySignal).toBe('positive');
    expect(intelligence.adsScore).toBeGreaterThanOrEqual(80);
  });

  it('returns controlled unavailable state when data is absent', () => {
    const intelligence = buildAdsIntelligence(
      normalizeAdsMetricsSnapshot({
        status: 'unavailable',
      }),
      { provider: 'mercadolivre', integration: 'not_configured' },
    );

    expect(intelligence.status).toBe('unavailable');
    expect(intelligence.adsScore).toBeNull();
    expect(intelligence.diagnosis).toBe('ads_data_unavailable');
    expect(intelligence.metrics.clicks).toBeNull();
  });
});
