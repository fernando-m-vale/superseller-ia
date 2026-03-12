export const PRODUCT_ADS_REQUESTED_METRICS = [
  'clicks',
  'prints',
  'ctr',
  'cost',
  'cpc',
  'cvr',
  'roas',
  'direct_amount',
  'total_amount',
  'direct_items_quantity',
  'advertising_items_quantity',
  'units_quantity',
] as const;

export interface ProductAdsMetrics {
  prints: number | null;
  clicks: number | null;
  ctr: number | null;
  cost: number | null;
  cpc: number | null;
  cvr: number | null;
  roas: number | null;
  direct_amount: number | null;
  total_amount: number | null;
  direct_items_quantity: number | null;
  advertising_items_quantity: number | null;
  units_quantity: number | null;
}

export interface ProductAdsCandidate {
  itemId: string | null;
  campaignId: string | null;
  adId: string | null;
  metrics: ProductAdsMetrics;
  metricsCount: number;
  raw: Record<string, unknown>;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function buildMetrics(metricsSource: Record<string, unknown>): ProductAdsMetrics {
  return {
    prints: toNumberOrNull(metricsSource.prints ?? metricsSource.impressions),
    clicks: toNumberOrNull(metricsSource.clicks),
    ctr: toNumberOrNull(metricsSource.ctr),
    cost: toNumberOrNull(metricsSource.cost ?? metricsSource.spend),
    cpc: toNumberOrNull(metricsSource.cpc),
    cvr: toNumberOrNull(metricsSource.cvr ?? metricsSource.conversion_rate),
    roas: toNumberOrNull(metricsSource.roas),
    direct_amount: toNumberOrNull(metricsSource.direct_amount),
    total_amount: toNumberOrNull(metricsSource.total_amount),
    direct_items_quantity: toNumberOrNull(metricsSource.direct_items_quantity),
    advertising_items_quantity: toNumberOrNull(metricsSource.advertising_items_quantity),
    units_quantity: toNumberOrNull(metricsSource.units_quantity),
  };
}

function countMetrics(metrics: ProductAdsMetrics): number {
  return Object.values(metrics).filter((value) => value !== null).length;
}

function buildCandidate(record: Record<string, unknown>): ProductAdsCandidate | null {
  const metricsSource =
    (record.metrics as Record<string, unknown> | undefined) ??
    (record.performance as Record<string, unknown> | undefined)?.metrics as Record<string, unknown> | undefined ??
    (record.statistics as Record<string, unknown> | undefined)?.metrics as Record<string, unknown> | undefined ??
    record;

  const metrics = buildMetrics(metricsSource);
  const itemId =
    toStringOrNull(record.item_id) ??
    toStringOrNull(record.itemId) ??
    toStringOrNull((record.item as Record<string, unknown> | undefined)?.id);
  const campaignId =
    toStringOrNull(record.campaign_id) ??
    toStringOrNull(record.campaignId) ??
    toStringOrNull((record.campaign as Record<string, unknown> | undefined)?.id);
  const adId =
    toStringOrNull(record.ad_id) ??
    toStringOrNull(record.adId) ??
    toStringOrNull(record.id);
  const metricsCount = countMetrics(metrics);

  if (!itemId && !campaignId && !adId && metricsCount === 0) {
    return null;
  }

  return {
    itemId,
    campaignId,
    adId,
    metrics,
    metricsCount,
    raw: record,
  };
}

function walkPayload(input: unknown, results: ProductAdsCandidate[]): void {
  if (input === null || input === undefined) {
    return;
  }

  if (Array.isArray(input)) {
    for (const entry of input) {
      walkPayload(entry, results);
    }
    return;
  }

  if (typeof input !== 'object') {
    return;
  }

  const record = input as Record<string, unknown>;
  const candidate = buildCandidate(record);
  if (candidate) {
    results.push(candidate);
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      walkPayload(value, results);
    }
  }
}

export function extractProductAdsCandidates(payload: unknown): ProductAdsCandidate[] {
  const candidates: ProductAdsCandidate[] = [];
  walkPayload(payload, candidates);

  const deduped = new Map<string, ProductAdsCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.itemId ?? 'no-item'}|${candidate.campaignId ?? 'no-campaign'}|${candidate.adId ?? 'no-ad'}`;
    const current = deduped.get(key);
    if (!current || candidate.metricsCount > current.metricsCount) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values());
}

export function pickProductAdsCandidate(
  payload: unknown,
  listingIdExt: string,
): ProductAdsCandidate | null {
  const candidates = extractProductAdsCandidates(payload);
  if (candidates.length === 0) {
    return null;
  }

  const normalizedListingId = listingIdExt.trim().toUpperCase();

  const sorted = [...candidates].sort((left, right) => {
    const leftMatch = left.itemId?.toUpperCase() === normalizedListingId ? 1 : 0;
    const rightMatch = right.itemId?.toUpperCase() === normalizedListingId ? 1 : 0;

    if (leftMatch !== rightMatch) {
      return rightMatch - leftMatch;
    }

    if (left.metricsCount !== right.metricsCount) {
      return right.metricsCount - left.metricsCount;
    }

    return 0;
  });

  const best = sorted[0];
  if (best.itemId?.toUpperCase() === normalizedListingId) {
    return best;
  }

  return best.metricsCount > 0 ? best : null;
}

export function mapProductAdsMetricsToAdsSnapshot(candidate: ProductAdsCandidate): {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  spend: number | null;
  ordersAttributed: number | null;
  revenueAttributed: number | null;
  roas: number | null;
  conversionRateAds: number | null;
  revenueSource: 'direct_amount' | 'total_amount' | null;
  ordersSource: 'direct_items_quantity' | 'advertising_items_quantity' | 'units_quantity' | null;
} {
  const revenueAttributed =
    candidate.metrics.direct_amount ??
    candidate.metrics.total_amount ??
    null;
  const revenueSource =
    candidate.metrics.direct_amount !== null
      ? 'direct_amount'
      : candidate.metrics.total_amount !== null
        ? 'total_amount'
        : null;
  const ordersAttributed =
    candidate.metrics.direct_items_quantity ??
    candidate.metrics.advertising_items_quantity ??
    candidate.metrics.units_quantity ??
    null;
  const ordersSource =
    candidate.metrics.direct_items_quantity !== null
      ? 'direct_items_quantity'
      : candidate.metrics.advertising_items_quantity !== null
        ? 'advertising_items_quantity'
        : candidate.metrics.units_quantity !== null
          ? 'units_quantity'
          : null;

  return {
    impressions: candidate.metrics.prints,
    clicks: candidate.metrics.clicks,
    ctr: candidate.metrics.ctr,
    cpc: candidate.metrics.cpc,
    spend: candidate.metrics.cost,
    ordersAttributed,
    revenueAttributed,
    roas: candidate.metrics.roas,
    conversionRateAds: candidate.metrics.cvr,
    revenueSource,
    ordersSource,
  };
}
