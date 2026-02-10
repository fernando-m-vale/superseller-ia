/**
 * Utilitário para determinar se devemos buscar preços promocionais via /items/{id}/prices
 * com base em TTL (Time To Live) para evitar rate limits e controlar custos.
 */

/**
 * Determina se devemos buscar preços via /items/{id}/prices para um listing
 * 
 * Regras:
 * - Se USE_ML_PRICES_FOR_PROMO != "true" => false
 * - Se listingDb.promotion_checked_at é null => true (nunca foi verificado)
 * - Se now - promotion_checked_at > TTL (PROMO_PRICES_TTL_HOURS, default 12) => true (expirado)
 * - Caso contrário => false (ainda válido, não precisa buscar)
 * 
 * @param listingDb Listing do DB (pode ser null se listing não existe ainda)
 * @param now Data/hora atual (default: new Date())
 * @returns true se devemos buscar /prices, false caso contrário
 */
export function shouldFetchMlPricesForPromo(
  listingDb: { promotion_checked_at: Date | null } | null,
  now: Date = new Date()
): boolean {
  // Verificar flag de feature
  const useMlPricesForPromo = process.env.USE_ML_PRICES_FOR_PROMO === 'true';
  if (!useMlPricesForPromo) {
    return false;
  }

  // Se listing não existe ou nunca foi verificado, buscar
  if (!listingDb || !listingDb.promotion_checked_at) {
    return true;
  }

  // Calcular TTL em horas (default 12)
  const ttlHours = parseInt(process.env.PROMO_PRICES_TTL_HOURS || '12', 10);
  if (isNaN(ttlHours) || ttlHours <= 0) {
    // TTL inválido, usar default seguro
    return true;
  }

  // Calcular diferença em horas
  const checkedAt = new Date(listingDb.promotion_checked_at);
  const diffMs = now.getTime() - checkedAt.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // Se expirou (diferença > TTL), buscar novamente
  return diffHours >= ttlHours;
}

/**
 * Obtém o TTL configurado em horas
 */
export function getPromoPricesTtlHours(): number {
  const ttlHours = parseInt(process.env.PROMO_PRICES_TTL_HOURS || '12', 10);
  return isNaN(ttlHours) || ttlHours <= 0 ? 12 : ttlHours;
}
