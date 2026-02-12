/**
 * Promo Text Utils
 * 
 * Helpers determinísticos para formatação de preços e textos de promoção.
 * NUNCA depende do LLM para valores monetários.
 */

/**
 * Formata valor monetário em BRL
 * @param value Valor numérico
 * @returns String formatada como "R$ 100,00"
 */
export function formatMoneyBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Constrói texto de promoção determinístico
 * 
 * Regras:
 * - Se hasPromotion && originalPrice && finalPrice && originalPrice > finalPrice:
 *     return `de ${formatMoneyBRL(original)} por ${formatMoneyBRL(final)}`
 * - Se hasPromotion && finalPrice:
 *     return `por ${formatMoneyBRL(final)}`
 * - Se original == final, NUNCA retornar "de ... por ...", usar apenas "por ..."
 * - Senão return null
 */
export function buildPromoText(params: {
  hasPromotion: boolean;
  originalPrice: number | null | undefined;
  finalPrice: number | null | undefined;
}): string | null {
  const { hasPromotion, originalPrice, finalPrice } = params;

  if (!hasPromotion) {
    return null;
  }

  // Se não tem finalPrice, não pode construir texto de promoção
  if (finalPrice === null || finalPrice === undefined || isNaN(finalPrice)) {
    return null;
  }

  // Se tem originalPrice válido e é maior que finalPrice, usar formato "de X por Y"
  if (
    originalPrice !== null &&
    originalPrice !== undefined &&
    !isNaN(originalPrice) &&
    originalPrice > finalPrice
  ) {
    return `de ${formatMoneyBRL(originalPrice)} por ${formatMoneyBRL(finalPrice)}`;
  }

  // Caso contrário, usar apenas "por Y"
  return `por ${formatMoneyBRL(finalPrice)}`;
}

/**
 * Calcula percentual de desconto
 */
export function calculateDiscountPercent(
  originalPrice: number | null | undefined,
  finalPrice: number | null | undefined
): number | null {
  if (
    originalPrice === null ||
    originalPrice === undefined ||
    isNaN(originalPrice) ||
    finalPrice === null ||
    finalPrice === undefined ||
    isNaN(finalPrice) ||
    originalPrice <= 0 ||
    originalPrice <= finalPrice
  ) {
    return null;
  }

  const discount = ((originalPrice - finalPrice) / originalPrice) * 100;
  return Math.round(discount * 100) / 100; // Arredondar para 2 casas decimais
}

/**
 * Sanitiza texto removendo padrões incorretos de promoção e substituindo por promoText
 * 
 * Remove padrões como:
 * - "de R$ X por R$ Y" onde X == Y
 * - "de R$ X por R$ X"
 * 
 * E substitui por promoText quando disponível
 */
export function sanitizePromoText(
  text: string,
  promoText: string | null
): string {
  if (!text) {
    return text;
  }

  // Se não tem promoText, apenas remover padrões incorretos
  if (!promoText) {
    // Remover padrão "de R$ X por R$ X" (mesmo valor)
    const samePricePattern = /de\s+R\$\s*([\d.,]+)\s+por\s+R\$\s*\1/gi;
    return text.replace(samePricePattern, (match, price) => {
      return `por ${formatMoneyBRL(parseFloat(price.replace(',', '.')))}`;
    });
  }

  // Se tem promoText, substituir qualquer padrão de promoção pelo texto correto
  // Padrões a substituir:
  // - "de R$ X por R$ Y"
  // - "por R$ X" (quando promoText tem "de ... por ...")
  
  let sanitized = text;

  // Substituir padrão "de R$ X por R$ Y" pelo promoText
  const dePorPattern = /de\s+R\$\s*[\d.,]+\s+por\s+R\$\s*[\d.,]+/gi;
  sanitized = sanitized.replace(dePorPattern, promoText);

  // Se promoText começa com "de", também substituir "por R$ X" isolado
  if (promoText.startsWith('de ')) {
    const porPattern = /por\s+R\$\s*[\d.,]+/gi;
    sanitized = sanitized.replace(porPattern, promoText);
  }

  return sanitized;
}

/**
 * Remove emojis de um texto
 */
export function removeEmojis(text: string): string {
  if (!text) {
    return text;
  }

  // Regex para remover emojis (incluindo variações de cor de pele e flags)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{3297}-\u{3299}]/gu;
  
  return text.replace(emojiRegex, '').trim();
}

/**
 * Remove preços do título (números monetários)
 */
export function removePricesFromTitle(title: string): string {
  if (!title) {
    return title;
  }

  // Remover padrões como "R$ 100", "R$100", "100,00", "R$ 100,00", etc.
  const pricePatterns = [
    /R\$\s*[\d.,]+/gi,
    /[\d.,]+\s*reais?/gi,
    /[\d.,]+\s*R\$/gi,
  ];

  let cleaned = title;
  for (const pattern of pricePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Limpar espaços extras
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
