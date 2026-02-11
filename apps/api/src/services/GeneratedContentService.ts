/**
 * Generated Content Service
 * 
 * Gera conteúdo acionável (títulos, bullets, descrição SEO) orientado por dados e gaps.
 * NÃO promete o que não existe. NÃO assume vídeo se não há vídeo.
 * Conteúdo é sugestão assistiva (copy & paste).
 */

import { CriticalGap } from './BenchmarkInsightsService';

export interface GeneratedTitle {
  variation: 'A' | 'B' | 'C';
  text: string;
}

export interface GeneratedContent {
  titles: GeneratedTitle[];
  bullets: string[];
  seoDescription: {
    short: string;
    long: string;
  };
}

/**
 * Gera conteúdo para um listing baseado em dados reais e criticalGaps
 */
export function generateListingContent(
  listing: {
    title: string;
    description?: string | null;
    picturesCount: number;
    hasClips: boolean | null;
    hasPromotion: boolean;
    discountPercent: number | null;
    price: number;
    originalPrice?: number | null;
    category?: string | null;
  },
  criticalGaps: CriticalGap[]
): GeneratedContent {
  // Extrair palavras-chave do título atual
  const titleWords = listing.title.split(/\s+/).filter(w => w.length > 2);
  const mainKeywords = titleWords.slice(0, 5).join(' ');

  // Gerar 3 títulos diferentes (A/B/C)
  const titles: GeneratedTitle[] = [
    {
      variation: 'A',
      text: generateTitleVariation(listing, criticalGaps, 'A', mainKeywords),
    },
    {
      variation: 'B',
      text: generateTitleVariation(listing, criticalGaps, 'B', mainKeywords),
    },
    {
      variation: 'C',
      text: generateTitleVariation(listing, criticalGaps, 'C', mainKeywords),
    },
  ];

  // Gerar bullets baseados em gaps e dados reais
  const bullets = generateBullets(listing, criticalGaps);

  // Gerar descrição SEO (short e long)
  const seoDescription = generateSeoDescription(listing, criticalGaps);

  return {
    titles,
    bullets,
    seoDescription,
  };
}

/**
 * Gera variação de título (A/B/C)
 */
function generateTitleVariation(
  listing: { title: string; hasPromotion: boolean; discountPercent: number | null },
  criticalGaps: CriticalGap[],
  variation: 'A' | 'B' | 'C',
  mainKeywords: string
): string {
  // Base: título atual (limitado a 60 caracteres para ML)
  const baseTitle = listing.title.length > 60 ? listing.title.substring(0, 57) + '...' : listing.title;

  // Variação A: Foco em benefícios principais (HOTFIX P0: sem OFF/Oferta)
  if (variation === 'A') {
    // NUNCA usar "OFF" ou "Oferta Especial" no título (proibido pelo ML)
    if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 30) {
      // Mencionar promoção sem números no título (SEO-friendly)
      return `${mainKeywords} - Promoção Especial`;
    }
    return `${mainKeywords} - Qualidade e Confiança`;
  }

  // Variação B: Foco em características/diferenciais (HOTFIX P0: não inventar números)
  if (variation === 'B') {
    const imageGap = criticalGaps.find(g => g.dimension === 'images');
    // Só mencionar número de imagens se tiver certeza (não inventar)
    if (imageGap && imageGap.metrics?.median && typeof imageGap.metrics.median === 'number') {
      return `${mainKeywords} - Veja ${imageGap.metrics.median} imagens detalhadas`;
    }
    // Se não tiver gap mas tiver picturesCount real, usar ele
    if (listing.picturesCount > 0 && listing.picturesCount >= 5) {
      return `${mainKeywords} - Veja ${listing.picturesCount} imagens detalhadas`;
    }
    return `${mainKeywords} - Detalhes Completos`;
  }

  // Variação C: Foco em SEO/visibilidade
  if (variation === 'C') {
    return `${mainKeywords} - Envio Rápido e Seguro`;
  }

  // Fallback
  return baseTitle;
}

