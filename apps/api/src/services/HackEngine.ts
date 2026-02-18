/**
 * HackEngine v1 - DIA 09
 * 
 * Engine determinístico para gerar hacks específicos e acionáveis baseados em signals.
 * 100% determinístico, baseado apenas em dados auditáveis.
 */

import { ListingSignals } from './SignalsBuilder';

export type HackId = 
  | 'ml_full_shipping'
  | 'ml_bundle_kit'
  | 'ml_smart_variations'
  | 'ml_category_adjustment'
  | 'ml_psychological_pricing';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface HackSuggestion {
  id: HackId;
  title: string;
  summary: string;
  why: string[];
  impact: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  evidence: string[];
}

export interface HackEngineMeta {
  rulesEvaluated: number;
  rulesTriggered: number;
  skippedBecauseOfHistory: number;
  skippedBecauseOfRequirements: number;
}

export interface HackEngineInput {
  version: 'v1';
  marketplace: 'mercadolivre';
  tenantId: string;
  listingId: string;
  listingIdExt?: string;
  signals: ListingSignals;
  history?: Array<{
    hackId: string;
    status: 'confirmed' | 'dismissed';
    dismissedAt?: Date | null;
  }>;
  nowUtc: Date;
}

export interface HackEngineOutput {
  version: 'v1';
  listingId: string;
  generatedAtUtc: Date;
  hacks: HackSuggestion[];
  meta: HackEngineMeta;
}

/**
 * Calcula confidence level a partir de score (0-100)
 */
function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Verifica se hack foi confirmado (nunca sugerir novamente)
 */
function isHackConfirmed(history: HackEngineInput['history'], hackId: HackId): boolean {
  if (!history) return false;
  return history.some(h => h.hackId === hackId && h.status === 'confirmed');
}

/**
 * Verifica se hack foi dismissed há menos de 30 dias (cooldown)
 */
