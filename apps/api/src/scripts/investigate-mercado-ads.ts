/**
 * Investigação técnica de Mercado Ads usando a conexão Mercado Livre do tenant.
 *
 * Objetivo:
 * - Resolver a conexão ML ativa do tenant
 * - Obter access_token válido (com refresh se necessário)
 * - Probar apenas endpoints oficiais de Mercado Ads
 * - Resumir status HTTP, shape do payload e métricas detectadas
 *
 * Uso:
 *   pnpm --dir apps/api investigate:mercado-ads <tenantId> [listingIdExt]
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import { getValidAccessToken } from '../utils/ml-token-helper';
import { resolveMercadoLivreConnection } from '../utils/ml-connection-resolver';

const ML_API_BASE = 'https://api.mercadolibre.com';
const DEFAULT_METRICS = [
  'clicks',
  'prints',
  'ctr',
  'cost',
  'cpc',
  'direct_items_quantity',
  'indirect_items_quantity',
  'advertising_items_quantity',
  'cvr',
  'roas',
  'direct_amount',
  'indirect_amount',
  'total_amount',
];

type ProbeResult = {
  name: string;
  method: 'GET';
  endpoint: string;
  status: number | null;
  ok: boolean;
  metricsDetected: string[];
  itemIdsDetected: string[];
  campaignIdsDetected: string[];
  advertiserIdsDetected: string[];
  sample: unknown;
  error?: {
    code?: string;
    message: string;
  };
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDateWindow() {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - 7);

  return {
    dateFrom: toIsoDate(dateFrom),
    dateTo: toIsoDate(dateTo),
  };
}

function sanitizeSample(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload.slice(0, 2).map((entry) => sanitizeSample(entry));
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  const source = payload as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (['access_token', 'refresh_token', 'token'].includes(key.toLowerCase())) {
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 2).map((entry) => sanitizeSample(entry));
      continue;
    }

    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeSample(value);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

function collectStringsByKey(payload: unknown, keys: string[]): string[] {
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

    const record = input as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (keys.includes(key) && (typeof value === 'string' || typeof value === 'number')) {
        values.add(String(value));
      }

      if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };

  visit(payload);
  return Array.from(values).slice(0, 20);
}

function detectMetrics(payload: unknown): string[] {
  const metricHints = [
    'prints',
    'impressions',
    'clicks',
    'ctr',
    'cost',
    'spend',
    'cpc',
    'cvr',
    'roas',
    'acos',
    'direct_amount',
    'indirect_amount',
    'total_amount',
    'units_quantity',
    'direct_items_quantity',
    'indirect_items_quantity',
    'advertising_items_quantity',
    'impression_share',
    'top_impression_share',
    'lost_impression_share_by_budget',
    'lost_impression_share_by_ad_rank',
    'consumed_budget',
  ];

  const found = new Set<string>();

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

    const record = input as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (metricHints.includes(key)) {
        found.add(key);
      }

      if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };

  visit(payload);
  return Array.from(found).sort();
}

async function probe(
  accessToken: string,
  name: string,
  endpoint: string,
  config: Omit<AxiosRequestConfig, 'url' | 'method'> = {},
): Promise<ProbeResult> {
  try {
    const response: AxiosResponse = await axios.get(`${ML_API_BASE}${endpoint}`, {
      ...config,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Api-Version': '1',
        ...(config.headers ?? {}),
      },
    });

    return {
      name,
      method: 'GET',
      endpoint,
      status: response.status,
      ok: true,
      metricsDetected: detectMetrics(response.data),
      itemIdsDetected: collectStringsByKey(response.data, ['item_id', 'itemId', 'listing_id', 'listingId']),
      campaignIdsDetected: collectStringsByKey(response.data, ['campaign_id', 'campaignId', 'id']),
      advertiserIdsDetected: collectStringsByKey(response.data, ['advertiser_id', 'advertiserId']),
      sample: sanitizeSample(response.data),
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status ?? null;
    const payload = axiosError.response?.data;

    return {
      name,
      method: 'GET',
      endpoint,
      status,
      ok: false,
      metricsDetected: detectMetrics(payload),
      itemIdsDetected: collectStringsByKey(payload, ['item_id', 'itemId', 'listing_id', 'listingId']),
      campaignIdsDetected: collectStringsByKey(payload, ['campaign_id', 'campaignId', 'id']),
      advertiserIdsDetected: collectStringsByKey(payload, ['advertiser_id', 'advertiserId']),
      sample: sanitizeSample(payload),
      error: {
        code: axiosError.code,
        message: axiosError.message,
      },
    };
  }
}

async function main() {
  const tenantId = process.argv[2];
  const listingIdExt = process.argv[3] ?? null;

  if (!tenantId) {
    console.error('Uso: pnpm --dir apps/api investigate:mercado-ads <tenantId> [listingIdExt]');
    process.exit(1);
  }

  const dateWindow = buildDateWindow();

  console.log('[MERCADO-ADS-PROBE] Iniciando investigação oficial de Mercado Ads');
  console.log(`[MERCADO-ADS-PROBE] tenantId=${tenantId}`);
  if (listingIdExt) {
    console.log(`[MERCADO-ADS-PROBE] listingIdExt=${listingIdExt}`);
  }

  const resolved = await resolveMercadoLivreConnection(tenantId);
  const tokenResult = await getValidAccessToken(resolved.connection.id);
  const meProbe = await probe(tokenResult.token, 'users/me', '/users/me');

  const meData = meProbe.ok && meProbe.sample && typeof meProbe.sample === 'object'
    ? (meProbe.sample as Record<string, unknown>)
    : null;
  const siteId = typeof meData?.site_id === 'string' ? meData.site_id : null;

  const padsAdvertisers = await probe(
    tokenResult.token,
    'advertising advertisers PADS',
    '/advertising/advertisers',
    { params: { product_id: 'PADS' } },
  );
  const badsAdvertisers = await probe(
    tokenResult.token,
    'advertising advertisers BADS',
    '/advertising/advertisers',
    { params: { product_id: 'BADS' } },
  );

  const probes: ProbeResult[] = [meProbe, padsAdvertisers, badsAdvertisers];

  const padsAdvertiserId = padsAdvertisers.advertiserIdsDetected[0] ?? null;
  if (siteId && padsAdvertiserId) {
    probes.push(
      await probe(
        tokenResult.token,
        'product ads campaigns search',
        `/advertising/${siteId}/advertisers/${padsAdvertiserId}/product_ads/campaigns/search`,
        {
          params: {
            limit: 5,
            offset: 0,
            date_from: dateWindow.dateFrom,
            date_to: dateWindow.dateTo,
            metrics: DEFAULT_METRICS.join(','),
          },
        },
      ),
    );

    probes.push(
      await probe(
        tokenResult.token,
        'product ads ads search',
        `/advertising/${siteId}/advertisers/${padsAdvertiserId}/product_ads/ads/search`,
        {
          params: {
            limit: 5,
            offset: 0,
            date_from: dateWindow.dateFrom,
            date_to: dateWindow.dateTo,
            metrics: DEFAULT_METRICS.join(','),
          },
        },
      ),
    );

    if (listingIdExt) {
      probes.push(
        await probe(
          tokenResult.token,
          'product ads item detail',
          `/advertising/${siteId}/product_ads/items/${listingIdExt}`,
          {
            params: {
              date_from: dateWindow.dateFrom,
              date_to: dateWindow.dateTo,
              metrics: DEFAULT_METRICS.join(','),
            },
          },
        ),
      );
    }
  }

  const badsAdvertiserId = badsAdvertisers.advertiserIdsDetected[0] ?? null;
  if (badsAdvertiserId) {
    probes.push(
      await probe(
        tokenResult.token,
        'brand ads campaigns',
        `/advertising/advertisers/${badsAdvertiserId}/brand_ads/campaigns`,
        {
          params: {
            limit: 5,
            offset: 0,
          },
        },
      ),
    );

    probes.push(
      await probe(
        tokenResult.token,
        'brand ads campaigns metrics',
        `/advertising/advertisers/${badsAdvertiserId}/brand_ads/campaigns/metrics`,
        {
          params: {
            date_from: dateWindow.dateFrom,
            date_to: dateWindow.dateTo,
            aggregation_type: 'daily',
          },
        },
      ),
    );
  }

  const summary = {
    tenantId,
    listingIdExt,
    connection: {
      connectionId: resolved.connection.id,
      providerAccountId: resolved.connection.provider_account_id,
      reason: resolved.reason,
      tokenUsedRefresh: tokenResult.usedRefresh,
      tokenExpiresAt: tokenResult.expiresAt.toISOString(),
    },
    probes,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Erro desconhecido';
  console.error(`[MERCADO-ADS-PROBE] Falha fatal: ${message}`);
  process.exit(1);
});
