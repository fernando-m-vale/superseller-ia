import { describe, it, expect, vi, beforeEach } from 'vitest';

const getListingAdsIntelligence = vi.fn();

vi.mock('../services/MarketplaceAdsIntelligenceService', () => ({
  MarketplaceAdsIntelligenceService: vi.fn().mockImplementation(() => ({
    getListingAdsIntelligence,
  })),
}));

describe('attachAdsIntelligenceToPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects adsIntelligence into the analyze payload', async () => {
    const payload: Record<string, unknown> = { listingId: 'listing-1' };
    getListingAdsIntelligence.mockResolvedValue({
      status: 'partial',
      adsScore: 62,
      summary: 'Leitura parcial',
      diagnosis: 'ads_partial_data',
      metrics: {
        impressions: null,
        clicks: null,
        ctr: null,
        cpc: null,
        spend: null,
        ordersAttributed: null,
        revenueAttributed: null,
        roas: null,
        conversionRateAds: null,
      },
      signals: {
        hasTrafficFromAds: false,
        hasClicksFromAds: false,
        hasAttributedSales: false,
        adsEfficiencyLevel: 'unknown',
        adsConversionHealth: 'unknown',
        adsProfitabilitySignal: 'unknown',
      },
      recommendations: [],
      opportunities: [],
      analyzedAt: '2026-03-12T10:00:00.000Z',
      source: {
        provider: 'mercadolivre',
        integration: 'not_configured',
        mode: 'historical_snapshot',
        snapshotDate: '2026-03-12T00:00:00.000Z',
        metricsAvailable: [],
        metricsUnavailable: ['impressions'],
        note: null,
      },
    });

    const { attachAdsIntelligenceToPayload } = await import('../services/ads/attachAdsIntelligence');
    await attachAdsIntelligenceToPayload(payload, 'tenant-1', 'listing-1');

    expect(getListingAdsIntelligence).toHaveBeenCalledWith('listing-1');
    expect(payload.adsIntelligence).toBeTruthy();
    expect((payload.adsIntelligence as { adsScore: number }).adsScore).toBe(62);
  });
});