function isHackInCooldown(history: HackEngineInput['history'], hackId: HackId, nowUtc: Date): boolean {
  if (!history) return false;
  
  const hackHistory = history.find(h => h.hackId === hackId && h.status === 'dismissed');
  if (!hackHistory || !hackHistory.dismissedAt) return false;
  
  const daysSinceDismissed = Math.floor(
    (nowUtc.getTime() - new Date(hackHistory.dismissedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceDismissed < 30;
}

/**
 * Hack 1: ml_full_shipping
 * 
 * Gate:
 * - shippingMode === 'full' → omit
 * - isFullEligible === false → blocking=true e cap confidence ≤ 35
 * 
 * Pontuação:
 * +25 visits ≥ 300
 * +20 conversionRate < 2%
 * +15 shippingMode me2/unknown
 * +10 isFreeShipping=false
 * +10 estoque ≥5 ou null
 * 
 * -20 visits < 100
 * -15 outOfStock ou qty=0
 * -10 price < 30
 */
function evaluateMlFullShipping(signals: ListingSignals): { score: number; shouldOmit: boolean; blocking: boolean } {
  // Gate: shippingMode === 'full' → omit
  if (signals.shippingMode === 'full') {
    return { score: 0, shouldOmit: true, blocking: false };
  }
  
  let score = 0;
  let blocking = false;
  
  // Gate: isFullEligible === false → blocking=true e cap confidence ≤ 35
  if (signals.isFullEligible === false) {
    blocking = true;
    score = Math.min(score, 35); // Cap at 35
  }
  
  // Pontuação positiva
  if ((signals.metrics30d?.visits ?? 0) >= 300) score += 25;
  if ((signals.metrics30d?.conversionRate ?? 100) < 2) score += 20;
  if (signals.shippingMode === 'me2' || signals.shippingMode === 'unknown') score += 15;
  if (signals.isFreeShipping === false) score += 10;
  if ((signals.availableQuantity ?? 0) >= 5 || signals.availableQuantity === null) score += 10;
  
  // Pontuação negativa
  if ((signals.metrics30d?.visits ?? 0) < 100) score -= 20;
  if (signals.isOutOfStock || (signals.availableQuantity ?? 0) === 0) score -= 15;
  if (signals.price < 30) score -= 10;
  
  // Aplicar cap se blocking
  if (blocking) {
    score = Math.min(score, 35);
  }
  
  // Normalizar para 0-100
  score = Math.max(0, Math.min(100, score));
  
  return { score, shouldOmit: false, blocking };
}

/**
 * Hack 2: ml_bundle_kit
 * 
 * Gate:
 * - isKitHeuristic === true → omit
 * 
 * Pontuação:
 * +25 visits ≥ 200
 * +20 conversionRate < 1.5%
 * +15 price ≤ 120
 * +10 qty ≥ 10
 * +10 variationsCount ≥ 2
 * +10 promo ≥ 20%
 * 
 * -20 qty ≤ 2
 * -15 orders ≥ 15 e CR ≥ 3%
 * -10 isCatalog
 */
function evaluateMlBundleKit(signals: ListingSignals): { score: number; shouldOmit: boolean } {
  // Gate: isKitHeuristic === true → omit
  if (signals.isKitHeuristic === true) {
    return { score: 0, shouldOmit: true };
  }
  
  let score = 0;
  
  // Pontuação positiva
  if ((signals.metrics30d?.visits ?? 0) >= 200) score += 25;
  if ((signals.metrics30d?.conversionRate ?? 100) < 1.5) score += 20;
  if (signals.price <= 120) score += 15;
  if ((signals.availableQuantity ?? 0) >= 10) score += 10;
  if ((signals.variationsCount ?? 0) >= 2) score += 10;
  if ((signals.discountPercent ?? 0) >= 20) score += 10;
  
  // Pontuação negativa
  if ((signals.availableQuantity ?? 0) <= 2) score -= 20;
  if ((signals.metrics30d?.orders ?? 0) >= 15 && (signals.metrics30d?.conversionRate ?? 0) >= 3) score -= 15;
  if (signals.isCatalog === true) score -= 10;
  
  // Normalizar para 0-100
  score = Math.max(0, Math.min(100, score));
  
  return { score, shouldOmit: false };
}

/**
 * Hack 3: ml_smart_variations
 * 
 * Pontuação:
 * +25 visits ≥ 200
 * +20 CR < 2%
 * +15 hasVariations=false
 * +10 picturesCount ≥ 6
 * +10 categoryId presente
 * +10 qty ≥ 5
 * 
 * -25 variationsCount ≥ 5
 * -15 picturesCount < 4
 * -15 visits < 80
 */
function evaluateMlSmartVariations(signals: ListingSignals): number {
  let score = 0;
  
  // Pontuação positiva
  if ((signals.metrics30d?.visits ?? 0) >= 200) score += 25;
  if ((signals.metrics30d?.conversionRate ?? 100) < 2) score += 20;
  if (signals.hasVariations === false) score += 15;
  if ((signals.picturesCount ?? 0) >= 6) score += 10;
  if (signals.categoryId) score += 10;
  if ((signals.availableQuantity ?? 0) >= 5) score += 10;
  
  // Pontuação negativa
  if ((signals.variationsCount ?? 0) >= 5) score -= 25;
  if ((signals.picturesCount ?? 0) < 4) score -= 15;
  if ((signals.metrics30d?.visits ?? 0) < 80) score -= 15;
  
  // Normalizar para 0-100
  score = Math.max(0, Math.min(100, score));
  
  return score;
}

/**
 * Hack 4: ml_category_adjustment
 * 
 * Gate:
 * - categoryId ausente → blocking=true cap ≤ 40
 * 
 * Pontuação:
 * +30 visits ≥ 300 e orders=0
 * +25 CR <1% e visits ≥ 200
 * +15 categoryPath depth ≤ 2
 * +10 isCatalog=false
 * +10 benchmark presente e preço dentro p25..p75
 * 
 * -20 orders ≥ 10
 * -15 visits < 100
 */
function evaluateMlCategoryAdjustment(signals: ListingSignals): { score: number; blocking: boolean } {
  let score = 0;
  let blocking = false;
  
  // Gate: categoryId ausente → blocking=true cap ≤ 40
  if (!signals.categoryId) {
    blocking = true;
    score = Math.min(score, 40); // Cap at 40
  }
  
  // Pontuação positiva
  if ((signals.metrics30d?.visits ?? 0) >= 300 && (signals.metrics30d?.orders ?? 0) === 0) score += 30;
  if ((signals.metrics30d?.conversionRate ?? 100) < 1 && (signals.metrics30d?.visits ?? 0) >= 200) score += 25;
  if (signals.categoryPath && signals.categoryPath.length <= 2) score += 15;
  if (signals.isCatalog === false) score += 10;
  if (
    signals.benchmark &&
    signals.benchmark.p25Price !== null &&
    signals.benchmark.p25Price !== undefined &&
    signals.benchmark.p75Price !== null &&
    signals.benchmark.p75Price !== undefined &&
    signals.price >= signals.benchmark.p25Price &&
    signals.price <= signals.benchmark.p75Price
  ) {
    score += 10;
  }
  
  // Pontuação negativa
  if ((signals.metrics30d?.orders ?? 0) >= 10) score -= 20;
  if ((signals.metrics30d?.visits ?? 0) < 100) score -= 15;
  
  // Aplicar cap se blocking
  if (blocking) {
    score = Math.min(score, 40);
  }
  
  // Normalizar para 0-100
  score = Math.max(0, Math.min(100, score));
  
  return { score, blocking };
}

/**
 * Hack 5: ml_psychological_pricing
 * 
 * Gate:
 * - price < 20 → omit
 * - já termina .90/.99/.89 → omit
 * 
 * Pontuação:
 * +25 visits ≥ 300
 * +20 CR <2%
 * +15 preço redondo (.00/.50)
 * +15 benchmark median e price até 10% acima
 * +10 sem promoção
 * 
 * -20 discount ≥ 30%
 * -15 orders ≥ 15
 * -15 visits < 120
 */
function evaluateMlPsychologicalPricing(signals: ListingSignals): { score: number; shouldOmit: boolean } {
  // Gate: price < 20 → omit
  if (signals.price < 20) {
    return { score: 0, shouldOmit: true };
  }
  
  // Gate: já termina .90/.99/.89 → omit
  const priceStr = signals.price.toFixed(2);
  const cents = priceStr.slice(-2);
  if (cents === '90' || cents === '99' || cents === '89') {
    return { score: 0, shouldOmit: true };
  }
  
  let score = 0;
  
  // Pontuação positiva
  if ((signals.metrics30d?.visits ?? 0) >= 300) score += 25;
  if ((signals.metrics30d?.conversionRate ?? 100) < 2) score += 20;
  
  // Preço redondo (.00/.50)
  if (cents === '00' || cents === '50') score += 15;
  
  // Benchmark median e price até 10% acima
  if (
    signals.benchmark &&
    signals.benchmark.medianPrice !== null &&
    signals.benchmark.medianPrice !== undefined &&
    signals.price <= signals.benchmark.medianPrice * 1.1
  ) {
    score += 15;
  }
  
  // Sem promoção
  if (!signals.hasPromotion) score += 10;
  
  // Pontuação negativa
  if ((signals.discountPercent ?? 0) >= 30) score -= 20;
  if ((signals.metrics30d?.orders ?? 0) >= 15) score -= 15;
  if ((signals.metrics30d?.visits ?? 0) < 120) score -= 15;
  
  // Normalizar para 0-100
  score = Math.max(0, Math.min(100, score));
  
  return { score, shouldOmit: false };
}

/**
 * Gera hacks baseados em signals
 */
export function generateHacks(input: HackEngineInput): HackEngineOutput {
  const { signals, history, listingId, nowUtc } = input;
  
  const hacks: HackSuggestion[] = [];
  let rulesEvaluated = 0;
  let rulesTriggered = 0;
  let skippedBecauseOfHistory = 0;
  let skippedBecauseOfRequirements = 0;
  
  // Hack 1: ml_full_shipping
  rulesEvaluated++;
  if (!isHackConfirmed(history, 'ml_full_shipping') && !isHackInCooldown(history, 'ml_full_shipping', nowUtc)) {
    const result = evaluateMlFullShipping(signals);
    if (!result.shouldOmit && result.score > 0) {
      rulesTriggered++;
      hacks.push({
        id: 'ml_full_shipping',
        title: 'Ativar Frete Grátis Full',
        summary: 'Ativar frete grátis Full pode aumentar significativamente a visibilidade e conversão do anúncio.',
        why: [
          'Frete grátis é um dos principais fatores de decisão de compra no Mercado Livre',
          'Anúncios com frete grátis aparecem em destaque nas buscas',
          'Aumenta a taxa de conversão e reduz o abandono de carrinho',
        ],
        impact: 'high',
        confidence: result.score,
        confidenceLevel: getConfidenceLevel(result.score),
        evidence: [
          `Modo de envio atual: ${signals.shippingMode}`,
          `Visitas (30d): ${signals.metrics30d?.visits ?? 0}`,
          `Taxa de conversão: ${signals.metrics30d?.conversionRate?.toFixed(2) ?? 'N/A'}%`,
        ],
      });
    } else if (result.shouldOmit) {
      skippedBecauseOfRequirements++;
    }
  } else {
    skippedBecauseOfHistory++;
  }
  
  // Hack 2: ml_bundle_kit
  rulesEvaluated++;
  if (!isHackConfirmed(history, 'ml_bundle_kit') && !isHackInCooldown(history, 'ml_bundle_kit', nowUtc)) {
    const result = evaluateMlBundleKit(signals);
    if (!result.shouldOmit && result.score > 0) {
      rulesTriggered++;
      const impact = result.score >= 70 ? 'high' : 'medium';
      hacks.push({
        id: 'ml_bundle_kit',
        title: 'Criar Kit/Combo',
        summary: 'Criar um kit ou combo pode aumentar o ticket médio e diferenciar o anúncio da concorrência.',
        why: [
          'Kits aumentam o valor médio do pedido',
          'Reduzem custos de frete por item',
          'Melhoram a percepção de valor pelo cliente',
        ],
        impact,
        confidence: result.score,
        confidenceLevel: getConfidenceLevel(result.score),
        evidence: [
          `Visitas (30d): ${signals.metrics30d?.visits ?? 0}`,
          `Taxa de conversão: ${signals.metrics30d?.conversionRate?.toFixed(2) ?? 'N/A'}%`,
          `Preço atual: R$ ${signals.price.toFixed(2)}`,
        ],
      });
    } else if (result.shouldOmit) {
      skippedBecauseOfRequirements++;
    }
  } else {
    skippedBecauseOfHistory++;
  }
  
  // Hack 3: ml_smart_variations
  rulesEvaluated++;
  if (!isHackConfirmed(history, 'ml_smart_variations') && !isHackInCooldown(history, 'ml_smart_variations', nowUtc)) {
    const score = evaluateMlSmartVariations(signals);
    if (score > 0) {
      rulesTriggered++;
      hacks.push({
        id: 'ml_smart_variations',
        title: 'Adicionar Variações Inteligentes',
        summary: 'Adicionar variações (tamanho, cor, modelo) pode aumentar significativamente as vendas.',
        why: [
          'Variações permitem que clientes encontrem exatamente o que procuram',
          'Aumentam o número de palavras-chave relevantes',
          'Melhoram a experiência de compra',
        ],
        impact: 'medium',
        confidence: score,
        confidenceLevel: getConfidenceLevel(score),
        evidence: [
          `Visitas (30d): ${signals.metrics30d?.visits ?? 0}`,
          `Taxa de conversão: ${signals.metrics30d?.conversionRate?.toFixed(2) ?? 'N/A'}%`,
          `Imagens: ${signals.picturesCount ?? 0}`,
        ],
      });
    } else {
      skippedBecauseOfRequirements++;
    }
  } else {
    skippedBecauseOfHistory++;
  }
  
  // Hack 4: ml_category_adjustment
  rulesEvaluated++;
  if (!isHackConfirmed(history, 'ml_category_adjustment') && !isHackInCooldown(history, 'ml_category_adjustment', nowUtc)) {
    const result = evaluateMlCategoryAdjustment(signals);
    if (result.score > 0) {
      rulesTriggered++;
      hacks.push({
        id: 'ml_category_adjustment',
        title: 'Ajustar Categoria',
        summary: 'A categoria correta é fundamental para que o anúncio apareça nas buscas certas.',
        why: [
          'Categoria incorreta reduz visibilidade nas buscas',
          'Pode afetar negativamente o algoritmo de ranking',
          'Clientes não encontram o produto nas categorias esperadas',
        ],
        impact: 'medium',
        confidence: result.score,
        confidenceLevel: getConfidenceLevel(result.score),
        evidence: [
          `Categoria atual: ${signals.categoryId || 'Não definida'}`,
          `Visitas (30d): ${signals.metrics30d?.visits ?? 0}`,
          `Pedidos (30d): ${signals.metrics30d?.orders ?? 0}`,
        ],
      });
    } else {
      skippedBecauseOfRequirements++;
    }
  } else {
    skippedBecauseOfHistory++;
  }
  
  // Hack 5: ml_psychological_pricing
  rulesEvaluated++;
  if (!isHackConfirmed(history, 'ml_psychological_pricing') && !isHackInCooldown(history, 'ml_psychological_pricing', nowUtc)) {
    const result = evaluateMlPsychologicalPricing(signals);
    if (!result.shouldOmit && result.score > 0) {
      rulesTriggered++;
      const impact = result.score >= 70 ? 'medium' : 'low';
      hacks.push({
        id: 'ml_psychological_pricing',
        title: 'Ajustar Preço Psicológico',
        summary: 'Preços que terminam em .90 ou .99 são percebidos como mais atrativos pelos consumidores.',
        why: [
          'Preços psicológicos aumentam a percepção de valor',
          'Melhoram a taxa de conversão',
          'Diferenciação visual na listagem de resultados',
        ],
        impact,
        confidence: result.score,
        confidenceLevel: getConfidenceLevel(result.score),
        evidence: [
          `Preço atual: R$ ${signals.price.toFixed(2)}`,
          `Visitas (30d): ${signals.metrics30d?.visits ?? 0}`,
          `Taxa de conversão: ${signals.metrics30d?.conversionRate?.toFixed(2) ?? 'N/A'}%`,
        ],
      });
    } else if (result.shouldOmit) {
      skippedBecauseOfRequirements++;
    }
  } else {
    skippedBecauseOfHistory++;
  }
  
  return {
    version: 'v1',
    listingId,
    generatedAtUtc: nowUtc,
    hacks,
    meta: {
      rulesEvaluated,
      rulesTriggered,
      skippedBecauseOfHistory,
      skippedBecauseOfRequirements,
    },
  };
}
