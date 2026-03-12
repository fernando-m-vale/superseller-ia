import { diagnoseRootCause, type RootCauseDiagnosis } from './RootCauseEngine';

export interface AnalyzeResponseLike {
  listingId: string;
  score: number;
  critique: string;
  growthHacks?: Array<{ title?: string; summary?: string; description?: string }>;
  metrics30d?: {
    visits?: number | null;
    orders?: number | null;
    revenue?: number | null;
    conversionRate?: number | null;
    ctr?: number | null;
  };
  scoreBreakdown?: {
    cadastro?: number;
    midia?: number;
    performance?: number;
    seo?: number;
    competitividade?: number;
  };
  pricingNormalized?: {
    originalPriceForDisplay?: number | null;
    finalPriceForDisplay?: number | null;
    hasPromotion?: boolean | null;
  };
  promo?: {
    hasPromotion?: boolean | null;
    discountPercent?: number | null;
  };
  visualAnalysis?: {
    visual_score?: number | null;
    summary?: string | null;
    main_improvements?: string[] | null;
  };
  adsIntelligence?: {
    status?: 'available' | 'partial' | 'unavailable' | null;
    metrics?: {
      ctr?: number | null;
      spend?: number | null;
      roas?: number | null;
      clicks?: number | null;
      ordersAttributed?: number | null;
      conversionRateAds?: number | null;
    };
    signals?: {
      hasTrafficFromAds?: boolean | null;
      hasClicksFromAds?: boolean | null;
      hasAttributedSales?: boolean | null;
      adsEfficiencyLevel?: 'strong' | 'moderate' | 'weak' | 'unknown' | null;
      adsConversionHealth?: 'strong' | 'moderate' | 'weak' | 'unknown' | null;
      adsProfitabilitySignal?: 'positive' | 'mixed' | 'negative' | 'unknown' | null;
    };
  };
  mediaVerdict?: {
    hasClipDetected?: boolean | null;
    canSuggestClip?: boolean | null;
  };
  analysisV21?: {
    title_fix?: { problem?: string | null } | null;
    description_fix?: { diagnostic?: string | null } | null;
    image_plan?: Array<{ action?: string | null }> | null;
    price_fix?: { diagnostic?: string | null; action?: string | null } | null;
    verdict?: string | null;
  };
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
  dataQuality?: {
    completenessScore?: number | null;
    warnings?: string[] | null;
    performanceAvailable?: boolean | null;
    visitsCoverage?: {
      filledDays?: number | null;
      totalDays?: number | null;
    } | null;
  };
  diagnosisRootCause?: RootCauseDiagnosis['diagnosisRootCause'];
  rootCauseConfidence?: number;
  rootCauseStage?: RootCauseDiagnosis['rootCauseStage'];
  rootCauseSummary?: string;
  signalsUsed?: RootCauseDiagnosis['signalsUsed'];
  estimatedImpact?: RootCauseDiagnosis['estimatedImpact'];
  primaryRecommendation?: string;
  recommendationPriority?: RootCauseDiagnosis['recommendationPriority'];
}

export interface AnalyzeConsultingContext {
  listing: {
    title?: string | null;
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
  };
}

export function enrichAnalyzeResponseWithConsultingIntelligence(
  responseData: AnalyzeResponseLike,
  context: AnalyzeConsultingContext,
): AnalyzeResponseLike & RootCauseDiagnosis {
  const diagnosis = diagnoseRootCause({
    listingTitle: context.listing.title,
    metrics30d: responseData.metrics30d,
    scoreBreakdown: responseData.scoreBreakdown,
    pricingNormalized: responseData.pricingNormalized,
    promo: responseData.promo,
    visualAnalysis: responseData.visualAnalysis,
    adsIntelligence: responseData.adsIntelligence,
    analysisV21: responseData.analysisV21,
    mediaVerdict: responseData.mediaVerdict,
    benchmark: responseData.benchmark,
    listing: context.listing,
    dataQuality: responseData.dataQuality,
  });

  Object.assign(responseData, diagnosis);
  return responseData as AnalyzeResponseLike & RootCauseDiagnosis;
}