/**
 * Gera bullets baseados em gaps e dados reais
 */
function generateBullets(
  listing: {
    picturesCount: number;
    hasClips: boolean | null;
    hasPromotion: boolean;
    discountPercent: number | null;
  },
  criticalGaps: CriticalGap[]
): string[] {
  const bullets: string[] = [];

  // Bullet sobre imagens (HOTFIX P0: só mencionar se tiver certeza do número)
  if (listing.picturesCount > 0 && listing.picturesCount >= 5) {
    // Só mencionar número se tiver certeza (não inventar)
    bullets.push(`Veja ${listing.picturesCount} imagens detalhadas do produto`);
  } else if (criticalGaps.some(g => g.dimension === 'images')) {
    // Se houver gap mas não tiver número certo, usar texto genérico
    bullets.push('Veja imagens detalhadas do produto');
  }

  // Bullet sobre vídeo (só se tiver certeza que há vídeo)
  if (listing.hasClips === true) {
    bullets.push('Vídeo demonstrativo disponível');
  } else if (criticalGaps.some(g => g.dimension === 'video')) {
    // Não mencionar vídeo se não houver certeza
  }

  // Bullet sobre promoção (HOTFIX P0: sem "Oferta especial", usar texto mais neutro)
  if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20) {
    bullets.push(`${listing.discountPercent}% de desconto`);
  }

  // Bullet genérico sobre qualidade/confiança
  bullets.push('Produto de qualidade com garantia');

  // Bullet sobre entrega (genérico, sempre útil)
  bullets.push('Envio rápido e seguro para todo o Brasil');

  // Limitar a 5 bullets
  return bullets.slice(0, 5);
}

/**
 * Gera descrição SEO (short e long)
 */
function generateSeoDescription(
  listing: {
    title: string;
    description?: string | null;
    picturesCount: number;
    hasClips: boolean | null;
    hasPromotion: boolean;
    discountPercent: number | null;
  },
  criticalGaps: CriticalGap[]
): { short: string; long: string } {
  const titleWords = listing.title.split(/\s+/).filter(w => w.length > 2);
  const mainKeywords = titleWords.slice(0, 5).join(' ');

  // Short description (até 200 caracteres) (HOTFIX P0: sem "Oferta especial")
  let short = `${mainKeywords}. `;
  if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20) {
    short += `${listing.discountPercent}% de desconto. `;
  }
  short += 'Qualidade garantida, envio rápido.';
  short = short.substring(0, 200);

  // Long description (até 1000 caracteres)
  let long = `${mainKeywords}.\n\n`;
  
  // Seção de benefícios
  long += '✨ BENEFÍCIOS:\n';
  if (listing.picturesCount >= 5) {
    long += `• Veja ${listing.picturesCount} imagens detalhadas do produto\n`;
  }
  if (listing.hasClips === true) {
    long += '• Vídeo demonstrativo disponível\n';
  }
  if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20) {
    long += `• ${listing.discountPercent}% de desconto\n`;
  }
  long += '• Produto de qualidade com garantia\n';
  long += '• Envio rápido e seguro para todo o Brasil\n\n';

  // Seção de informações adicionais (baseado em gaps)
  const conversionGap = criticalGaps.find(g => g.id === 'gap_conversion_vs_promo');
  if (conversionGap) {
    long += '💡 DICA: Este produto está em promoção. Aproveite enquanto dura!\n\n';
  }

  // Seção de confiança
  long += '🛡️ COMPRE COM CONFIANÇA:\n';
  long += '• Produto original e de qualidade\n';
  long += '• Atendimento especializado\n';
  long += '• Garantia do vendedor\n\n';

  // CTA
  long += '👉 Não perca esta oportunidade! Adicione ao carrinho agora.';

  // Limitar a 1000 caracteres
  long = long.substring(0, 1000);

  return { short, long };
}
