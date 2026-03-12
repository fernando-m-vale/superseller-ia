export type RootCauseCode =
  | 'visual_low_ctr'
  | 'seo_low_discovery'
  | 'price_low_conversion'
  | 'trust_low_conversion'
  | 'logistics_low_conversion'
  | 'ads_traffic_low_return'
  | 'content_low_conversion'
  | 'mixed_signal'
  | 'insufficient_data';

export type RootCauseStage = 'discovery' | 'click' | 'conversion' | 'ads' | 'mixed' | 'unknown';
export type RecommendationPriority = 'high' | 'medium' | 'low';
export type EstimatedImpact = 'high' | 'medium' | 'low';
export type SignalStrength = 'strong' | 'medium' | 'weak' | 'unknown';

export interface RootCauseEngineInput {
  listingTitle?: string | null;
  metrics30d?: {
    visits?: number | null;
    orders?: number | null;
    conversionRate?: number | null;
    ctr?: number | null;
  } | null;
  scoreBreakdown?: {
    cadastro?: number | null;
    midia?: number | null;
    performance?: number | null;
    seo?: number | null;
    competitividade?: number | null;
  } | null;
  pricingNormalized?: {
    originalPriceForDisplay?: number | null;
    finalPriceForDisplay?: number | null;
    hasPromotion?: boolean | null;
  } | null;
  promo?: {
    hasPromotion?: boolean | null;
    discountPercent?: number | null;
  } | null;
  visualAnalysis?: {
    visual_score?: number | null;
    summary?: string | null;
    main_improvements?: string[] | null;
  } | null;
  adsIntelligence?: {
    status?: 'available' | 'partial' | 'unavailable' | null;
    metrics?: {
      ctr?: number | null;
      spend?: number | null;
      roas?: number | null;
      clicks?: number | null;
      ordersAttributed?: number | null;
      conversionRateAds?: number | null;
    } | null;
    signals?: {
      hasTrafficFromAds?: boolean | null;
      hasClicksFromAds?: boolean | null;
      hasAttributedSales?: boolean | null;
      adsEfficiencyLevel?: 'strong' | 'moderate' | 'weak' | 'unknown' | null;
      adsConversionHealth?: 'strong' | 'moderate' | 'weak' | 'unknown' | null;
      adsProfitabilitySignal?: 'positive' | 'mixed' | 'negative' | 'unknown' | null;
    } | null;
  } | null;
  analysisV21?: {
    title_fix?: {
      problem?: string | null;
    } | null;
    description_fix?: {
      diagnostic?: string | null;
    } | null;
    image_plan?: Array<{ action?: string | null }> | null;
    price_fix?: {
      diagnostic?: string | null;
      action?: string | null;
    } | null;
  } | null;
  mediaVerdict?: {
    hasClipDetected?: boolean | null;
    canSuggestClip?: boolean | null;
  } | null;
  benchmark?: {
    benchmarkSummary?: {
      confidence?: 'high' | 'medium' | 'low' | 'unavailable' | null;
      sampleSize?: number | null;
      baselineConversion?: {
        conversionRate?: number | null;
      } | null;
      stats?: {
        medianPrice?: number | null;
      } | null;
    } | null;
  } | null;
  listing?: {
    brand?: string | null;
    model?: string | null;
    gtin?: string | null;
    warranty?: string | null;
    is_free_shipping?: boolean | null;
    is_full_eligible?: boolean | null;
    logistic_type?: string | null;
    shipping_mode?: string | null;
    questions_count?: number | null;
    reviews_count?: number | null;
    rating_average?: unknown;
  } | null;
  dataQuality?: {
    completenessScore?: number | null;
    warnings?: string[] | null;
    performanceAvailable?: boolean | null;
    visitsCoverage?: {
      filledDays?: number | null;
      totalDays?: number | null;
    } | null;
  } | null;
}

