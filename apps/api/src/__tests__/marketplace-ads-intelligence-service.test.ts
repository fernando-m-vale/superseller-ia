import { describe, it, expect, vi } from 'vitest';
import { MarketplaceAdsIntelligenceService } from '../services/MarketplaceAdsIntelligenceService';

describe('MarketplaceAdsIntelligenceService', () => {
  it('persists Product Ads metrics when Mercado Ads returns item data', async () => {
    const upsert = vi.fn().mockResolvedValue({
      date: new Date('2026-03-12T00:00:00.000Z'),
      status: 'available',
      impressions: 1200,
      clicks: 36,
      ctr: 0.03,
      cpc: 1.525,
      spend: 54.9,
      orders_attributed: 3,
      revenue_attributed: 230.4,
      roas: 4.2,
      conversion_rate_ads: 0.08,
      source: 'mercadolivre_product_ads_item_detail',
      metadata: {
        provider: 'mercadolivre',
        audit: {
          note: 'Snapshot real de Product Ads.',
        },
      },
    });

    const prismaMock = {
      listing: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'listing-1',
          marketplace: 'mercadolivre',
          listing_id_ext: 'MLB123',
        }),
      },
      listingAdsMetricsDaily: {
        upsert,
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ConstructorParameters<typeof MarketplaceAdsIntelligenceService>[1];

    const httpGet = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: { id: 123, site_id: 'MLB' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { results: [{ advertiser_id: 555 }] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          results: [
            {
              item_id: 'MLB123',
              campaign_id: 77,
              metrics: {},
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
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
      });

    const service = new MarketplaceAdsIntelligenceService(
      'tenant-1',
      prismaMock,
      {
        httpClient: { get: httpGet },
        resolveConnection: vi.fn().mockResolvedValue({
          connection: { id: 'conn-1', provider_account_id: 'seller-1' },
          reason: 'access_valid',
        }),
        getValidAccessToken: vi.fn().mockResolvedValue({
          token: 'token-1',
          usedRefresh: false,
          expiresAt: new Date('2026-03-12T12:00:00.000Z'),
        }),
      },
    );

    const intelligence = await service.getListingAdsIntelligence('listing-1');

    expect(upsert).toHaveBeenCalled();
    expect(upsert.mock.calls[0][0].create.impressions).toBe(1200);
    expect(upsert.mock.calls[0][0].create.spend).toBe(54.9);
    expect(upsert.mock.calls[0][0].create.orders_attributed).toBe(3);
    expect(intelligence.status).toBe('available');
    expect(intelligence.source.provider).toBe('mercadolivre');
    expect(intelligence.source.integration).toBe('mercado_ads_product_ads');
  });

  it('keeps a partial state when Product Ads finds the item but metrics come empty', async () => {
    const upsert = vi.fn().mockResolvedValue({
      date: new Date('2026-03-12T00:00:00.000Z'),
      status: 'partial',
      impressions: null,
      clicks: null,
      ctr: null,
      cpc: null,
      spend: null,
      orders_attributed: null,
      revenue_attributed: null,
      roas: null,
      conversion_rate_ads: null,
      source: 'mercadolivre_product_ads_metrics_empty',
      metadata: {
        provider: 'mercadolivre',
        audit: {
          note: 'Product Ads acessível, mas metrics vazio.',
        },
      },
    });

    const prismaMock = {
      listing: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'listing-1',
          marketplace: 'mercadolivre',
          listing_id_ext: 'MLB123',
        }),
      },
      listingAdsMetricsDaily: {
        upsert,
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ConstructorParameters<typeof MarketplaceAdsIntelligenceService>[1];

    const httpGet = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: { id: 123, site_id: 'MLB' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { results: [{ advertiser_id: 555 }] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          results: [
            {
              item_id: 'MLB123',
              campaign_id: 77,
              metrics: {},
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          item_id: 'MLB123',
          campaign_id: 77,
          metrics: {},
        },
      });

    const service = new MarketplaceAdsIntelligenceService(
      'tenant-1',
      prismaMock,
      {
        httpClient: { get: httpGet },
        resolveConnection: vi.fn().mockResolvedValue({
          connection: { id: 'conn-1', provider_account_id: 'seller-1' },
          reason: 'access_valid',
        }),
        getValidAccessToken: vi.fn().mockResolvedValue({
          token: 'token-1',
          usedRefresh: false,
          expiresAt: new Date('2026-03-12T12:00:00.000Z'),
        }),
      },
    );

    const intelligence = await service.getListingAdsIntelligence('listing-1');

    expect(upsert).toHaveBeenCalled();
    expect(upsert.mock.calls[0][0].create.status).toBe('partial');
    expect(upsert.mock.calls[0][0].create.source).toBe('mercadolivre_product_ads_metrics_empty');
    expect(intelligence.status).toBe('partial');
    expect(intelligence.diagnosis).toBe('ads_partial_data');
  });
});
