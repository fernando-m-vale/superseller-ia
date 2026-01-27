/**
 * AI Analyze Input V1
 * 
 * Payload canônico para análise de anúncios pela IA.
 * Versão 1: usa dados reais de 30 dias com fallback seguro.
 */

import { Marketplace, ListingStatus } from '@prisma/client';

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
  listing: AIAnalyzeInputListingV21;
  media: AIAnalyzeInputMedia;
  performance: AIAnalyzeInputPerformance;
  dataQuality: AIAnalyzeInputDataQualityV21;
}

