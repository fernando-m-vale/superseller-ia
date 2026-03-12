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
  // HOTFIX 09.10: Preço promocional (preço efetivo atual)
  promotionalPrice?: number | null;
  hasPromotion: boolean;
  discountPercent?: number | null;
  currency: 'BRL';

  availableQuantity?: number | null;
  isOutOfStock?: boolean;

  shippingMode?: 'full' | 'flex' | 'me2' | 'unknown';
  isFreeShipping?: boolean;
  isFullEligible?: boolean | null;
  logisticType?: string | null;

  picturesCount?: number;
  hasVideo?: boolean;
  // Tri-state (HOTFIX 09.5): true (tem), false (não tem), null (não detectável via API)
  hasClips?: boolean | null;

  variationsCount?: number;
  hasVariations?: boolean;
  isKitHeuristic?: boolean;
  listingTypeId?: string | null;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
  condition?: string | null;
  warranty?: string | null;
  hasBrand?: boolean;
  hasModel?: boolean;
  hasGtin?: boolean;
  hasWarranty?: boolean;
  questionsCount?: number | null;
  reviewsCount?: number | null;
  ratingAverage?: number | null;
  reviewHealth?: 'strong' | 'weak' | 'risk' | 'unknown';
  socialProofStrength?: 'strong' | 'moderate' | 'weak' | 'unknown';
  moderationStatus?: string | null;
  moderationSubStatus?: string | null;
  qualityGrade?: string | null;

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
    baselineConversionRate?: number | null;
    baselineConversionConfidence?: 'high' | 'medium' | 'low' | 'unavailable' | null;
    baselineSampleSize?: number | null;
  };

  debug?: Record<string, unknown>;
}

