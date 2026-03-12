import { describe, it, expect, vi } from 'vitest';
import { MarketplaceAdsIntelligenceService } from '../services/MarketplaceAdsIntelligenceService';

describe('MarketplaceAdsIntelligenceService', () => {
  it('persists a controlled unavailable snapshot when no ads source exists', async () => {
    const upsert = vi.fn().mockResolvedValue({
      date: new Date('2026-03-12T00:00:00.000Z'),
      status: 'unavailable',
      impressions: null,
      clicks: null,
      ctr: null,
      cpc: null,
      spend: null,
      orders_attributed: null,
      revenue_attributed: null,
      roas: null,
      conversion_rate_ads: null,
      source: 'mercadolivre_ads_api_unavailable',
      metadata: {
        provider: 'mercadolivre',
        audit: {
          note: 'A integração atual do Mercado Livre no projeto cobre listing, visitas, pedidos, promoções e preço, mas não expõe métricas confiáveis de Sponsored Ads.',
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

    const service = new MarketplaceAdsIntelligenceService('tenant-1', prismaMock);
    const intelligence = await service.getListingAdsIntelligence('listing-1');

    expect(upsert).toHaveBeenCalled();
    expect(intelligence.status).toBe('unavailable');
    expect(intelligence.source.provider).toBe('mercadolivre');
    expect(intelligence.source.integration).toBe('not_configured');
  });
});
