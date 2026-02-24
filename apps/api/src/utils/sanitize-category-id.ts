/**
 * Sanitiza categoryId do Mercado Livre para uso em URLs
 * HOTFIX 09.9: Garantir que categoryId seja válido antes de usar em URL
 */

/**
 * Sanitiza categoryId removendo espaços, caracteres inválidos e normalizando formato
 * @param categoryId ID da categoria (ex: "mlb271066 c", "MLB271066", "271066")
 * @returns ID sanitizado no formato MLBXXXXX ou null se inválido
 */
export function sanitizeCategoryId(categoryId: string | null | undefined): string | null {
  if (!categoryId || typeof categoryId !== 'string') {
    return null;
  }

  // Remover espaços e caracteres inválidos
  let sanitized = categoryId.trim().replace(/\s+/g, '').toUpperCase();

  // Remover caracteres não alfanuméricos (exceto MLB no início)
  sanitized = sanitized.replace(/[^A-Z0-9]/g, '');

  // Extrair dígitos e normalizar: sempre retornar MLB + dígitos (ignorar sufixos como "C")
  // Casos aceitos: "MLB271066", "mlb271066 c", "271066"
  let numbers = '';
  if (sanitized.startsWith('MLB')) {
    const match = sanitized.match(/^MLB(\d+)/);
    numbers = match?.[1] || '';
  } else {
    const match = sanitized.match(/(\d+)/);
    numbers = match?.[1] || '';
  }

  if (!numbers) {
    return null;
  }

  sanitized = `MLB${numbers}`;

  // Validar formato: MLB seguido de 6+ dígitos
  const categoryIdPattern = /^MLB\d{6,}$/;
  if (!categoryIdPattern.test(sanitized)) {
    console.warn('[SANITIZE-CATEGORY-ID] Formato inválido após sanitização', {
      original: categoryId,
      sanitized,
    });
    return null;
  }

  return sanitized;
}

/**
 * Constrói URL válida para categoria no Mercado Livre
 * @param categoryId ID da categoria (será sanitizado)
 * @returns URL completa ou null se categoryId inválido
 */
export function buildCategoryUrl(categoryId: string | null | undefined): string | null {
  const sanitized = sanitizeCategoryId(categoryId);
  if (!sanitized) {
    return null;
  }

  // URL padrão do Mercado Livre para categorias
  return `https://lista.mercadolivre.com.br/c/${sanitized}`;
}