export interface SignalsBuilderInput {
  listing: Listing;
  // HOTFIX 09.5: permitir injetar breadcrumb/nome da categoria (ex: via cache/API ML no handler)
  categoryPath?: string[] | null;
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
    logisticType?: string | null;
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
    baselineConversionRate?: number | null;
    baselineConversionConfidence?: 'high' | 'medium' | 'low' | 'unavailable' | null;
    baselineSampleSize?: number | null;
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

function getReviewHealth(listing: Listing): 'strong' | 'weak' | 'risk' | 'unknown' {
  const ratingAverage = listing.rating_average ? Number(listing.rating_average) : null;
  const reviewsCount = listing.reviews_count ?? 0;

  if (!reviewsCount || reviewsCount <= 0 || ratingAverage === null) return 'unknown';
  if (ratingAverage < 4) return 'risk';
  if (ratingAverage >= 4.5 && reviewsCount >= 20) return 'strong';
  return 'weak';
}

function getSocialProofStrength(listing: Listing): 'strong' | 'moderate' | 'weak' | 'unknown' {
  const reviewsCount = listing.reviews_count ?? 0;
  const questionsCount = listing.questions_count ?? 0;

  if (reviewsCount >= 50) return 'strong';
  if (reviewsCount >= 10 || questionsCount >= 5) return 'moderate';
  if (reviewsCount > 0 || questionsCount > 0) return 'weak';
  return 'unknown';
}

/**
 * Constrói signals determinísticos a partir de um listing e dados relacionados.
 */
export function buildSignals(input: SignalsBuilderInput): ListingSignals {
  const { listing, pricing, shipping, metrics30d, benchmark, categoryPath: categoryPathOverride } = input;
  
  // Status
  let status: 'active' | 'paused' | 'closed' | 'unknown' = 'unknown';
  if (listing.status === ListingStatus.active) status = 'active';
  else if (listing.status === ListingStatus.paused) status = 'paused';
  else if (listing.status === ListingStatus.deleted) status = 'closed';
  
  // Category
  const categoryId = listing.category || undefined;
  // HOTFIX 09.5: categoryPath deve ser breadcrumb textual (ex: Moda > Meias > 3D).
  // Não inferir a partir do categoryId (MLBxxxx). Se existir override (via handler), usar.
  const categoryPath = categoryPathOverride ?? undefined;
  
  // Pricing
  const price = Number(listing.price);
  const originalPrice = pricing?.originalPrice ?? (listing.original_price ? Number(listing.original_price) : (listing.price_base ? Number(listing.price_base) : null));
  // HOTFIX 09.10: Preço promocional (preço efetivo atual, com promoção se aplicável)
  const promotionalPrice = pricing?.promotionalPrice ?? (listing.price_effective ? Number(listing.price_effective) : (listing.has_promotion && listing.price_final ? Number(listing.price_final) : null));
  const hasPromotion = pricing?.hasPromotion ?? listing.has_promotion ?? false;
  const discountPercent = pricing?.discountPercent ?? listing.discount_percent ?? null;
  
  // Stock
  const availableQuantity = listing.stock ?? null;
  const isOutOfStock = (listing.stock ?? 0) <= 0;
  
  // Shipping
  const shippingMode = parseShippingMode(shipping?.mode ?? listing.shipping_mode);
  const isFreeShipping = shipping?.freeShipping ?? listing.is_free_shipping ?? false;
  const isFullEligible = shipping?.fullEligible ?? listing.is_full_eligible ?? null;
  const logisticType = shipping?.logisticType ?? listing.logistic_type ?? null;
  
  // Media
  const picturesCount = listing.pictures_count ?? 0;
  const hasVideo = listing.has_video ?? false;
  // HOTFIX 09.7: Preservar tri-state hasClips (true/false/null) - NÃO converter null para false
  // true = tem clip confirmado, false = confirmado que não tem, null = não detectável via API
  const hasClips = listing.has_clips ?? null;
  
  // HOTFIX 09.10: Log temporário para validação (hasClips + debug vídeo/clip)
  if (process.env.NODE_ENV === 'development' || process.env.LOG_SIGNALS === 'true' || process.env.DEBUG_MEDIA === '1') {
    let picturesJsonInfo: Record<string, unknown> | null = null;
    let picturesJsonParseError: string | null = null;
    if (listing.pictures_json) {
      try {
        const raw = typeof listing.pictures_json === 'string' ? JSON.parse(listing.pictures_json) : listing.pictures_json;
        if (Array.isArray(raw)) {
          picturesJsonInfo = {
            count: raw.length,
            hasVideoField: raw.some((p: any) => Boolean(p?.video_id || p?.video_url || p?.type === 'video')),
            hasClipField: raw.some((p: any) => Boolean(p?.clip_id || p?.clip_url || p?.type === 'clip')),
          };
        } else {
          picturesJsonInfo = {
            type: typeof raw,
            isArray: false,
          };
        }
      } catch (e) {
        picturesJsonParseError = 'Failed to parse pictures_json';
      }
    }

    console.log('[SIGNALS-BUILDER] hasClips tri-state:', {
      listingId: listing.id,
      listingIdExt: listing.listing_id_ext,
      hasClipsRaw: listing.has_clips,
      hasClipsFinal: hasClips,
      type: typeof hasClips,
      hasVideo: listing.has_video,
      picturesCount: listing.pictures_count,
      // HOTFIX 09.10: Informações do payload ML (se disponível em pictures_json)
      picturesJsonType: listing.pictures_json ? typeof listing.pictures_json : 'null',
      picturesJsonInfo,
      picturesJsonParseError,
    });
  }
  
  // HOTFIX 09.2: Variations - usar campo variations_count persistido no sync
  // Fonte de verdade: listing.variations_count (extraído do item.variations no sync ML)
  const variationsCount = listing.variations_count ?? 0;
  const hasVariations = variationsCount > 0;
  const listingTypeId = listing.listing_type_id ?? null;
  const brand = listing.brand ?? null;
  const model = listing.model ?? null;
  const gtin = listing.gtin ?? null;
  const condition = listing.condition ?? null;
  const warranty = listing.warranty ?? null;
  const questionsCount = listing.questions_count ?? null;
  const reviewsCount = listing.reviews_count ?? null;
  const ratingAverage = listing.rating_average ? Number(listing.rating_average) : null;
  const reviewHealth = getReviewHealth(listing);
  const socialProofStrength = getSocialProofStrength(listing);
  const moderationStatus = listing.moderation_status ?? null;
  const moderationSubStatus = listing.moderation_sub_status ?? null;
  const qualityGrade = listing.quality_grade ?? null;
  
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
    baselineConversionRate: benchmark.baselineConversionRate ?? null,
    baselineConversionConfidence: benchmark.baselineConversionConfidence ?? null,
    baselineSampleSize: benchmark.baselineSampleSize ?? null,
  } : undefined;
  
  return {
    status,
    categoryId,
    categoryPath,
    isCatalog: false, // TODO: extrair de listing se disponível
    
    price,
    originalPrice,
    promotionalPrice, // HOTFIX 09.10: Preço promocional
    hasPromotion,
    discountPercent,
    currency: 'BRL',
    
    availableQuantity,
    isOutOfStock,
    
    shippingMode,
    isFreeShipping,
    isFullEligible,
    logisticType,

    picturesCount,
    hasVideo,
    hasClips,
    
    variationsCount: variationsCount ?? undefined,
    hasVariations,
    isKitHeuristic: isKitHeuristicValue,
    listingTypeId,
    brand,
    model,
    gtin,
    condition,
    warranty,
    hasBrand: Boolean(brand),
    hasModel: Boolean(model),
    hasGtin: Boolean(gtin),
    hasWarranty: Boolean(warranty),
    questionsCount,
    reviewsCount,
    ratingAverage,
    reviewHealth,
    socialProofStrength,
    moderationStatus,
    moderationSubStatus,
    qualityGrade,
    
    metrics30d: metrics,
    benchmark: benchmarkData,
    
    debug: {
      listingId: listing.id,
      listingIdExt: listing.listing_id_ext,
      title: listing.title?.substring(0, 50),
    },
  };
}
