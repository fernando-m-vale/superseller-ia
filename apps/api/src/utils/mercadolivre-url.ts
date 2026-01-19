/**
 * Mercado Livre URL Utilities
 * 
 * Funções para construir URLs corretas do Mercado Livre para anúncios.
 */

export type MercadoLivreUrlMode = 'edit' | 'view';

/**
 * Normaliza listingIdExt para extrair apenas os dígitos numéricos do MLB ID
 * 
 * Aceita formatos:
 * - "MLB3923303743"
 * - "3923303743"
 * - "MLB-3923303743"
 * 
 * @param listingIdExt - ID externo do listing (pode ter prefixo MLB ou não)
 * @returns ID numérico normalizado ou null se não encontrar dígitos válidos
 */
export function normalizeMlbId(listingIdExt: string | null | undefined): string | null {
  if (!listingIdExt || !listingIdExt.trim()) return null;
  
  // Remover espaços e hífens
  const cleaned = listingIdExt.trim().replace(/-/g, '');
  
  // Extrair apenas dígitos (usar regex para encontrar sequência de 6+ dígitos)
  const digitMatches = cleaned.match(/\d{6,}/g);
  
  if (!digitMatches || digitMatches.length === 0) {
    // Fallback: tentar qualquer sequência de dígitos
    const anyDigits = cleaned.match(/\d+/g);
    if (anyDigits && anyDigits.length > 0) {
      // Escolher o maior número encontrado
      return anyDigits.reduce((max, current) => current.length > max.length ? current : max);
    }
    return null;
  }
  
  // Escolher o maior número encontrado (normalmente será o MLB ID completo)
  return digitMatches.reduce((max, current) => current.length > max.length ? current : max);
}

/**
 * Constrói URL do anúncio no Mercado Livre
 * 
 * @param listingIdExt - ID externo do listing (ex: MLB3923303743)
 * @param permalink - Permalink do anúncio (opcional, preferido se disponível)
 * @param mode - Modo da URL: 'edit' (painel do vendedor) ou 'view' (página de compra). Default: 'edit'
 * @returns URL do anúncio ou null se não for possível construir
 */
export function buildMercadoLivreListingUrl(
  listingIdExt: string | null,
  permalink?: string | null,
  mode: MercadoLivreUrlMode = 'edit'
): string | null {
  // Normalizar ID usando helper
  const normalizedId = normalizeMlbId(listingIdExt);

  // MODE: 'edit' - Painel do vendedor (edição)
  if (mode === 'edit') {
    if (normalizedId) {
      // URL de edição: https://www.mercadolivre.com.br/anuncios/MLB{ID}/modificar/bomni
      return `https://www.mercadolivre.com.br/anuncios/MLB${normalizedId}/modificar/bomni`;
    }
    
    // Se não tiver normalizedId, tentar fallback para view
    return buildMercadoLivreListingUrl(listingIdExt, permalink, 'view');
  }

  // MODE: 'view' - Página pública de compra
  // Prioridade 1: Se existir permalink, usar diretamente
  if (permalink && permalink.trim().length > 0) {
    // Garantir que seja URL completa
    if (permalink.startsWith('http://') || permalink.startsWith('https://')) {
      return permalink;
    }
    // Se for relativo, adicionar domínio
    if (permalink.startsWith('/')) {
      return `https://produto.mercadolivre.com.br${permalink}`;
    }
    // Se não começar com /, assumir que é slug completo
    return `https://produto.mercadolivre.com.br/${permalink}`;
  }

  // Prioridade 2: Se existir listing_id_ext (MLB ID), construir URL pública
  if (normalizedId) {
    // URL pública do anúncio: https://produto.mercadolivre.com.br/MLB-{ID}
    return `https://produto.mercadolivre.com.br/MLB-${normalizedId}`;
  }

  // Não foi possível construir URL
  return null;
}

/**
 * Verifica se uma URL do Mercado Livre é válida
 * 
 * @param url - URL a verificar
 * @returns true se a URL parece válida
 */
export function isValidMercadoLivreUrl(url: string | null): boolean {
  if (!url) return false;
  
  const validPatterns = [
    /^https?:\/\/produto\.mercadolivre\.com\.br\/MLB-\d+/,
    /^https?:\/\/produto\.mercadolivre\.com\.br\/[^\/]+/,
    /^https?:\/\/www\.mercadolivre\.com\.br\/produto\/[^\/]+/,
  ];
  
  return validPatterns.some(pattern => pattern.test(url));
}

