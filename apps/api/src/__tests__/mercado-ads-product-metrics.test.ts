import { describe, expect, it } from 'vitest';

import {
  extractProductAdsCandidates,
  mapProductAdsMetricsToAdsSnapshot,
  pickProductAdsCandidate,
} from '../services/ads/mercadoAdsProductMetrics';

describe('mercadoAdsProductMetrics', () => {
  it('extracts Product Ads metrics from ads search payload', () => {
    const payload = {
      results: [
        {
          ad_id: 991,
          item_id: 'MLB123',
          campaign_id: 77,
          metrics: {
            prints: 1200,
            clicks: 36,
            ctr: 0.03,
            cost: 54.9,
            cpc: 1.525,
            cvr: 0.08,
            roas: 4.2,
            direct_amount: 230.4,
            direct_items_quantity: 3,
          },
        },
      ],
    };

    const candidate = pickProductAdsCandidate(payload, 'MLB123');
    expect(candidate).not.toBeNull();
    expect(candidate?.itemId).toBe('MLB123');
    expect(candidate?.metricsCount).toBeGreaterThan(0);

    const mapped = mapProductAdsMetricsToAdsSnapshot(candidate!);
    expect(mapped.impressions).toBe(1200);
    expect(mapped.spend).toBe(54.9);
    expect(mapped.ordersAttributed).toBe(3);
    expect(mapped.revenueAttributed).toBe(230.4);
    expect(mapped.conversionRateAds).toBe(0.08);
  });

  it('falls back to total_amount and units_quantity when direct metrics are absent', () => {
    const payload = {
      item_id: 'MLB999',
      metrics: {
        prints: 800,
        clicks: 20,
        cost: 40,
        total_amount: 125,
        units_quantity: 2,
      },
    };

    const candidate = pickProductAdsCandidate(payload, 'MLB999');
    const mapped = mapProductAdsMetricsToAdsSnapshot(candidate!);

    expect(mapped.revenueAttributed).toBe(125);
    expect(mapped.revenueSource).toBe('total_amount');
    expect(mapped.ordersAttributed).toBe(2);
    expect(mapped.ordersSource).toBe('units_quantity');
  });

  it('returns candidates even when metrics are empty so the service can mark partial state', () => {
    const payload = {
      results: [
        {
          ad_id: 11,
          item_id: 'MLBEMPTY',
          campaign_id: 22,
          metrics: {},
        },
      ],
    };

    const candidates = extractProductAdsCandidates(payload);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].itemId).toBe('MLBEMPTY');
    expect(candidates[0].metricsCount).toBe(0);
  });
});
