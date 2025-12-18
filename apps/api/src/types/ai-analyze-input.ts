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
 * Dados de mídia do anúncio
 */
export interface AIAnalyzeInputMedia {
  imageCount: number;
  hasImages: boolean;
  hasVideo: boolean;
  videoCount: number;
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
 * Qualidade dos dados enviados
 */
export interface AIAnalyzeInputDataQuality {
  missing: string[];
  warnings: string[];
  completenessScore: number;
  sources: {
    performance: 'listing_metrics_daily' | 'listing_aggregates';
  };
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

