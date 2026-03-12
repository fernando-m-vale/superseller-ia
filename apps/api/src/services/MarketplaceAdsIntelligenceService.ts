import { PrismaClient, Prisma } from '@prisma/client';
import {
  AdsIntelligenceBlock,
  AdsIntelligenceStatus,
  AdsMetricsSnapshot,
  buildAdsIntelligence,
  normalizeAdsMetricsSnapshot,
} from './ads/MarketplaceAdsIntelligenceEngine';

interface ListingRecord {
  id: string;
  marketplace: string;
  listing_id_ext: string | null;
}

interface ListingAdsMetricsDailyRecord {
  date: Date;
  status: string;
  impressions: number | null;
  clicks: number | null;
  ctr: Prisma.Decimal | number | null;
  cpc: Prisma.Decimal | number | null;
  spend: Prisma.Decimal | number | null;
  orders_attributed: number | null;
  revenue_attributed: Prisma.Decimal | number | null;
  roas: Prisma.Decimal | number | null;
  conversion_rate_ads: Prisma.Decimal | number | null;
  source: string | null;
  metadata: unknown;
}

interface PrismaLike {
  listing: {
    findFirst(args: unknown): Promise<ListingRecord | null>;
  };
  listingAdsMetricsDaily: {
    upsert(args: unknown): Promise<ListingAdsMetricsDailyRecord>;
    findFirst(args: unknown): Promise<ListingAdsMetricsDailyRecord | null>;
  };
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toNullableNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export class MarketplaceAdsIntelligenceService {
  constructor(
    private readonly tenantId: string,
    private readonly prisma: PrismaLike = new PrismaClient() as unknown as PrismaLike,
  ) {}

  async syncListing(listingId: string): Promise<AdsMetricsSnapshot> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        tenant_id: this.tenantId,
      },
      select: {
        id: true,
        marketplace: true,
        listing_id_ext: true,
      },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found for tenant ${this.tenantId}`);
    }

    const snapshotDate = startOfUtcDay();
    const baseMetadata = {
      listingIdExt: listing.listing_id_ext,
      provider: listing.marketplace,
      checkedAt: new Date().toISOString(),
      audit: {
        existingAdsCaptureInCode: false,
        currentMercadoLivreAdsEndpointsIntegrated: false,
        reliableMetrics: [] as string[],
        unavailableMetrics: [
          'impressions',
          'clicks',
          'ctr',
          'cpc',
          'spend',
          'ordersAttributed',
          'revenueAttributed',
          'roas',
          'conversionRateAds',
        ],
        note:
          listing.marketplace === 'mercadolivre'
            ? 'A integração atual do Mercado Livre no projeto cobre listing, visitas, pedidos, promoções e preço, mas não expõe métricas confiáveis de Sponsored Ads.'
            : 'Marketplace sem integração de ads patrocinados nesta etapa.',
      },
    };

    const status: AdsIntelligenceStatus = 'unavailable';
    const source =
      listing.marketplace === 'mercadolivre'
        ? 'mercadolivre_ads_api_unavailable'
        : `${listing.marketplace}_ads_not_supported`;

    const persisted = await this.prisma.listingAdsMetricsDaily.upsert({
      where: {
        tenant_id_listing_id_date: {
          tenant_id: this.tenantId,
          listing_id: listing.id,
          date: snapshotDate,
        },
      },
      update: {
        status,
        impressions: null,
        clicks: null,
        ctr: null,
        cpc: null,
        spend: null,
        orders_attributed: null,
        revenue_attributed: null,
        roas: null,
        conversion_rate_ads: null,
        source,
        metadata: baseMetadata as Prisma.InputJsonValue,
      },
      create: {
        tenant_id: this.tenantId,
        listing_id: listing.id,
        date: snapshotDate,
        status,
        impressions: null,
        clicks: null,
        ctr: null,
        cpc: null,
        spend: null,
        orders_attributed: null,
        revenue_attributed: null,
        roas: null,
        conversion_rate_ads: null,
        source,
        metadata: baseMetadata as Prisma.InputJsonValue,
      },
    });

    return normalizeAdsMetricsSnapshot({
      date: persisted.date.toISOString(),
      status: persisted.status as AdsIntelligenceStatus,
      impressions: persisted.impressions,
      clicks: persisted.clicks,
      ctr: toNullableNumber(persisted.ctr),
      cpc: toNullableNumber(persisted.cpc),
      spend: toNullableNumber(persisted.spend),
      ordersAttributed: persisted.orders_attributed,
      revenueAttributed: toNullableNumber(persisted.revenue_attributed),
      roas: toNullableNumber(persisted.roas),
      conversionRateAds: toNullableNumber(persisted.conversion_rate_ads),
      source: persisted.source,
      metadata: ((persisted.metadata as Record<string, unknown> | null | undefined) ?? null),
    });
  }

  async getListingAdsIntelligence(listingId: string): Promise<AdsIntelligenceBlock> {
    const latest = await this.prisma.listingAdsMetricsDaily.findFirst({
      where: {
        tenant_id: this.tenantId,
        listing_id: listingId,
      },
      orderBy: {
        date: 'desc',
      },
    });

    const snapshot = latest
      ? normalizeAdsMetricsSnapshot({
          date: latest.date.toISOString(),
          status: latest.status as AdsIntelligenceStatus,
          impressions: latest.impressions,
          clicks: latest.clicks,
          ctr: toNullableNumber(latest.ctr),
          cpc: toNullableNumber(latest.cpc),
          spend: toNullableNumber(latest.spend),
          ordersAttributed: latest.orders_attributed,
          revenueAttributed: toNullableNumber(latest.revenue_attributed),
          roas: toNullableNumber(latest.roas),
          conversionRateAds: toNullableNumber(latest.conversion_rate_ads),
          source: latest.source,
          metadata: ((latest.metadata as Record<string, unknown> | null | undefined) ?? null),
        })
      : await this.syncListing(listingId);

    const provider =
      ((snapshot.metadata as Record<string, unknown> | null | undefined)?.provider as string | undefined) ?? 'unknown';
    const note =
      (((snapshot.metadata as Record<string, unknown> | null | undefined)?.audit as Record<string, unknown> | undefined)
        ?.note as string | undefined) ?? null;

    return buildAdsIntelligence(snapshot, {
      provider,
      integration:
        snapshot.status === 'unavailable' ? 'not_configured' : 'historical_snapshot',
      note,
    });
  }
}