export interface RootCauseSignalsUsed {
  visualScore: number | null;
  adsCtr: number | null;
  adsRoas: number | null;
  adsSpend: number | null;
  visits: number | null;
  orders: number | null;
  conversionRate: number | null;
  benchmarkConversionRate: number | null;
  benchmarkMedianPrice: number | null;
  priceCompetitiveSignal: SignalStrength;
  trustSignal: SignalStrength;
  logisticsSignal: SignalStrength;
  contentSignal: SignalStrength;
  seoSignal: SignalStrength;
  adsSignal: SignalStrength;
  dataQualitySignal: SignalStrength;
  missingAttributeCount: number;
  discountPercent: number | null;
  hasPromotion: boolean | null;
  freeShipping: boolean | null;
  fullEligible: boolean | null;
  ratingAverage: number | null;
  reviewsCount: number | null;
  questionsCount: number | null;
}

export interface RootCauseDiagnosis {
  diagnosisRootCause: RootCauseCode;
  rootCauseConfidence: number;
  rootCauseStage: RootCauseStage;
  rootCauseSummary: string;
  signalsUsed: RootCauseSignalsUsed;
  estimatedImpact: EstimatedImpact;
  primaryRecommendation: string;
  recommendationPriority: RecommendationPriority;
}

interface CandidateScore {
  code: Exclude<RootCauseCode, 'mixed_signal' | 'insufficient_data'>;
  stage: Exclude<RootCauseStage, 'mixed' | 'unknown'>;
  score: number;
  evidence: string[];
  contradictions: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function roundNumber(value: number): number {
  return Math.round(value);
}

function deriveSignals(input: RootCauseEngineInput): RootCauseSignalsUsed {
  const visualScore = input.visualAnalysis?.visual_score ?? null;
  const visits = input.metrics30d?.visits ?? null;
  const orders = input.metrics30d?.orders ?? null;
  const conversionRate = input.metrics30d?.conversionRate ?? null;
  const adsCtr = input.adsIntelligence?.metrics?.ctr ?? null;
  const adsRoas = input.adsIntelligence?.metrics?.roas ?? null;
  const adsSpend = input.adsIntelligence?.metrics?.spend ?? null;
  const benchmarkConversionRate = input.benchmark?.benchmarkSummary?.baselineConversion?.conversionRate ?? null;
  const benchmarkMedianPrice = input.benchmark?.benchmarkSummary?.stats?.medianPrice ?? null;
  const discountPercent = input.promo?.discountPercent ?? null;
  const hasPromotion = input.pricingNormalized?.hasPromotion ?? input.promo?.hasPromotion ?? null;
  const freeShipping = input.listing?.is_free_shipping ?? null;
  const fullEligible = input.listing?.is_full_eligible ?? null;
  const ratingAverageRaw = input.listing?.rating_average;
  const ratingAverage =
    ratingAverageRaw === null || ratingAverageRaw === undefined || ratingAverageRaw === ''
      ? null
      : Number.isFinite(Number(ratingAverageRaw))
        ? Number(ratingAverageRaw)
        : null;
  const reviewsCount = input.listing?.reviews_count ?? null;
  const questionsCount = input.listing?.questions_count ?? null;
  const missingAttributeCount = [
    input.listing?.brand,
    input.listing?.model,
    input.listing?.gtin,
    input.listing?.warranty,
  ].filter((value) => !value).length;

  const finalPrice = input.pricingNormalized?.finalPriceForDisplay ?? null;
  const competitivenessScore = input.scoreBreakdown?.competitividade ?? null;
  let priceCompetitiveSignal: SignalStrength = 'unknown';
  if (typeof finalPrice === 'number' && typeof benchmarkMedianPrice === 'number' && benchmarkMedianPrice > 0) {
    const ratio = finalPrice / benchmarkMedianPrice;
    if (ratio <= 0.95) priceCompetitiveSignal = 'strong';
    else if (ratio <= 1.08) priceCompetitiveSignal = 'medium';
    else priceCompetitiveSignal = 'weak';
  } else if (typeof competitivenessScore === 'number') {
    if (competitivenessScore <= 4) priceCompetitiveSignal = 'weak';
    else if (competitivenessScore <= 7) priceCompetitiveSignal = 'medium';
    else priceCompetitiveSignal = 'strong';
  }

  let trustSignal: SignalStrength = 'unknown';
  if (typeof ratingAverage === 'number' || typeof reviewsCount === 'number' || typeof questionsCount === 'number') {
    if (
      (typeof ratingAverage === 'number' && ratingAverage < 4.2) ||
      (typeof questionsCount === 'number' && questionsCount >= 8) ||
      missingAttributeCount >= 3
    ) {
      trustSignal = 'weak';
    } else if (
      (typeof ratingAverage === 'number' && ratingAverage >= 4.6 && (reviewsCount ?? 0) >= 20) ||
      Boolean(input.listing?.warranty)
    ) {
      trustSignal = 'strong';
    } else {
      trustSignal = 'medium';
    }
  }

  let logisticsSignal: SignalStrength = 'unknown';
  if (freeShipping !== null || fullEligible !== null || input.listing?.shipping_mode || input.listing?.logistic_type) {
    if (freeShipping === false || (!fullEligible && input.listing?.shipping_mode !== 'fulfillment')) {
      logisticsSignal = 'weak';
    } else if (freeShipping === true && fullEligible === true) {
      logisticsSignal = 'strong';
    } else {
      logisticsSignal = 'medium';
    }
  }

  const descriptionDiagnostic = normalizeText(input.analysisV21?.description_fix?.diagnostic);
  let contentSignal: SignalStrength = 'unknown';
  if (descriptionDiagnostic || missingAttributeCount > 0) {
    if (
      missingAttributeCount >= 2 ||
      hasAny(descriptionDiagnostic, ['nao responde', 'compat', 'beneficio', 'convinc', 'objec', 'faq'])
    ) {
      contentSignal = 'weak';
    } else {
      contentSignal = 'medium';
    }
  }

  const titleProblem = normalizeText(input.analysisV21?.title_fix?.problem);
  const seoScore = input.scoreBreakdown?.seo ?? null;
  let seoSignal: SignalStrength = 'unknown';
  if (titleProblem || typeof seoScore === 'number') {
    if (
      hasAny(titleProblem, ['modelo', 'compat', 'medida', 'capacidade', 'busca', 'atrib']) ||
      (typeof seoScore === 'number' && seoScore <= 10)
    ) {
      seoSignal = 'weak';
    } else if (typeof seoScore === 'number' && seoScore >= 16) {
      seoSignal = 'strong';
    } else {
      seoSignal = 'medium';
    }
  }

  let adsSignal: SignalStrength = 'unknown';
  if (input.adsIntelligence?.status && input.adsIntelligence.status !== 'unavailable') {
    if (
      input.adsIntelligence?.signals?.adsProfitabilitySignal === 'negative' ||
      input.adsIntelligence?.signals?.adsEfficiencyLevel === 'weak'
    ) {
      adsSignal = 'weak';
    } else if (
      input.adsIntelligence?.signals?.adsProfitabilitySignal === 'positive' &&
      input.adsIntelligence?.signals?.adsEfficiencyLevel === 'strong'
    ) {
      adsSignal = 'strong';
    } else {
      adsSignal = 'medium';
    }
  }

  const completeness = input.dataQuality?.completenessScore ?? null;
  const filledDays = input.dataQuality?.visitsCoverage?.filledDays ?? null;
  let dataQualitySignal: SignalStrength = 'unknown';
  if (typeof completeness === 'number' || typeof filledDays === 'number') {
    if ((typeof completeness === 'number' && completeness < 55) || (typeof filledDays === 'number' && filledDays < 7)) {
      dataQualitySignal = 'weak';
    } else if ((typeof completeness === 'number' && completeness >= 80) || (typeof filledDays === 'number' && filledDays >= 20)) {
      dataQualitySignal = 'strong';
    } else {
      dataQualitySignal = 'medium';
    }
  }

  return {
    visualScore,
    adsCtr,
    adsRoas,
    adsSpend,
    visits,
    orders,
    conversionRate,
    benchmarkConversionRate,
    benchmarkMedianPrice,
    priceCompetitiveSignal,
    trustSignal,
    logisticsSignal,
    contentSignal,
    seoSignal,
    adsSignal,
    dataQualitySignal,
    missingAttributeCount,
    discountPercent,
    hasPromotion,
    freeShipping,
    fullEligible,
    ratingAverage,
    reviewsCount,
    questionsCount,
  };
}

function countAvailableSignals(signals: RootCauseSignalsUsed): number {
  return [
    signals.visualScore,
    signals.adsCtr,
    signals.adsRoas,
    signals.adsSpend,
    signals.visits,
    signals.orders,
    signals.conversionRate,
    signals.benchmarkConversionRate,
    signals.benchmarkMedianPrice,
  ].filter((value) => typeof value === 'number').length +
    [
      signals.priceCompetitiveSignal,
      signals.trustSignal,
      signals.logisticsSignal,
      signals.contentSignal,
      signals.seoSignal,
      signals.adsSignal,
      signals.dataQualitySignal,
    ].filter((value) => value !== 'unknown').length;
}

function hasInsufficientData(input: RootCauseEngineInput, signals: RootCauseSignalsUsed): boolean {
  const availableSignals = countAvailableSignals(signals);
  const hasPerformance =
    typeof signals.visits === 'number' ||
    typeof signals.orders === 'number' ||
    typeof signals.conversionRate === 'number';
  const hasVisual = typeof signals.visualScore === 'number';
  const hasAds = Boolean(input.adsIntelligence?.status && input.adsIntelligence.status !== 'unavailable');

  return availableSignals < 4 || (!hasPerformance && !hasVisual && !hasAds);
}

function buildCandidates(input: RootCauseEngineInput, signals: RootCauseSignalsUsed): CandidateScore[] {
  const candidates: CandidateScore[] = [
    { code: 'visual_low_ctr', stage: 'click', score: 0, evidence: [], contradictions: [] },
    { code: 'seo_low_discovery', stage: 'discovery', score: 0, evidence: [], contradictions: [] },
    { code: 'price_low_conversion', stage: 'conversion', score: 0, evidence: [], contradictions: [] },
    { code: 'trust_low_conversion', stage: 'conversion', score: 0, evidence: [], contradictions: [] },
    { code: 'logistics_low_conversion', stage: 'conversion', score: 0, evidence: [], contradictions: [] },
    { code: 'ads_traffic_low_return', stage: 'ads', score: 0, evidence: [], contradictions: [] },
    { code: 'content_low_conversion', stage: 'conversion', score: 0, evidence: [], contradictions: [] },
  ];

  const get = (code: CandidateScore['code']) => candidates.find((candidate) => candidate.code === code)!;
  const visits = signals.visits ?? null;
  const conversionRate = signals.conversionRate ?? null;
  const adsCtr = signals.adsCtr ?? null;
  const visualScore = signals.visualScore ?? null;
  const titleProblem = normalizeText(input.analysisV21?.title_fix?.problem);
  const descriptionDiagnostic = normalizeText(input.analysisV21?.description_fix?.diagnostic);
  const imagePlanText = normalizeText((input.analysisV21?.image_plan || []).map((step) => step?.action || '').join(' '));
  const lowVisits = typeof visits === 'number' && visits < 60;
  const highVisits = typeof visits === 'number' && visits >= 120;
  const lowConversion = typeof conversionRate === 'number' && conversionRate < 0.012;
  const goodConversion =
    typeof conversionRate === 'number' &&
    (conversionRate >= 0.02 || (typeof signals.benchmarkConversionRate === 'number' && conversionRate >= signals.benchmarkConversionRate * 0.9));
  const goodVisual = typeof visualScore === 'number' && visualScore >= 72;
  const weakVisual = typeof visualScore === 'number' && visualScore < 58;
  const goodAdsCtr = typeof adsCtr === 'number' && adsCtr >= 0.012;
  const weakAdsCtr = typeof adsCtr === 'number' && adsCtr < 0.008;

  const visual = get('visual_low_ctr');
  if (weakVisual) {
    visual.score += visualScore! < 45 ? 34 : 24;
    visual.evidence.push('visual_score_baixo');
  }
  if (weakAdsCtr) {
    visual.score += 18;
    visual.evidence.push('ads_ctr_baixo');
  }
  if (lowVisits) {
    visual.score += 8;
    visual.evidence.push('baixa_descoberta_com_efeito_no_clique');
  }
  if (hasAny(imagePlanText, ['capa', 'principal', 'hero', 'foto 1', 'imagem 1'])) {
    visual.score += 10;
    visual.evidence.push('plano_de_imagem_foca_capa');
  }
  if (goodConversion) {
    visual.score -= 16;
    visual.contradictions.push('conversao_ja_aceitavel');
  }
  if (goodVisual) {
    visual.score -= 18;
    visual.contradictions.push('visual_ja_forte');
  }

  const seo = get('seo_low_discovery');
  if (lowVisits) {
    seo.score += 22;
    seo.evidence.push('visitas_baixas');
  }
  if (goodVisual) {
    seo.score += 14;
    seo.evidence.push('visual_bom');
  }
  if (goodConversion) {
    seo.score += 16;
    seo.evidence.push('conversao_nao_parece_ser_o_gargalo');
  }
  if (signals.seoSignal === 'weak') {
    seo.score += 16;
    seo.evidence.push('seo_fraco');
  }
  if (hasAny(titleProblem, ['modelo', 'compat', 'medida', 'capacidade', 'busca', 'atrib'])) {
    seo.score += 10;
    seo.evidence.push('titulo_nao_capta_busca');
  }
  if (weakVisual && weakAdsCtr) {
    seo.score -= 10;
    seo.contradictions.push('click_tambem_esta_fraco');
  }

  const price = get('price_low_conversion');
  if (highVisits) {
    price.score += 14;
    price.evidence.push('trafego_suficiente');
  }
  if (lowConversion) {
    price.score += 22;
    price.evidence.push('conversao_baixa');
  }
  if (signals.priceCompetitiveSignal === 'weak') {
    price.score += 22;
    price.evidence.push('preco_pouco_competitivo');
  } else if (signals.priceCompetitiveSignal === 'medium') {
    price.score += 10;
    price.evidence.push('preco_medio');
  }
  if ((signals.hasPromotion === false || (signals.discountPercent ?? 0) < 5) && highVisits && lowConversion) {
    price.score += 8;
    price.evidence.push('promocao_fraca_ou_ausente');
  }
  if (signals.trustSignal === 'strong' && signals.contentSignal === 'strong') {
    price.score += 4;
  }
  if (signals.priceCompetitiveSignal === 'strong') {
    price.score -= 16;
    price.contradictions.push('preco_ja_competitivo');
  }

  const trust = get('trust_low_conversion');
  if (highVisits) {
    trust.score += 12;
    trust.evidence.push('trafego_suficiente');
  }
  if (lowConversion) {
    trust.score += 18;
    trust.evidence.push('conversao_baixa');
  }
  if (signals.trustSignal === 'weak') {
    trust.score += 24;
    trust.evidence.push('confianca_fraca');
  }
  if ((signals.questionsCount ?? 0) >= 8) {
    trust.score += 8;
    trust.evidence.push('muitas_duvidas');
  }
  if (signals.trustSignal === 'strong') {
    trust.score -= 16;
    trust.contradictions.push('prova_social_forte');
  }

  const logistics = get('logistics_low_conversion');
  if (highVisits) {
    logistics.score += 10;
    logistics.evidence.push('trafego_suficiente');
  }
  if (lowConversion) {
    logistics.score += 16;
    logistics.evidence.push('conversao_baixa');
  }
  if (signals.logisticsSignal === 'weak') {
    logistics.score += 24;
    logistics.evidence.push('logistica_fraca');
  }
  if (signals.logisticsSignal === 'strong') {
    logistics.score -= 16;
    logistics.contradictions.push('logistica_ja_competitiva');
  }

  const ads = get('ads_traffic_low_return');
  if (input.adsIntelligence?.status && input.adsIntelligence.status !== 'unavailable') {
    ads.score += 4;
    ads.evidence.push('ads_ativos');
  }
  if ((input.adsIntelligence?.signals?.hasTrafficFromAds || false) || ((input.adsIntelligence?.metrics?.clicks ?? 0) >= 15)) {
    ads.score += 10;
    ads.evidence.push('ads_gerando_trafego');
  }
  if ((signals.adsSpend ?? 0) >= 100) {
    ads.score += 12;
    ads.evidence.push('spend_relevante');
  }
  if ((signals.adsRoas ?? 99) < 1.5) {
    ads.score += 16;
    ads.evidence.push('roas_fraco');
  }
  if ((input.adsIntelligence?.metrics?.ordersAttributed ?? 0) === 0 && (input.adsIntelligence?.metrics?.clicks ?? 0) >= 20) {
    ads.score += 14;
    ads.evidence.push('cliques_sem_pedidos');
  }
  if (signals.adsSignal === 'strong') {
    ads.score -= 18;
    ads.contradictions.push('ads_ja_saudavel');
  }
  if (weakAdsCtr && weakVisual) {
    ads.score -= 8;
    ads.contradictions.push('baixa_atratividade_parece_mais_de_criativo');
  }

  const content = get('content_low_conversion');
  if (highVisits) {
    content.score += 12;
    content.evidence.push('trafego_suficiente');
  }
  if (lowConversion) {
    content.score += 20;
    content.evidence.push('conversao_baixa');
  }
  if (signals.contentSignal === 'weak') {
    content.score += 22;
    content.evidence.push('conteudo_fraco');
  }
  if (goodAdsCtr || ((input.metrics30d?.ctr ?? 0) >= 0.01)) {
    content.score += 10;
    content.evidence.push('clique_nao_parece_ser_o_gargalo');
  }
  if (signals.priceCompetitiveSignal === 'strong') {
    content.score += 6;
  }
  if (hasAny(descriptionDiagnostic, ['nao responde', 'compat', 'beneficio', 'convinc', 'objec', 'faq'])) {
    content.score += 10;
    content.evidence.push('descricao_deixa_objecoes_abertas');
  }
  if (signals.contentSignal === 'unknown') {
    content.score -= 6;
    content.contradictions.push('pouco_sinal_de_conteudo');
  }

  return candidates.map((candidate) => ({
    ...candidate,
    score: clamp(candidate.score, 0, 100),
  }));
}

function buildRecommendation(code: RootCauseCode): {
  primaryRecommendation: string;
  recommendationPriority: RecommendationPriority;
  estimatedImpact: EstimatedImpact;
  rootCauseStage: RootCauseStage;
} {
  switch (code) {
    case 'visual_low_ctr':
      return {
        primaryRecommendation: 'Trocar a imagem principal e melhorar a capa antes de buscar mais tráfego.',
        recommendationPriority: 'high',
        estimatedImpact: 'high',
        rootCauseStage: 'click',
      };
    case 'seo_low_discovery':
      return {
        primaryRecommendation: 'Reescrever o título com termos de busca, modelo e atributos principais.',
        recommendationPriority: 'high',
        estimatedImpact: 'high',
        rootCauseStage: 'discovery',
      };
    case 'price_low_conversion':
      return {
        primaryRecommendation: 'Revisar preço e promoção para ficar mais competitivo sem sacrificar margem à toa.',
        recommendationPriority: 'high',
        estimatedImpact: 'high',
        rootCauseStage: 'conversion',
      };
    case 'trust_low_conversion':
      return {
        primaryRecommendation: 'Reforçar prova de confiança, garantia e informações que deixem a compra mais segura.',
        recommendationPriority: 'high',
        estimatedImpact: 'medium',
        rootCauseStage: 'conversion',
      };
    case 'logistics_low_conversion':
      return {
        primaryRecommendation: 'Melhorar frete e prazo percebido para reduzir desistência na reta final.',
        recommendationPriority: 'high',
        estimatedImpact: 'medium',
        rootCauseStage: 'conversion',
      };
    case 'ads_traffic_low_return':
      return {
        primaryRecommendation: 'Revisar campanha, criativo e página antes de continuar investindo em ads.',
        recommendationPriority: 'high',
        estimatedImpact: 'high',
        rootCauseStage: 'ads',
      };
    case 'content_low_conversion':
      return {
        primaryRecommendation: 'Reescrever descrição e atributos para responder dúvidas e ajudar o cliente a decidir.',
        recommendationPriority: 'high',
        estimatedImpact: 'medium',
        rootCauseStage: 'conversion',
      };
    case 'mixed_signal':
      return {
        primaryRecommendation: 'Executar primeiro a melhoria mais reversível e observar qual sinal reage antes de ampliar escopo.',
        recommendationPriority: 'medium',
        estimatedImpact: 'medium',
        rootCauseStage: 'mixed',
      };
    case 'insufficient_data':
    default:
      return {
        primaryRecommendation: 'Coletar mais sinais confiáveis de performance antes de assumir uma causa dominante.',
        recommendationPriority: 'low',
        estimatedImpact: 'low',
        rootCauseStage: 'unknown',
      };
  }
}

function summarizeRootCause(
  code: RootCauseCode,
  signals: RootCauseSignalsUsed,
  recommendation: string,
): string {
  switch (code) {
    case 'visual_low_ctr':
      return `O principal problema parece estar no clique. A imagem principal e a capa ainda não chamam atenção suficiente. ${recommendation}`;
    case 'seo_low_discovery':
      return `O anúncio parece ter pouca descoberta. Há poucas visitas para o nível atual do anúncio, o que sugere problema de título, busca ou atributos. ${recommendation}`;
    case 'price_low_conversion':
      return `O tráfego chega, mas preço e promoção ainda não ajudam a fechar a compra. ${recommendation}`;
    case 'trust_low_conversion':
      return `A decisão parece travar por falta de confiança. Avaliações, garantia ou provas do anúncio ainda não passam segurança suficiente. ${recommendation}`;
    case 'logistics_low_conversion':
      return `A oferta perde força na reta final por causa de frete, prazo ou percepção logística. ${recommendation}`;
    case 'ads_traffic_low_return':
      return `O maior desperdício atual parece estar nos ads. Há investimento sem retorno proporcional em pedidos. ${recommendation}`;
    case 'content_low_conversion':
      return `O clique existe, mas a página ainda não ajuda o cliente a decidir. Descrição, atributos e respostas às dúvidas seguem fracos. ${recommendation}`;
    case 'mixed_signal':
      return `Os sinais disponíveis apontam mais de um gargalo relevante ao mesmo tempo, então a leitura dominante ainda está mista. ${recommendation}`;
    case 'insufficient_data':
    default:
      return `Ainda não há sinais suficientes e consistentes para cravar uma causa raiz dominante com segurança. ${recommendation}`;
  }
}

function calculateConfidence(
  input: RootCauseEngineInput,
  code: RootCauseCode,
  winner: CandidateScore | null,
  runnerUp: CandidateScore | null,
  signals: RootCauseSignalsUsed,
): number {
  if (!winner) return 20;

  const signalCount = countAvailableSignals(signals);
  const margin = winner.score - (runnerUp?.score ?? 0);
  const contradictions = winner.contradictions.length;
  const evidence = winner.evidence.length;
  const benchmarkConfidence = String(input.benchmark?.benchmarkSummary?.confidence || '').toLowerCase();
  const adsStatus = input.adsIntelligence?.status ?? null;
  let penalty = 0;

  if (!input.benchmark?.benchmarkSummary || benchmarkConfidence === 'unavailable' || benchmarkConfidence === 'low') {
    penalty += 8;
  }
  if (signals.trustSignal === 'unknown') {
    penalty += code === 'trust_low_conversion' ? 10 : 4;
  }
  if (signals.logisticsSignal === 'unknown') {
    penalty += code === 'logistics_low_conversion' ? 10 : 4;
  }
  if (adsStatus === 'partial') {
    penalty += code === 'ads_traffic_low_return' ? 12 : 5;
  }
  if (!adsStatus || adsStatus === 'unavailable') {
    penalty += code === 'ads_traffic_low_return' ? 14 : 0;
  }
  if (runnerUp) {
    const distance = Math.abs(winner.score - runnerUp.score);
    if (distance <= 3) penalty += 16;
    else if (distance <= 6) penalty += 11;
    else if (distance <= 10) penalty += 6;
  }
  if (signals.dataQualitySignal === 'weak') {
    penalty += 8;
  }
  if (code === 'mixed_signal') {
    penalty += 8;
  }
  if (code === 'insufficient_data') {
    penalty += 10;
  }

  let confidence = 18 + winner.score * 0.33 + signalCount * 1.6 + evidence * 2.5 + Math.min(8, margin) - contradictions * 10 - penalty;

  if (code === 'mixed_signal') confidence = Math.min(confidence, 58);
  if (code === 'insufficient_data') confidence = Math.min(confidence, 34);
  if (penalty >= 20) confidence = Math.min(confidence, 79);
  if (penalty >= 28) confidence = Math.min(confidence, 72);

  return roundNumber(clamp(confidence, 12, 95));
}

export function diagnoseRootCause(input: RootCauseEngineInput): RootCauseDiagnosis {
  const signals = deriveSignals(input);
  const fallback = buildRecommendation('insufficient_data');

  if (hasInsufficientData(input, signals)) {
    return {
      diagnosisRootCause: 'insufficient_data',
      rootCauseConfidence: 24,
      rootCauseStage: fallback.rootCauseStage,
      rootCauseSummary: summarizeRootCause('insufficient_data', signals, fallback.primaryRecommendation),
      signalsUsed: signals,
      estimatedImpact: fallback.estimatedImpact,
      primaryRecommendation: fallback.primaryRecommendation,
      recommendationPriority: fallback.recommendationPriority,
    };
  }

  const candidates = buildCandidates(input, signals).sort((left, right) => right.score - left.score);
  const winner = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;

  if (!winner || winner.score < 38) {
    return {
      diagnosisRootCause: 'insufficient_data',
      rootCauseConfidence: calculateConfidence(input, 'insufficient_data', winner, runnerUp, signals),
      rootCauseStage: fallback.rootCauseStage,
      rootCauseSummary: summarizeRootCause('insufficient_data', signals, fallback.primaryRecommendation),
      signalsUsed: signals,
      estimatedImpact: fallback.estimatedImpact,
      primaryRecommendation: fallback.primaryRecommendation,
      recommendationPriority: fallback.recommendationPriority,
    };
  }

  const isMixed = Boolean(
    runnerUp &&
      winner.score >= 46 &&
      runnerUp.score >= 42 &&
      Math.abs(winner.score - runnerUp.score) <= 7,
  );
  const code: RootCauseCode = isMixed ? 'mixed_signal' : winner.code;
  const recommendation = buildRecommendation(code);

  return {
    diagnosisRootCause: code,
    rootCauseConfidence: calculateConfidence(input, code, winner, runnerUp, signals),
    rootCauseStage: recommendation.rootCauseStage,
    rootCauseSummary: summarizeRootCause(code, signals, recommendation.primaryRecommendation),
    signalsUsed: signals,
    estimatedImpact: recommendation.estimatedImpact,
    primaryRecommendation: recommendation.primaryRecommendation,
    recommendationPriority: recommendation.recommendationPriority,
  };
}
