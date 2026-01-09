/**
 * Mercado Livre URL Utilities
 * 
 * Funções para construir URLs corretas do Mercado Livre para anúncios.
 */

export type MercadoLivreUrlMode = 'edit' | 'view';

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
  // Extrair ID numérico do listingIdExt (remover prefixo MLB se presente)
  const extractNumericId = (id: string): string | null => {
    if (!id || !id.trim()) return null;
    
    // Se começa com MLB, remover prefixo
    if (id.startsWith('MLB')) {
      return id.replace(/^MLB/, '');
    }
    
    // Se é só números, usar diretamente
    if (id.match(/^\d+$/)) {
      return id;
    }
    
    return null;
  };

  // MODE: 'edit' - Painel do vendedor (edição)
  if (mode === 'edit') {
    const numericId = listingIdExt ? extractNumericId(listingIdExt) : null;
    
    if (numericId) {
      // URL de edição: https://www.mercadolivre.com.br/anuncios/MLB{ID}/modificar/bomni
      return `https://www.mercadolivre.com.br/anuncios/MLB${numericId}/modificar/bomni`;
    }
    
    // Se não tiver numericId, tentar fallback para view
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
  if (listingIdExt && listingIdExt.trim().length > 0) {
    const numericId = extractNumericId(listingIdExt);
    
    if (numericId) {
      // URL pública do anúncio: https://produto.mercadolivre.com.br/MLB-{ID}
      return `https://produto.mercadolivre.com.br/MLB-${numericId}`;
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

