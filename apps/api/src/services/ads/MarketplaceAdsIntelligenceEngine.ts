export type AdsIntelligenceStatus = 'available' | 'partial' | 'unavailable';

export interface AdsMetricsSnapshot {
  date: string;
  status: AdsIntelligenceStatus;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  spend: number | null;
  ordersAttributed: number | null;
  revenueAttributed: number | null;
  roas: number | null;
  conversionRateAds: number | null;
  source: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdsDerivedSignals {
  hasTrafficFromAds: boolean;
  hasClicksFromAds: boolean;
  hasAttributedSales: boolean;
  adsEfficiencyLevel: 'strong' | 'moderate' | 'weak' | 'unknown';
  adsConversionHealth: 'strong' | 'moderate' | 'weak' | 'unknown';
  adsProfitabilitySignal: 'positive' | 'mixed' | 'negative' | 'unknown';
}

export interface AdsIntelligenceBlock {
  status: AdsIntelligenceStatus;
  adsScore: number | null;
  summary: string;
  diagnosis:
    | 'ads_data_unavailable'
    | 'ads_traffic_without_conversion'
    | 'ads_spend_without_return'
    | 'ads_low_ctr'
    | 'ads_healthy'
    | 'ads_partial_data'
    | 'ads_mixed_signal';
  metrics: Omit<AdsMetricsSnapshot, 'date' | 'status' | 'source' | 'metadata'>;
  signals: AdsDerivedSignals;
  recommendations: string[];
  opportunities: string[];
  analyzedAt: string;
  source: {
    provider: string;
    integration: string;
    mode: 'historical_snapshot';
    snapshotDate: string | null;
    metricsAvailable: string[];
    metricsUnavailable: string[];
    note: string | null;
  };
}

const METRIC_KEYS = [
  'impressions',
  'clicks',
  'ctr',
  'cpc',
  'spend',
  'ordersAttributed',
  'revenueAttributed',
  'roas',
  'conversionRateAds',
] as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundMetric(value: number | null, digits = 4): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalizeAdsMetricsSnapshot(
  snapshot: Partial<AdsMetricsSnapshot> & Pick<AdsMetricsSnapshot, 'status'>,
): AdsMetricsSnapshot {
  const impressions = snapshot.impressions ?? null;
  const clicks = snapshot.clicks ?? null;
  const spend = snapshot.spend ?? null;
  const ordersAttributed = snapshot.ordersAttributed ?? null;
  const revenueAttributed = snapshot.revenueAttributed ?? null;
  const ctr =
    snapshot.ctr ??
    (impressions !== null && impressions > 0 && clicks !== null ? clicks / impressions : null);
  const cpc =
    snapshot.cpc ??
    (spend !== null && clicks !== null && clicks > 0 ? spend / clicks : null);
  const roas =
    snapshot.roas ??
    (revenueAttributed !== null && spend !== null && spend > 0 ? revenueAttributed / spend : null);
  const conversionRateAds =
    snapshot.conversionRateAds ??
    (ordersAttributed !== null && clicks !== null && clicks > 0 ? ordersAttributed / clicks : null);

  return {
    date: snapshot.date ?? new Date().toISOString(),
    status: snapshot.status,
    impressions,
    clicks,
    ctr: roundMetric(ctr),
    cpc: roundMetric(cpc),
    spend: roundMetric(spend, 2),
    ordersAttributed,
    revenueAttributed: roundMetric(revenueAttributed, 2),
    roas: roundMetric(roas),
    conversionRateAds: roundMetric(conversionRateAds),
    source: snapshot.source ?? null,
    metadata: snapshot.metadata ?? null,
  };
}

function getAvailableMetrics(metrics: AdsIntelligenceBlock['metrics']): string[] {
  return METRIC_KEYS.filter((key) => metrics[key] !== null);
}

function deriveSignals(metrics: AdsIntelligenceBlock['metrics']): AdsDerivedSignals {
  const hasTrafficFromAds = (metrics.impressions ?? 0) > 0 || (metrics.clicks ?? 0) > 0;
  const hasClicksFromAds = (metrics.clicks ?? 0) > 0;
  const hasAttributedSales = (metrics.ordersAttributed ?? 0) > 0 || (metrics.revenueAttributed ?? 0) > 0;

  const adsEfficiencyLevel =
    metrics.ctr === null
      ? 'unknown'
      : metrics.ctr >= 0.015
        ? 'strong'
        : metrics.ctr >= 0.0075
          ? 'moderate'
          : 'weak';

  const adsConversionHealth =
    metrics.conversionRateAds === null
      ? 'unknown'
      : metrics.conversionRateAds >= 0.03
        ? 'strong'
        : metrics.conversionRateAds >= 0.015
          ? 'moderate'
          : 'weak';

  const adsProfitabilitySignal =
    metrics.roas === null
      ? 'unknown'
      : metrics.roas >= 3
        ? 'positive'
        : metrics.roas >= 1.5
          ? 'mixed'
          : 'negative';

  return {
    hasTrafficFromAds,
    hasClicksFromAds,
    hasAttributedSales,
    adsEfficiencyLevel,
    adsConversionHealth,
    adsProfitabilitySignal,
  };
}

export function buildAdsIntelligence(snapshot: AdsMetricsSnapshot, options?: {
  provider?: string;
  integration?: string;
  note?: string | null;
}): AdsIntelligenceBlock {
  const metrics = {
    impressions: snapshot.impressions,
    clicks: snapshot.clicks,
    ctr: snapshot.ctr,
    cpc: snapshot.cpc,
    spend: snapshot.spend,
    ordersAttributed: snapshot.ordersAttributed,
    revenueAttributed: snapshot.revenueAttributed,
    roas: snapshot.roas,
    conversionRateAds: snapshot.conversionRateAds,
  };

  const availableMetrics = getAvailableMetrics(metrics);
  const signals = deriveSignals(metrics);
  const unavailableMetrics = METRIC_KEYS.filter((metric) => !availableMetrics.includes(metric));
  const analyzedAt = new Date().toISOString();

  if (snapshot.status === 'unavailable') {
    return {
      status: 'unavailable',
      adsScore: null,
      summary: 'Dados confiáveis de anúncios patrocinados não estão disponíveis no momento.',
      diagnosis: 'ads_data_unavailable',
      metrics,
      signals,
      recommendations: [
        'Valide no painel do marketplace se a campanha está gerando cliques, pedidos e ROAS antes de aumentar verba.',
        'Mantenha esta leitura como indisponível até conectar uma fonte de Ads que exponha métricas confiáveis.',
      ],
      opportunities: [],
      analyzedAt,
      source: {
        provider: options?.provider ?? 'unknown',
        integration: options?.integration ?? 'not_configured',
        mode: 'historical_snapshot',
        snapshotDate: snapshot.date ?? null,
        metricsAvailable: availableMetrics,
        metricsUnavailable: unavailableMetrics,
        note: options?.note ?? null,
      },
    };
  }

  if (availableMetrics.length === 0) {
    return {
      status: 'partial',
      adsScore: null,
      summary: 'A integração de Ads respondeu, mas ainda não retornou métricas preenchidas para esta leitura.',
      diagnosis: 'ads_partial_data',
      metrics,
      signals,
      recommendations: [
        'Mantenha a campanha monitorada e confira se o marketplace passa a preencher metrics para a janela consultada.',
        'Evite decisões agressivas de orçamento enquanto cliques, gasto e retorno não vierem preenchidos juntos.',
      ],
      opportunities: [],
      analyzedAt,
      source: {
        provider: options?.provider ?? 'unknown',
        integration: options?.integration ?? 'manual_or_future',
        mode: 'historical_snapshot',
        snapshotDate: snapshot.date ?? null,
        metricsAvailable: availableMetrics,
        metricsUnavailable: unavailableMetrics,
        note: options?.note ?? null,
      },
    };
  }

  let score = 50;
  if (metrics.ctr !== null) {
    score += metrics.ctr >= 0.015 ? 15 : metrics.ctr >= 0.0075 ? 5 : -12;
  }
  if (metrics.conversionRateAds !== null) {
    score += metrics.conversionRateAds >= 0.03 ? 18 : metrics.conversionRateAds >= 0.015 ? 8 : -15;
  }
  if (metrics.roas !== null) {
    score += metrics.roas >= 3 ? 20 : metrics.roas >= 1.5 ? 8 : -22;
  }
  if ((metrics.clicks ?? 0) >= 20 && (metrics.ordersAttributed ?? 0) === 0) {
    score -= 12;
  }

  let diagnosis: AdsIntelligenceBlock['diagnosis'] = 'ads_mixed_signal';
  let summary = 'Os sinais de anúncios patrocinados estão mistos e pedem monitoramento.';
  const recommendations: string[] = [];
  const opportunities: string[] = [];

  if (availableMetrics.length < 4 || snapshot.status === 'partial') {
    diagnosis = 'ads_partial_data';
    summary = 'Há sinais parciais de ads, mas ainda não dá para fechar leitura completa de eficiência.';
    recommendations.push('Evite escalar investimento enquanto CTR, gasto e retorno não estiverem visíveis juntos.');
  }

  if (signals.hasTrafficFromAds && !signals.hasAttributedSales && (metrics.clicks ?? 0) >= 15) {
    diagnosis = 'ads_traffic_without_conversion';
    summary = 'A campanha gera tráfego, mas o anúncio ainda converte pouco para vendas atribuídas.';
    recommendations.push('Reforce descrição, prova social e clareza da oferta para melhorar conversão pós-clique.');
    opportunities.push('Há demanda inicial validada: o gargalo parece estar mais na página do anúncio do que no tráfego.');
  }

  if (signals.adsEfficiencyLevel === 'weak') {
    if (diagnosis !== 'ads_traffic_without_conversion') {
      diagnosis = 'ads_low_ctr';
      summary = 'A campanha está com baixa atratividade no leilão e tende a perder clique.';
    }
    recommendations.push('Revise imagem principal e título para aumentar CTR no leilão patrocinado.');
    opportunities.push('Melhorar atratividade pode destravar mais cliques sem depender só de mais verba.');
  }

  if (
    signals.adsEfficiencyLevel === 'strong' &&
    signals.adsConversionHealth === 'strong' &&
    signals.adsProfitabilitySignal === 'positive'
  ) {
    diagnosis = 'ads_healthy';
    summary = 'A campanha parece saudável: gera clique, converte e mostra retorno consistente.';
    recommendations.push('Mantenha a campanha ativa e monitore tendência de CTR, conversão e ROAS antes de escalar.');
    opportunities.push('Existe espaço para escalar gradualmente se o desempenho se mantiver estável.');
  }

  if ((metrics.spend ?? 0) >= 100 && signals.adsProfitabilitySignal === 'negative') {
    score -= signals.hasAttributedSales ? 12 : 18;
  }

  if ((metrics.spend ?? 0) >= 100 && signals.adsProfitabilitySignal === 'negative' && diagnosis !== 'ads_traffic_without_conversion') {
    diagnosis = 'ads_spend_without_return';
    summary = 'O anúncio patrocinado parece estar consumindo verba com retorno fraco.';
    recommendations.push('Reduza investimento manualmente na campanha com ROAS fraco até corrigir oferta e conversão.');
    opportunities.push('Reorganizar verba para campanhas com melhor retorno pode evitar desperdício imediato.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Monitore CTR, conversão e ROAS juntos para decidir se a verba está ajudando ou apenas sustentando tráfego.');
  }

  return {
    status: availableMetrics.length >= 6 && snapshot.status === 'available' ? 'available' : 'partial',
    adsScore: clampScore(score),
    summary,
    diagnosis,
    metrics,
    signals,
    recommendations: recommendations.slice(0, 5),
    opportunities: opportunities.slice(0, 3),
    analyzedAt,
    source: {
      provider: options?.provider ?? 'unknown',
      integration: options?.integration ?? 'manual_or_future',
      mode: 'historical_snapshot',
      snapshotDate: snapshot.date ?? null,
      metricsAvailable: availableMetrics,
      metricsUnavailable: unavailableMetrics,
      note: options?.note ?? null,
    },
  };
}
