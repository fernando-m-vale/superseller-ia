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
  // HOTFIX 09.5: CTA opcional para tornar o hack acionável
  suggestedActionUrl?: string | null;
  // HOTFIX 09.8: categoryId para botão "Ver categoria"
  categoryId?: string | null;
  // HOTFIX 09.10: Permalink oficial da categoria (ao invés de inventar URL)
  categoryPermalink?: string | null;
}

function normalizeMlbId(listingIdExt?: string): string | null {
  if (!listingIdExt || !listingIdExt.trim()) return null;
  const cleaned = listingIdExt.trim().replace(/-/g, '');
  const digitMatches = cleaned.match(/\d{6,}/g);
  if (!digitMatches || digitMatches.length === 0) {
    const anyDigits = cleaned.match(/\d+/g);
    if (anyDigits && anyDigits.length > 0) {
      return anyDigits.reduce((max, current) => (current.length > max.length ? current : max));
    }
    return null;
  }
  return digitMatches.reduce((max, current) => (current.length > max.length ? current : max));
}

function buildMercadoLivreEditUrl(listingIdExt?: string): string | null {
  const normalizedId = normalizeMlbId(listingIdExt);
  if (!normalizedId) return null;
  return `https://www.mercadolivre.com.br/anuncios/MLB${normalizedId}/modificar/bomni`;
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
  // HOTFIX 09.10: Permalink oficial da categoria
  categoryPermalink?: string | null;
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
  
  // HOTFIX 09.1: Gate para shippingMode unknown
  // Se shippingMode === 'unknown' E isFullEligible !== true → omit (genérico e inseguro)
  if (signals.shippingMode === 'unknown' && signals.isFullEligible !== true) {
    return { score: 0, shouldOmit: true, blocking: false };
  }
  
  let score = 0;
  let blocking = false;
  
  // Gate: isFullEligible === false → blocking=true e cap confidence ≤ 35
  if (signals.isFullEligible === false) {
    blocking = true;
    score = Math.min(score, 35); // Cap at 35
  }
  
  // HOTFIX 09.1: Se shippingMode === 'unknown' MAS isFullEligible === true
  // Permitir sugerir, mas com confidence cap ≤ 35 e blocking=false
  if (signals.shippingMode === 'unknown' && signals.isFullEligible === true) {
    blocking = false; // Não é blocking, mas precisa de atenção
    // Cap será aplicado no final
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
  
  // HOTFIX 09.1: Aplicar cap ≤ 35 se shippingMode unknown mas isFullEligible === true
  if (signals.shippingMode === 'unknown' && signals.isFullEligible === true) {
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
 * Gate:
 * - variationsCount >= 5 → omitir completamente
 * 
 * Pontuação:
 * +25 visits ≥ 200
 * +20 CR < 2%
 * +15 hasVariations=false
 * +10 picturesCount ≥ 6
 * +10 categoryId presente
 * +10 qty ≥ 5
 * 
 * -15 picturesCount < 4
 * -15 visits < 80
 */
function evaluateMlSmartVariations(signals: ListingSignals): { score: number; shouldOmit: boolean } {
  // HOTFIX 09.3: Gate explícito - omitir se variationsCount >= 5
  if ((signals.variationsCount ?? 0) >= 5) {
    return { score: 0, shouldOmit: true };
  }
  
  let score = 0;
  
  // Pontuação positiva
  if ((signals.metrics30d?.visits ?? 0) >= 200) score += 25;
  if ((signals.metrics30d?.conversionRate ?? 100) < 2) score += 20;
  if (signals.hasVariations === false) score += 15;
  if ((signals.picturesCount ?? 0) >= 6) score += 10;
  if (signals.categoryId) score += 10;
  if ((signals.availableQuantity ?? 0) >= 5) score += 10;
  
  // Pontuação negativa
  if ((signals.picturesCount ?? 0) < 4) score -= 15;
  if ((signals.metrics30d?.visits ?? 0) < 80) score -= 15;
  
  // Normalizar para 0-100
  score = Math.max(0, Math.min(100, score));
  
  return { score, shouldOmit: false };
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

  // HOTFIX 09.5: Se benchmark (baselineConversion) disponível, calibrar com diferença significativa (>30%)
  const listingCR = signals.metrics30d?.conversionRate ?? null;
  const benchmarkCR = signals.benchmark?.baselineConversionRate ?? null;
  if (
    listingCR !== null &&
    benchmarkCR !== null &&
    benchmarkCR > 0 &&
    (signals.metrics30d?.visits ?? 0) >= 200
  ) {
    const ratio = listingCR / benchmarkCR;
    // Se conversão do anúncio está >30% abaixo do baseline da categoria, reforçar sugestão de revisão da categoria
    if (ratio < 0.7) score += 25;
    // Se conversão está acima do baseline, reduzir motivação
    if (ratio >= 1.0) score -= 10;
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
 * - já termina .90/.99 → omit
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
function evaluateMlPsychologicalPricing(
  signals: ListingSignals,
  listingId: string
): {
  score: number;
  shouldOmit: boolean;
  debug?: {
    currentPriceUsed: number;
    cents: number;
    hasPromotion: boolean;
    decision: string;
    reason: string;
  };
} {
  // HOTFIX 09.10: Usar preço efetivo atual (com promoção se aplicável)
  // Preferir promotionalPrice se disponível e diferente de price, senão usar price
  const currentPriceUsed = signals.promotionalPrice && signals.promotionalPrice !== signals.price
    ? signals.promotionalPrice
    : signals.price;
  
  // Gate: price < 20 → omit
  if (currentPriceUsed < 20) {
    const debug = {
      currentPriceUsed,
      cents: 0,
      hasPromotion: signals.hasPromotion || false,
      decision: 'blocked',
      reason: 'price < 20',
    };
    // HOTFIX 09.10: Log temporário para debug
    if (process.env.DEBUG_PSYCHOLOGICAL_PRICING === '1' || process.env.NODE_ENV === 'development') {
      console.log('[HACK-ENGINE] ml_psychological_pricing BLOCKED', { listingId, ...debug });
    }
    return { score: 0, shouldOmit: true, debug };
  }
  
  // HOTFIX 09.10: Gate: já termina .90/.99 → omit (trabalhar com centavos como inteiro)
  // Converter preço para centavos de forma segura (evitar problemas de float)
  // Usar string para evitar problemas de precisão: ex: 66.90 → "66.90" → 6690 centavos
  const priceStr = currentPriceUsed.toFixed(2);
  const priceInCents = Math.round(parseFloat(priceStr) * 100);
  const cents = priceInCents % 100; // Últimos 2 dígitos (centavos)
  
  // Se termina em 90 ou 99 centavos, não sugerir
  if (cents === 90 || cents === 99) {
    const debug = {
      currentPriceUsed,
      cents,
      hasPromotion: signals.hasPromotion || false,
      decision: 'blocked',
      reason: `cents === ${cents} (já termina em .90 ou .99)`,
    };
    // HOTFIX 09.10: Log temporário para debug
    if (process.env.DEBUG_PSYCHOLOGICAL_PRICING === '1' || process.env.NODE_ENV === 'development') {
      console.log('[HACK-ENGINE] ml_psychological_pricing BLOCKED', { listingId, ...debug });
    }
    return { score: 0, shouldOmit: true, debug };
  }
  
  const centsStr = priceStr.slice(-2);
  
  let score = 0;
  
  // Pontuação positiva
  if ((signals.metrics30d?.visits ?? 0) >= 300) score += 25;
  if ((signals.metrics30d?.conversionRate ?? 100) < 2) score += 20;
  
  // Preço redondo (.00/.50) - usar cents (number) para comparação
  if (cents === 0 || cents === 50) score += 15;
  
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
  
  const debug = {
    currentPriceUsed,
    cents,
    hasPromotion: signals.hasPromotion || false,
    decision: score > 0 ? 'suggested' : 'blocked',
    reason: score > 0 ? 'score > 0' : 'score === 0 (sem sinais suficientes)',
  };
  // HOTFIX 09.10: Log temporário para debug
  if (process.env.DEBUG_PSYCHOLOGICAL_PRICING === '1' || process.env.NODE_ENV === 'development') {
    console.log(`[HACK-ENGINE] ml_psychological_pricing ${score > 0 ? 'SUGGESTED' : 'BLOCKED'}`, { listingId, ...debug });
  }
  
  return { score, shouldOmit: score === 0, debug };
}

/**
 * Gera hacks baseados em signals
 */
export function generateHacks(input: HackEngineInput): HackEngineOutput {
  const { signals, history, listingId, nowUtc, categoryPermalink } = input;
  const suggestedEditUrl = buildMercadoLivreEditUrl(input.listingIdExt);
  
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
        suggestedActionUrl: suggestedEditUrl,
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
        suggestedActionUrl: suggestedEditUrl,
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
    const result = evaluateMlSmartVariations(signals);
    if (!result.shouldOmit && result.score > 0) {
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
        confidence: result.score,
        confidenceLevel: getConfidenceLevel(result.score),
        evidence: [
          `Visitas (30d): ${signals.metrics30d?.visits ?? 0}`,
          `Taxa de conversão: ${signals.metrics30d?.conversionRate?.toFixed(2) ?? 'N/A'}%`,
          `Imagens: ${signals.picturesCount ?? 0}`,
        ],
        suggestedActionUrl: suggestedEditUrl,
      });
    } else if (result.shouldOmit) {
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
      const listingCR = signals.metrics30d?.conversionRate ?? null;
      const benchmarkCR = signals.benchmark?.baselineConversionRate ?? null;
      const hasBenchmarkCR = benchmarkCR !== null && benchmarkCR !== undefined && benchmarkCR > 0;
      const categoryText =
        signals.categoryPath && signals.categoryPath.length > 0
          ? signals.categoryPath.join(' > ')
          : signals.categoryId
            ? `Categoria não resolvida (ID: ${signals.categoryId})`
            : 'Não definida';

      hacks.push({
        id: 'ml_category_adjustment',
        title: hasBenchmarkCR ? 'Revisar Categoria (baseado em conversão)' : 'Verificar Categoria Específica',
        summary: hasBenchmarkCR
          ? 'A conversão do anúncio está descolada do baseline da categoria. Vale revisar se a categoria está específica e correta.'
          : 'Sem benchmark suficiente para afirmar erro. Vale validar se a categoria está específica e correta.',
        why: (() => {
          const reasons: string[] = [
            'Categoria influencia buscas, filtros e público que encontra o anúncio',
            'Uma categoria muito genérica pode reduzir relevância e conversão',
          ];
          if (hasBenchmarkCR && listingCR !== null && listingCR !== undefined) {
            const deltaPct = Math.round(((benchmarkCR! - listingCR) / benchmarkCR!) * 100);
            if (deltaPct >= 30) reasons.push(`Sua conversão está ~${deltaPct}% abaixo do baseline da categoria`);
          } else {
            reasons.push('Sem baseline de conversão disponível para comparar (ação preventiva)');
          }
          return reasons;
        })(),
        impact: 'medium',
        confidence: result.score,
        confidenceLevel: getConfidenceLevel(result.score),
        evidence: [
          `Categoria atual: ${categoryText}`,
          `Visitas (30d): ${signals.metrics30d?.visits ?? 0}`,
          `Pedidos (30d): ${signals.metrics30d?.orders ?? 0}`,
          ...(listingCR !== null && listingCR !== undefined ? [`Conversão atual: ${listingCR.toFixed(2)}%`] : []),
          ...(hasBenchmarkCR ? [`Baseline (categoria): ${(benchmarkCR as number).toFixed(2)}%`] : []),
        ],
        suggestedActionUrl: suggestedEditUrl,
        // HOTFIX 09.8: Incluir categoryId para botão "Ver categoria"
        categoryId: signals.categoryId || null,
        // HOTFIX 09.10: Incluir permalink oficial da categoria
        categoryPermalink: categoryPermalink || null,
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
    // HOTFIX 09.10: Passar listingId para debug
    const result = evaluateMlPsychologicalPricing(signals, listingId);
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
        suggestedActionUrl: suggestedEditUrl,
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
