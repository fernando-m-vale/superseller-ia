/**
 * Mercado Livre URL Utilities
 * 
 * Funções para construir URLs corretas do Mercado Livre para anúncios.
 */

/**
 * Constrói URL pública do anúncio no Mercado Livre
 * 
 * @param listingIdExt - ID externo do listing (ex: MLB3923303743)
 * @param permalink - Permalink do anúncio (opcional, preferido se disponível)
 * @returns URL pública do anúncio ou null se não for possível construir
 */
export function buildMercadoLivreListingUrl(
  listingIdExt: string | null,
  permalink?: string | null
): string | null {
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

  // Prioridade 2: Se existir listing_id_ext (MLB ID), construir URL
  if (listingIdExt && listingIdExt.trim().length > 0) {
    // Verificar se é formato MLB (ex: MLB3923303743)
    if (listingIdExt.startsWith('MLB') || listingIdExt.match(/^MLB\d+$/)) {
      // URL pública do anúncio: https://produto.mercadolivre.com.br/MLB-{ID}
      // Remover prefixo MLB se presente e adicionar hífen
      const id = listingIdExt.replace(/^MLB/, '');
      return `https://produto.mercadolivre.com.br/MLB-${id}`;
    }
    
    // Se não for formato MLB, tentar usar como ID numérico
    if (listingIdExt.match(/^\d+$/)) {
      return `https://produto.mercadolivre.com.br/MLB-${listingIdExt}`;
    }
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

