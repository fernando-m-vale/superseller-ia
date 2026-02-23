/**
 * SignalsBuilder - DIA 09
 * 
 * Extrai signals determinísticos de um listing para alimentar o HackEngine.
 * 100% determinístico, baseado apenas em dados auditáveis.
 */

import { Listing, ListingStatus } from '@prisma/client';

export interface ListingSignals {
  status: 'active' | 'paused' | 'closed' | 'unknown';
  categoryId?: string;
  categoryPath?: string[];
  isCatalog?: boolean;

  price: number;
  originalPrice?: number | null;
  hasPromotion: boolean;
  discountPercent?: number | null;
  currency: 'BRL';

  availableQuantity?: number | null;
  isOutOfStock?: boolean;

  shippingMode?: 'full' | 'flex' | 'me2' | 'unknown';
  isFreeShipping?: boolean;
  isFullEligible?: boolean;

  picturesCount?: number;
  hasVideo?: boolean;
  hasClips?: boolean;

  variationsCount?: number;
  hasVariations?: boolean;
  isKitHeuristic?: boolean;

  metrics30d?: {
    visits?: number | null;
    orders?: number | null;
    revenue?: number | null;
    conversionRate?: number | null;
  };

  benchmark?: {
    medianPrice?: number | null;
    p25Price?: number | null;
    p75Price?: number | null;
  };

  debug?: Record<string, unknown>;
}

export interface SignalsBuilderInput {
  listing: Listing;
  pricing?: {
    originalPrice?: number | null;
    promotionalPrice?: number | null;
    hasPromotion: boolean;
    discountPercent?: number | null;
  };
  shipping?: {
    mode?: string | null;
    freeShipping?: boolean | null;
    fullEligible?: boolean | null;
  };
  metrics30d?: {
    visits?: number | null;
    orders?: number | null;
    revenue?: number | null;
    conversionRate?: number | null;
  };
  benchmark?: {
    medianPrice?: number | null;
    p25Price?: number | null;
    p75Price?: number | null;
  };
}

/**
 * Determina se um listing é um kit/combo baseado em heurísticas determinísticas.
 * 
 * Regras:
 * - Título contém: "kit", "combo", "conjunto", "c/" (case-insensitive)
 * - OU variationsCount >= 2 e título sugere múltiplos itens
 * 
 * Sem LLM. Totalmente determinístico.
 */
export function isKitHeuristic(listing: Listing, variationsCount?: number | null): boolean {
  const title = (listing.title || '').toLowerCase();
  
  // Palavras-chave que indicam kit/combo
  const kitKeywords = ['kit', 'combo', 'conjunto', 'c/'];
  const hasKitKeyword = kitKeywords.some(keyword => title.includes(keyword));
  
  if (hasKitKeyword) {
    return true;
  }
  
  // Se tem variações e título sugere múltiplos itens
  if (variationsCount !== null && variationsCount !== undefined && variationsCount >= 2) {
    // Palavras que sugerem múltiplos itens
    const multiItemKeywords = ['+', 'e', 'com', 'pack', 'pacote', 'lote'];
    const hasMultiItemKeyword = multiItemKeywords.some(keyword => title.includes(keyword));
    
    if (hasMultiItemKeyword) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extrai shipping mode de string para enum
 */
function parseShippingMode(mode?: string | null): 'full' | 'flex' | 'me2' | 'unknown' {
  if (!mode) return 'unknown';
  
  const normalized = mode.toLowerCase();
  if (normalized.includes('full')) return 'full';
  if (normalized.includes('flex')) return 'flex';
  if (normalized.includes('me2')) return 'me2';
  
  return 'unknown';
}

/**
 * Constrói signals determinísticos a partir de um listing e dados relacionados.
 */
export function buildSignals(input: SignalsBuilderInput): ListingSignals {
  const { listing, pricing, shipping, metrics30d, benchmark } = input;
  
  // Status
  let status: 'active' | 'paused' | 'closed' | 'unknown' = 'unknown';
  if (listing.status === ListingStatus.active) status = 'active';
  else if (listing.status === ListingStatus.paused) status = 'paused';
  else if (listing.status === ListingStatus.deleted) status = 'closed';
  
  // Category
  const categoryId = listing.category || undefined;
  const categoryPath = categoryId ? categoryId.split('/').filter(Boolean) : undefined;
  
  // Pricing
  const price = Number(listing.price);
  const originalPrice = pricing?.originalPrice ?? listing.original_price ? Number(listing.original_price) : null;
  const hasPromotion = pricing?.hasPromotion ?? listing.has_promotion ?? false;
  const discountPercent = pricing?.discountPercent ?? listing.discount_percent ?? null;
  
  // Stock
  const availableQuantity = listing.stock ?? null;
  const isOutOfStock = (listing.stock ?? 0) <= 0;
  
  // Shipping
  const shippingMode = parseShippingMode(shipping?.mode);
  const isFreeShipping = shipping?.freeShipping ?? false;
  const isFullEligible = shipping?.fullEligible ?? false;
  
  // Media
  const picturesCount = listing.pictures_count ?? 0;
  const hasVideo = listing.has_video ?? false;
  const hasClips = listing.has_clips ?? null;
  
  // HOTFIX 09.2: Variations - usar campo variations_count persistido no sync
  // Fonte de verdade: listing.variations_count (extraído do item.variations no sync ML)
  const variationsCount = listing.variations_count ?? 0;
  const hasVariations = variationsCount > 0;
  
  // Kit heuristic
  const isKitHeuristicValue = isKitHeuristic(listing, variationsCount);
  
  // Metrics
  const metrics = metrics30d ? {
    visits: metrics30d.visits ?? null,
    orders: metrics30d.orders ?? null,
    revenue: metrics30d.revenue ?? null,
    conversionRate: metrics30d.conversionRate ?? null,
  } : undefined;
  
  // Benchmark
  const benchmarkData = benchmark ? {
    medianPrice: benchmark.medianPrice ?? null,
    p25Price: benchmark.p25Price ?? null,
    p75Price: benchmark.p75Price ?? null,
  } : undefined;
  
  return {
    status,
    categoryId,
    categoryPath,
    isCatalog: false, // TODO: extrair de listing se disponível
    
    price,
    originalPrice,
    hasPromotion,
    discountPercent,
    currency: 'BRL',
    
    availableQuantity,
    isOutOfStock,
    
    shippingMode,
    isFreeShipping,
    isFullEligible,
    
    picturesCount,
    hasVideo,
    hasClips: hasClips ?? undefined,
    
    variationsCount: variationsCount ?? undefined,
    hasVariations,
    isKitHeuristic: isKitHeuristicValue,
    
    metrics30d: metrics,
    benchmark: benchmarkData,
    
    debug: {
      listingId: listing.id,
      listingIdExt: listing.listing_id_ext,
      title: listing.title?.substring(0, 50),
    },
  };
}
