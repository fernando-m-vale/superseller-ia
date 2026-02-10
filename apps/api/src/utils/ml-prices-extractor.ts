/**
 * Helper para extrair preços do comprador do payload /items/{id}/prices do Mercado Livre
 * 
 * Este helper é usado quando USE_ML_PRICES_FOR_PROMO=true para garantir que
 * o preço promocional reflete exatamente o que o comprador vê na página pública do ML.
 */

export interface BuyerPricesResult {
  originalPrice?: number;
  promotionalPrice?: number;
  discountPercent?: number;
  hasPromotionEffective: boolean;
}

/**
 * Extrai preços do comprador do payload /items/{id}/prices
 * 
 * Regras:
 * - type === "standard" → originalPrice = amount
 * - type === "promotion" → promotionalPrice = amount, regular = regular_amount
 * - Se tiver promotion.amount e (promotion.regular_amount ou standard.amount) e promotion.amount < regular
 *   então hasPromotionEffective = true
 * - discountPercent = round(((regular - promo)/regular)*100) (inteiro)
 */
export function extractBuyerPricesFromMlPrices(payload: {
  prices?: Array<{
    type?: string;
    amount?: number;
    regular_amount?: number;
    currency_id?: string;
  }>;
}): BuyerPricesResult {
  const result: BuyerPricesResult = {
    hasPromotionEffective: false,
  };

  if (!payload.prices || !Array.isArray(payload.prices)) {
    return result;
  }

  // Encontrar entrada "standard" (preço original)
  const standardEntry = payload.prices.find(p => p.type === 'standard');
  const standardAmount = standardEntry?.amount;

  // Encontrar entrada "promotion" (preço promocional)
  const promotionEntry = payload.prices.find(p => p.type === 'promotion');
  const promotionAmount = promotionEntry?.amount;
  const promotionRegularAmount = promotionEntry?.regular_amount;

  // Determinar preço original (regular)
  const regularPrice = promotionRegularAmount ?? standardAmount;

  // Se não tiver preço regular, não há como calcular promoção
  if (regularPrice === undefined || regularPrice === null || regularPrice <= 0) {
    return result;
  }

  result.originalPrice = regularPrice;

  // Se tiver preço promocional e for menor que o regular, há promoção efetiva
  if (promotionAmount !== undefined && promotionAmount !== null && promotionAmount > 0) {
    if (promotionAmount < regularPrice) {
      result.promotionalPrice = promotionAmount;
      result.hasPromotionEffective = true;
      
      // Calcular desconto percentual (inteiro)
      const discount = ((regularPrice - promotionAmount) / regularPrice) * 100;
      result.discountPercent = Math.round(discount);
    } else {
      // Preço promocional >= regular, não há promoção efetiva
      result.promotionalPrice = promotionAmount;
      result.hasPromotionEffective = false;
    }
  } else {
    // Sem preço promocional, usar preço regular como promocional
    result.promotionalPrice = regularPrice;
    result.hasPromotionEffective = false;
  }

  return result;
}
