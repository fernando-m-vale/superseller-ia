import axios, { type AxiosRequestConfig } from 'axios';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  AdsIntelligenceBlock,
  AdsIntelligenceStatus,
  AdsMetricsSnapshot,
  buildAdsIntelligence,
  normalizeAdsMetricsSnapshot,
} from './ads/MarketplaceAdsIntelligenceEngine';
import {
  PRODUCT_ADS_REQUESTED_METRICS,
  mapProductAdsMetricsToAdsSnapshot,
  pickProductAdsCandidate,
} from './ads/mercadoAdsProductMetrics';

const ML_API_BASE = 'https://api.mercadolibre.com';
const PRODUCT_ADS_WINDOW_DAYS = 30;
const PRODUCT_ADS_PAGE_SIZE = 50;
const PRODUCT_ADS_MAX_PAGES = 3;

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
  updated_at?: Date;
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

interface ResolvedMercadoLivreConnection {
  connection: {
    id: string;
    provider_account_id: string;
  };
  reason: string;
}

interface ValidTokenResponse {
  token: string;
  usedRefresh: boolean;
  expiresAt: Date;
}

interface HttpClientLike {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ status: number; data: T }>;
}

interface MarketplaceAdsIntelligenceDeps {
  httpClient?: HttpClientLike;
  resolveConnection?: (tenantId: string) => Promise<ResolvedMercadoLivreConnection>;
  getValidAccessToken?: (connectionId: string) => Promise<ValidTokenResponse>;
}

interface ProductAdsContext {
  accessToken: string;
  advertiserId: string;
  siteId: string;
  connectionId: string;
  providerAccountId: string;
  connectionReason: string;
  tokenUsedRefresh: boolean;
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toNullableNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function getWindowRange(days: number): { dateFrom: string; dateTo: string } {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - (days - 1));

  return {
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
  };
}

function sanitizePayloadSample(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload.slice(0, 2).map((entry) => sanitizePayloadSample(entry));
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (key.toLowerCase().includes('token')) {
      continue;
    }

    sanitized[key] = Array.isArray(value)
      ? value.slice(0, 2).map((entry) => sanitizePayloadSample(entry))
      : value && typeof value === 'object'
        ? sanitizePayloadSample(value)
        : value;
  }

  return sanitized;
}

