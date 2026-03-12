import type { FastifyBaseLogger } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { MarketplaceAdsIntelligenceService } from '../MarketplaceAdsIntelligenceService';

const prisma = new PrismaClient();

export async function attachAdsIntelligenceToPayload(
  responseData: Record<string, unknown>,
  tenantId: string,
  listingId: string,
  requestLog?: FastifyBaseLogger,
): Promise<void> {
  try {
    const adsService = new MarketplaceAdsIntelligenceService(tenantId, prisma);
    responseData.adsIntelligence = await adsService.getListingAdsIntelligence(listingId);
  } catch (error) {
    requestLog?.warn(
      {
        tenantId,
        listingId,
        err: error,
      },
      'Ads Intelligence unavailable, returning controlled fallback',
    );
    responseData.adsIntelligence = {
      status: 'unavailable',
      adsScore: null,
      summary: 'Dados confiáveis de anúncios patrocinados não estão disponíveis no momento.',
      diagnosis: 'ads_data_unavailable',
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
      recommendations: [
        'Valide no painel do marketplace se a campanha está gerando cliques, pedidos e ROAS antes de aumentar verba.',
      ],
      opportunities: [],
      analyzedAt: new Date().toISOString(),
      source: {
        provider: 'unknown',
        integration: 'not_configured',
        mode: 'historical_snapshot',
        snapshotDate: null,
        metricsAvailable: [],
        metricsUnavailable: ['impressions', 'clicks', 'ctr', 'cpc', 'spend', 'ordersAttributed', 'revenueAttributed', 'roas', 'conversionRateAds'],
        note: 'Falha ao montar Ads Intelligence com segurança.',
      },
    };
  }
}
