/**
 * AI Analyze Input V1
 * 
 * Payload canônico para análise de anúncios pela IA.
 * Versão 1: usa dados reais de 30 dias com fallback seguro.
 */

import { Marketplace, ListingStatus } from '@prisma/client';
import type { ListingPersonalizationContext } from '../services/ListingPersonalizationEngine';

/**
 * Metadados da requisição de análise
 */
export interface AIAnalyzeInputMeta {
  requestId?: string;
  tenantId: string;
  userId?: string;
  marketplace: Marketplace;
  listingId: string;
  externalId?: string;
  analyzedAt: string;
  periodDays: number;
}

/**
 * Dados básicos do anúncio
 */
export interface AIAnalyzeInputListing {
  title: string;
  description: string;
  category?: string | null;
  price: number;
  currency: 'BRL';
  stock: number;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dados estendidos do anúncio para V2.1
 * Inclui informações de preço/promoção
 */
export interface AIAnalyzeInputListingV21 extends AIAnalyzeInputListing {
  price_base: number;      // Preço base (listing.price)
  price_final: number;     // Preço final (listing.price_final ou fallback para price)
  has_promotion: boolean;  // Tem promoção ativa?
  discount_percent: number | null; // Percentual de desconto (0-100)
  description_length: number; // Comprimento da descrição em caracteres
  price_effective?: number | null;
  listing_type_id?: string | null;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
  condition?: string | null;
  warranty?: string | null;
  has_brand?: boolean;
  has_model?: boolean;
  has_gtin?: boolean;
  has_warranty?: boolean;
  logistics?: {
    is_free_shipping?: boolean | null;
    shipping_mode?: string | null;
    is_full_eligible?: boolean | null;
    logistic_type?: string | null;
  };
  reputation?: {
    questions_count?: number | null;
    reviews_count?: number | null;
    rating_average?: number | null;
    review_health?: 'strong' | 'weak' | 'risk' | 'unknown';
    social_proof_strength?: 'strong' | 'moderate' | 'weak' | 'unknown';
  };
  quality?: {
    quality_grade?: string | null;
    moderation_status?: string | null;
    moderation_sub_status?: string | null;
  };
}

/**
 * Dados de mídia do anúncio
 */
export interface AIAnalyzeInputMedia {
  imageCount: number;
  hasImages: boolean;
  hasVideo: boolean | null; // LEGADO: não usar na decisão (mantido para compatibilidade)
  hasClips: boolean | null; // FONTE DE VERDADE: no ML, clip = vídeo. null = não detectável via API
  videoCount: number;
  // MediaVerdict - Fonte única de verdade para decisões sobre clip (vídeo)
  mediaVerdict?: {
    hasClipDetected: boolean | null;
    canSuggestClip: boolean;
    message: string;
    shortMessage: string;
  };
}

/**
 * Performance agregada do período
 */
export interface AIAnalyzeInputPerformance {
  periodDays: number;
  visits: number;
  orders: number;
  revenue: number | null;
  conversionRate: number | null;
  trend?: {
    visitsPctChange: number | null;
    ordersPctChange: number | null;
    revenuePctChange: number | null;
    isGrowing: boolean;
    previousPeriod: {
      visits: number;
      orders: number;
      revenue: number;
    };
  };
  impressions?: number;
  clicks?: number;
  ctr?: number | null;
}

/**
 * Cobertura de dados de visitas
 */
export interface VisitsCoverage {
  filledDays: number;  // Dias com visits não-null
  totalDays: number;   // Total de dias no período
}

/**
 * Qualidade dos dados enviados
 */
export interface AIAnalyzeInputDataQuality {
  missing: string[];
  warnings: string[];
  completenessScore: number;
  visitsCoverage: VisitsCoverage;
  performanceAvailable: boolean;  // false quando filledDays === 0
  sources: {
    performance: 'listing_metrics_daily' | 'listing_aggregates';
  };
}

/**
 * Qualidade dos dados V2.1 com visits_status
 */
export interface AIAnalyzeInputDataQualityV21 extends AIAnalyzeInputDataQuality {
  visits_status: 'ok' | 'partial' | 'unavailable';
}

/**
 * Payload completo V1 para análise pela IA
 */
export interface AIAnalyzeInputV1 {
  meta: AIAnalyzeInputMeta;
  listing: AIAnalyzeInputListing;
  media: AIAnalyzeInputMedia;
  performance: AIAnalyzeInputPerformance;
  dataQuality: AIAnalyzeInputDataQuality;
}

/**
 * Payload completo V2.1 para análise pela IA
 * Inclui campos estendidos de preço/promoção e visits_status
 */
export interface AIAnalyzeInputV21 {
  meta: AIAnalyzeInputMeta;
  listing: AIAnalyzeInputListingV21 & {
    category_name?: string | null;
    attributes?: {
      filled: string[];
      missing: string[];
      completenessScore: number;
      warnings: string[];
    };
  };
  media: AIAnalyzeInputMedia;
  performance: AIAnalyzeInputPerformance;
  dataQuality: AIAnalyzeInputDataQualityV21 & {
    missingAttributes?: string[];
    dataCompleteness?: number;
  };
  pricing?: {
    price: number;
    priceFinal: number;
    originalPrice: number | null;
    hasPromotion: boolean;
    discountPercent: number;
    freeShipping: boolean | null;
    fullEligible: boolean | null;
  };
  sellerContext?: {
    reputationLevel?: string | null;
    isMercadoLider?: boolean;
    totalSales?: number | null;
  };
  visualScore?: number | null;
  ads?: {
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    cpc: number | null;
    spend: number | null;
    revenueAttributed: number | null;
    roas: number | null;
    ordersAttributed: number | null;
    adsEfficiency: 'excellent' | 'good' | 'breakeven' | 'losing' | null;
  } | null;
  personalization?: ListingPersonalizationContext;
}