function collectValuesByKeys(payload: unknown, keys: string[]): string[] {
  const values = new Set<string>();

  const visit = (input: unknown) => {
    if (input === null || input === undefined) {
      return;
    }

    if (Array.isArray(input)) {
      for (const entry of input) {
        visit(entry);
      }
      return;
    }

    if (typeof input !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (keys.includes(key) && (typeof value === 'string' || typeof value === 'number')) {
        values.add(String(value));
      }

      if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };

  visit(payload);
  return Array.from(values);
}

function buildUnavailableSnapshot(
  listing: ListingRecord,
  source: string,
  note: string,
  metadataExtras?: Record<string, unknown>,
): AdsMetricsSnapshot {
  return normalizeAdsMetricsSnapshot({
    date: startOfUtcDay().toISOString(),
    status: 'unavailable',
    source,
    metadata: {
      listingIdExt: listing.listing_id_ext,
      provider: listing.marketplace,
      checkedAt: new Date().toISOString(),
      audit: {
        existingAdsCaptureInCode: true,
        currentMercadoLivreAdsEndpointsIntegrated: listing.marketplace === 'mercadolivre',
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
        note,
      },
      ...metadataExtras,
    },
  });
}

export class MarketplaceAdsIntelligenceService {
  private readonly httpClient: HttpClientLike;
  private readonly resolveConnection: NonNullable<MarketplaceAdsIntelligenceDeps['resolveConnection']>;
  private readonly getValidAccessToken: NonNullable<MarketplaceAdsIntelligenceDeps['getValidAccessToken']>;

  constructor(
    private readonly tenantId: string,
    private readonly prisma: PrismaLike = new PrismaClient() as unknown as PrismaLike,
    deps: MarketplaceAdsIntelligenceDeps = {},
  ) {
    this.httpClient = deps.httpClient ?? axios;
    this.resolveConnection =
      deps.resolveConnection ??
      (async (tenantId: string) => {
        const { resolveMercadoLivreConnection } = await import('../utils/ml-connection-resolver');
        return resolveMercadoLivreConnection(tenantId);
      });
    this.getValidAccessToken =
      deps.getValidAccessToken ??
      (async (connectionId: string) => {
        const { getValidAccessToken } = await import('../utils/ml-token-helper');
        return getValidAccessToken(connectionId);
      });
  }

  private async getMercadoLivreProductAdsContext(): Promise<ProductAdsContext> {
    const resolved = await this.resolveConnection(this.tenantId);
    const tokenResult = await this.getValidAccessToken(resolved.connection.id);

    const meResponse = await this.httpClient.get<{ id: number; site_id: string }>(`${ML_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${tokenResult.token}` },
    });

    const advertisersResponse = await this.httpClient.get(`${ML_API_BASE}/advertising/advertisers`, {
      headers: { Authorization: `Bearer ${tokenResult.token}` },
      params: { product_id: 'PADS' },
    });
    const advertiserIds = collectValuesByKeys(advertisersResponse.data, ['advertiser_id', 'advertiserId', 'id']);
    const advertiserId = advertiserIds[0];

    if (!advertiserId) {
      throw new Error('Nenhum advertiser_id de Product Ads foi retornado para a conexão atual.');
    }

    return {
      accessToken: tokenResult.token,
      advertiserId,
      siteId: meResponse.data.site_id,
      connectionId: resolved.connection.id,
      providerAccountId: resolved.connection.provider_account_id,
      connectionReason: resolved.reason,
      tokenUsedRefresh: tokenResult.usedRefresh,
    };
  }

  private async fetchProductAdsSearchPayload(
    context: ProductAdsContext,
    page: number,
  ): Promise<{ status: number; data: unknown }> {
    const window = getWindowRange(PRODUCT_ADS_WINDOW_DAYS);
    return this.httpClient.get(
      `${ML_API_BASE}/advertising/${context.siteId}/advertisers/${context.advertiserId}/product_ads/ads/search`,
      {
        headers: { Authorization: `Bearer ${context.accessToken}` },
        params: {
          limit: PRODUCT_ADS_PAGE_SIZE,
          offset: page * PRODUCT_ADS_PAGE_SIZE,
          date_from: window.dateFrom,
          date_to: window.dateTo,
          metrics: PRODUCT_ADS_REQUESTED_METRICS.join(','),
        },
      },
    );
  }

  private async fetchProductAdsItemPayload(
    context: ProductAdsContext,
    listingIdExt: string,
  ): Promise<{ status: number; data: unknown }> {
    const window = getWindowRange(PRODUCT_ADS_WINDOW_DAYS);
    return this.httpClient.get(
      `${ML_API_BASE}/advertising/${context.siteId}/product_ads/items/${listingIdExt}`,
      {
        headers: { Authorization: `Bearer ${context.accessToken}` },
        params: {
          date_from: window.dateFrom,
          date_to: window.dateTo,
          metrics: PRODUCT_ADS_REQUESTED_METRICS.join(','),
        },
      },
    );
  }

  private async fetchMercadoLivreProductAdsSnapshot(listing: ListingRecord): Promise<AdsMetricsSnapshot> {
    const context = await this.getMercadoLivreProductAdsContext();
    const searchAttempts: Array<Record<string, unknown>> = [];
    let bestSearchCandidate: ReturnType<typeof pickProductAdsCandidate> = null;

    for (let page = 0; page < PRODUCT_ADS_MAX_PAGES; page += 1) {
      const response = await this.fetchProductAdsSearchPayload(context, page);
      const candidate = pickProductAdsCandidate(response.data, listing.listing_id_ext!);
      searchAttempts.push({
        endpoint: 'ads_search',
        page,
        status: response.status,
        matchedItemId: candidate?.itemId ?? null,
        metricsCount: candidate?.metricsCount ?? 0,
        payloadSample: sanitizePayloadSample(response.data),
      });

      if (candidate && (!bestSearchCandidate || candidate.metricsCount > bestSearchCandidate.metricsCount)) {
        bestSearchCandidate = candidate;
      }

      if (candidate?.itemId?.toUpperCase() === listing.listing_id_ext?.toUpperCase()) {
        break;
      }
    }

    const itemResponse = await this.fetchProductAdsItemPayload(context, listing.listing_id_ext!);
    const itemCandidate = pickProductAdsCandidate(itemResponse.data, listing.listing_id_ext!);

    const bestCandidate = [bestSearchCandidate, itemCandidate]
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((left, right) => right.metricsCount - left.metricsCount)[0] ?? null;

    const metadataBase = {
      listingIdExt: listing.listing_id_ext,
      provider: 'mercadolivre',
      checkedAt: new Date().toISOString(),
      advertiserId: context.advertiserId,
      siteId: context.siteId,
      product: 'PADS',
      windowDays: PRODUCT_ADS_WINDOW_DAYS,
      metricsRequested: [...PRODUCT_ADS_REQUESTED_METRICS],
      connectionId: context.connectionId,
      providerAccountId: context.providerAccountId,
      tokenUsedRefresh: context.tokenUsedRefresh,
      connectionReason: context.connectionReason,
      probes: {
        adsSearch: searchAttempts,
        item: {
          endpoint: 'item_detail',
          status: itemResponse.status,
          metricsCount: itemCandidate?.metricsCount ?? 0,
          payloadSample: sanitizePayloadSample(itemResponse.data),
        },
      },
    };

    if (!bestCandidate) {
      return buildUnavailableSnapshot(
        listing,
        'mercadolivre_product_ads_no_matching_item',
        'A API de Product Ads respondeu, mas nenhum ad/item correspondente ao listing foi encontrado nas leituras consultadas.',
        metadataBase,
      );
    }

    if (bestCandidate.metricsCount === 0) {
      return normalizeAdsMetricsSnapshot({
        date: startOfUtcDay().toISOString(),
        status: 'partial',
        source: 'mercadolivre_product_ads_metrics_empty',
        metadata: {
          ...metadataBase,
          matchedItemId: bestCandidate.itemId,
          campaignId: bestCandidate.campaignId,
          adId: bestCandidate.adId,
          audit: {
            existingAdsCaptureInCode: true,
            currentMercadoLivreAdsEndpointsIntegrated: true,
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
              'Product Ads está acessível e o item foi encontrado, mas o campo metrics veio vazio nas leituras consultadas para esta janela.',
          },
        },
      });
    }

    const mapped = mapProductAdsMetricsToAdsSnapshot(bestCandidate);

    return normalizeAdsMetricsSnapshot({
      date: startOfUtcDay().toISOString(),
      status: 'available',
      impressions: mapped.impressions,
      clicks: mapped.clicks,
      ctr: mapped.ctr,
      cpc: mapped.cpc,
      spend: mapped.spend,
      ordersAttributed: mapped.ordersAttributed,
      revenueAttributed: mapped.revenueAttributed,
      roas: mapped.roas,
      conversionRateAds: mapped.conversionRateAds,
      source:
        itemCandidate && itemCandidate.metricsCount >= (bestSearchCandidate?.metricsCount ?? 0)
          ? 'mercadolivre_product_ads_item_detail'
          : 'mercadolivre_product_ads_ads_search',
      metadata: {
        ...metadataBase,
        matchedItemId: bestCandidate.itemId,
        campaignId: bestCandidate.campaignId,
        adId: bestCandidate.adId,
        revenueSource: mapped.revenueSource,
        ordersSource: mapped.ordersSource,
        rawMetrics: bestCandidate.metrics,
        audit: {
          existingAdsCaptureInCode: true,
          currentMercadoLivreAdsEndpointsIntegrated: true,
          reliableMetrics: Object.entries(mapped)
            .filter(([key, value]) => !key.endsWith('Source') && value !== null)
            .map(([key]) => key),
          unavailableMetrics: Object.entries(mapped)
            .filter(([key, value]) => !key.endsWith('Source') && value === null)
            .map(([key]) => key),
          note:
            'Snapshot de Product Ads persistido com granularidade de janela móvel. revenue_attributed prioriza direct_amount e faz fallback para total_amount quando direct_amount não vem preenchido.',
        },
      },
    });
  }

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
    let snapshot: AdsMetricsSnapshot;

    if (listing.marketplace !== 'mercadolivre' || !listing.listing_id_ext) {
      snapshot = buildUnavailableSnapshot(
        listing,
        `${listing.marketplace}_ads_not_supported`,
        listing.marketplace === 'mercadolivre'
          ? 'Listing sem listing_id_ext; não foi possível vincular Product Ads ao anúncio local.'
          : 'Marketplace sem integração de ads patrocinados nesta etapa.',
      );
    } else {
      try {
        snapshot = await this.fetchMercadoLivreProductAdsSnapshot(listing);
      } catch (error) {
        snapshot = buildUnavailableSnapshot(
          listing,
          'mercadolivre_product_ads_error',
          error instanceof Error
            ? `Falha ao consultar Product Ads: ${error.message}`
            : 'Falha desconhecida ao consultar Product Ads.',
          {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          },
        );
      }
    }

    const persisted = await this.prisma.listingAdsMetricsDaily.upsert({
      where: {
        tenant_id_listing_id_date: {
          tenant_id: this.tenantId,
          listing_id: listing.id,
          date: snapshotDate,
        },
      },
      update: {
        status: snapshot.status,
        impressions: snapshot.impressions,
        clicks: snapshot.clicks,
        ctr: snapshot.ctr,
        cpc: snapshot.cpc,
        spend: snapshot.spend,
        orders_attributed: snapshot.ordersAttributed,
        revenue_attributed: snapshot.revenueAttributed,
        roas: snapshot.roas,
        conversion_rate_ads: snapshot.conversionRateAds,
        source: snapshot.source,
        metadata: (snapshot.metadata ?? null) as Prisma.InputJsonValue,
      },
      create: {
        tenant_id: this.tenantId,
        listing_id: listing.id,
        date: snapshotDate,
        status: snapshot.status,
        impressions: snapshot.impressions,
        clicks: snapshot.clicks,
        ctr: snapshot.ctr,
        cpc: snapshot.cpc,
        spend: snapshot.spend,
        orders_attributed: snapshot.ordersAttributed,
        revenue_attributed: snapshot.revenueAttributed,
        roas: snapshot.roas,
        conversion_rate_ads: snapshot.conversionRateAds,
        source: snapshot.source,
        metadata: (snapshot.metadata ?? null) as Prisma.InputJsonValue,
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

    const shouldRefresh =
      !latest ||
      startOfUtcDay(latest.date).getTime() !== startOfUtcDay().getTime() ||
      latest.status === 'unavailable';

    const snapshot = !shouldRefresh && latest
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
        ?.note as string | undefined) ??
      (((snapshot.metadata as Record<string, unknown> | null | undefined)?.note as string | undefined) ?? null);

    return buildAdsIntelligence(snapshot, {
      provider,
      integration:
        provider === 'mercadolivre'
          ? 'mercado_ads_product_ads'
          : snapshot.status === 'unavailable'
            ? 'not_configured'
            : 'historical_snapshot',
      note,
    });
  }
}
