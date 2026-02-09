/**
 * Score Action Engine
 * 
 * Converte scoreBreakdown + dataQuality em plano de ação priorizado.
 * Nenhuma ação contradiz dataQuality (ex: não gera action de performance se performanceAvailable=false).
 * Todas as regras são determinísticas (sem LLM).
 */

import { IAScoreBreakdown, IAScorePotentialGain } from './IAScoreService';
import { getMediaVerdict } from '../utils/media-verdict';

export type ActionDimension = 'cadastro' | 'midia' | 'performance' | 'seo' | 'competitividade';

export type ActionPriority = 'high' | 'medium' | 'low';

export interface ActionPlanItem {
  dimension: ActionDimension;
  lostPoints: number;
  whyThisMatters: string;
  expectedScoreAfterFix: number;
  priority: ActionPriority;
}

export interface DataQuality {
  performanceAvailable: boolean;
  videoStatusKnown?: boolean; // false quando has_video = null (não detectável via API)
  visitsCoverage?: {
    filledDays: number;
    totalDays: number;
  };
  missing?: string[];
  warnings?: string[];
}

export interface MediaInfo {
  hasClips: boolean | null; // null = indisponível via API (no ML, clip = vídeo)
  picturesCount: number | null;
}

/**
 * Dados de pricing para calibração do engine
 */
export interface PricingInfo {
  hasPromotion: boolean;
  discountPercent: number | null;
}

/**
 * Dados de métricas dos últimos 30 dias
 */
export interface Metrics30dInfo {
  visits: number;
  orders: number;
  conversionRate: number | null;
  revenue?: number | null;
}

/**
 * Detecta se o listing tem promoção agressiva mas baixa conversão
 * 
 * Gatilho ativo quando:
 * - hasPromotion = true
 * - discountPercent >= PROMO_AGGRESSIVE_DISCOUNT_PCT
 * - visits >= MIN_VISITS_FOR_CR_CONFIDENCE (evitar ruído com pouco tráfego)
 * - conversionRate <= LOW_CR_THRESHOLD
 * - (opcional) orders <= LOW_ORDERS_THRESHOLD
 * 
 * @param pricing - Dados de pricing do listing
 * @param metrics30d - Métricas dos últimos 30 dias
 * @returns true se o gatilho está ativo
 */
export function detectPromoAggressiveLowCR(
  pricing: PricingInfo | null | undefined,
  metrics30d: Metrics30dInfo | null | undefined
): boolean {
  // Se não houver dados, não ativar gatilho
  if (!pricing || !metrics30d) {
    return false;
  }

  // Verificar promoção agressiva
  if (!pricing.hasPromotion) {
    return false;
  }

  if (pricing.discountPercent === null || pricing.discountPercent < PROMO_AGGRESSIVE_DISCOUNT_PCT) {
    return false;
  }

  // Verificar visitas mínimas (evitar ruído com pouco tráfego)
  if (metrics30d.visits < MIN_VISITS_FOR_CR_CONFIDENCE) {
    return false;
  }

  // Verificar conversão baixa
  if (metrics30d.conversionRate === null || metrics30d.conversionRate > LOW_CR_THRESHOLD) {
    return false;
  }

  // (Opcional) Reforçar com baixo número de pedidos
  // Se orders <= LOW_ORDERS_THRESHOLD, reforça o sinal de baixa conversão
  // Mas não é obrigatório para ativar o gatilho

  return true;
}

/**
 * Thresholds para detecção de "promoção agressiva + baixa conversão"
 * Valores ajustáveis para calibração do engine
 */
export const PROMO_AGGRESSIVE_DISCOUNT_PCT = 30; // Desconto >= 30% considerado agressivo
export const LOW_CR_THRESHOLD = 0.006; // <= 0.6% de conversão considerado baixo
export const MIN_VISITS_FOR_CR_CONFIDENCE = 150; // Mínimo de visitas para confiar na métrica de conversão
export const LOW_ORDERS_THRESHOLD = 2; // <= 2 pedidos considerado baixo (opcional, reforça baixa conversão)

/**
 * Máximos por dimensão (baseado na documentação IA_SCORE_V2.md)
 */
const MAX_SCORE_BY_DIMENSION: Record<ActionDimension, number> = {
  cadastro: 20,
  midia: 20,
  performance: 30,
  seo: 20,
  competitividade: 10,
};

/**
 * Textos base para whyThisMatters por dimensão
 */
const WHY_THIS_MATTERS_BASE: Record<ActionDimension, string> = {
  cadastro: 'Um cadastro completo melhora relevância e confiança do comprador.',
  midia: 'Anúncios com mídia mais completa tendem a gerar maior engajamento e conversão.',
  seo: 'Um título otimizado aumenta a visibilidade e o CTR nas buscas.',
  competitividade: 'Preço e condições competitivas influenciam a decisão de compra.',
  performance: 'Métricas de performance ajudam a identificar oportunidades de melhoria.',
};

/**
 * Gera plano de ação baseado no score breakdown e data quality
 * 
 * @param scoreBreakdown - Breakdown do score por dimensão
 * @param dataQuality - Qualidade e disponibilidade dos dados
 * @param potentialGain - Potencial de ganho por dimensão (opcional, para contexto)
 * @param mediaInfo - Informações de mídia para evitar ações incorretas (opcional)
 * @param pricing - Dados de pricing para calibração (opcional)
 * @param metrics30d - Métricas dos últimos 30 dias para calibração (opcional)
 * @returns Array de ações priorizadas e ordenadas
 */
export function generateActionPlan(
  scoreBreakdown: IAScoreBreakdown,
  dataQuality: DataQuality,
  potentialGain?: IAScorePotentialGain,
  mediaInfo?: MediaInfo,
  pricing?: PricingInfo | null,
  metrics30d?: Metrics30dInfo | null
): ActionPlanItem[] {
  const actions: ActionPlanItem[] = [];

  // Detectar gatilho "promoção agressiva + baixa conversão"
  const promoAggressiveLowCR = detectPromoAggressiveLowCR(pricing, metrics30d);

  // Processar cada dimensão
  const dimensions: ActionDimension[] = ['cadastro', 'midia', 'performance', 'seo', 'competitividade'];

  for (const dimension of dimensions) {
    const maxScore = MAX_SCORE_BY_DIMENSION[dimension];
    const currentScore = scoreBreakdown[dimension];
    const lostPoints = maxScore - currentScore;

    // Se lostPoints <= 0, não gerar ação
    if (lostPoints <= 0) {
      continue;
    }

    // PERFORMANCE: Se performanceAvailable = false, não gerar action
    if (dimension === 'performance' && !dataQuality.performanceAvailable) {
      continue;
    }

    // MÍDIA: Usar MediaVerdict como fonte única de verdade (apenas hasClips)
    if (dimension === 'midia') {
      const hasClips = mediaInfo?.hasClips;
      const picturesCount = mediaInfo?.picturesCount ?? 0;
      const verdict = getMediaVerdict(hasClips ?? null, picturesCount);
      
      // Se não pode sugerir clip (já tem ou null) e tem muitas imagens, não gerar ação
      if (!verdict.canSuggestClip && picturesCount >= 8) {
        // Mídia está completa, não gerar ação
        continue;
      }
      
      // Se tem clip detectado e imagens suficientes, não gerar ação
      if (verdict.hasClipDetected === true && picturesCount >= 6) {
        continue;
      }
    }

    // Calcular score esperado após correção (assumindo recuperar todos os pontos perdidos)
    const expectedScoreAfterFix = Math.min(maxScore, currentScore + lostPoints);

    // Determinar prioridade base
    let priority: ActionPriority;
    if (lostPoints >= 10) {
      priority = 'high';
    } else if (lostPoints >= 5) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Aplicar calibração para "promoção agressiva + baixa conversão"
    if (promoAggressiveLowCR) {
      // Boost: elevar prioridade de ações de título/imagens/descrição
      if (dimension === 'seo' || dimension === 'midia' || dimension === 'cadastro') {
        // Elevar prioridade: low -> medium, medium -> high, high permanece high
        if (priority === 'low') {
          priority = 'medium';
        } else if (priority === 'medium') {
          priority = 'high';
        }
        // Adicionar boost aos lostPoints para ordenação (sem alterar o valor real)
        // Isso será feito na ordenação final
      }
      
      // Penalty: reduzir prioridade de competitividade (promo highlight)
      // Nota: "competitividade" pode incluir promo highlight, mas não é exclusivo
      // Ainda assim, se há promo agressiva, não priorizar competitividade
      if (dimension === 'competitividade') {
        // Reduzir prioridade: high -> medium, medium -> low, low permanece low
        if (priority === 'high') {
          priority = 'medium';
        } else if (priority === 'medium') {
          priority = 'low';
        }
      }
    }

    // Gerar whyThisMatters baseado na dimensão e contexto
    const whyThisMatters = generateWhyThisMatters(
      dimension, 
      dataQuality, 
      potentialGain?.[dimension],
      mediaInfo
    );

    actions.push({
      dimension,
      lostPoints,
      whyThisMatters,
      expectedScoreAfterFix,
      priority,
    });
  }

  // Aplicar boost/penalty na ordenação se gatilho ativo
  if (promoAggressiveLowCR) {
    // Adicionar boost virtual aos lostPoints para ações de título/imagens/descrição
    actions.forEach((action) => {
      if (action.dimension === 'seo' || action.dimension === 'midia' || action.dimension === 'cadastro') {
        // Boost virtual: adicionar 20 pontos para ordenação (não altera lostPoints real)
        (action as any).sortBoost = action.lostPoints + 20;
      } else if (action.dimension === 'competitividade') {
        // Penalty virtual: subtrair 20 pontos para ordenação
        (action as any).sortBoost = action.lostPoints - 20;
      } else {
        (action as any).sortBoost = action.lostPoints;
      }
    });
  }

  // Ordenar por:
  // 1) maior lostPoints (ou sortBoost se gatilho ativo) (decrescente)
  // 2) prioridade (high > medium > low)
  actions.sort((a, b) => {
    const aPoints = promoAggressiveLowCR ? ((a as any).sortBoost ?? a.lostPoints) : a.lostPoints;
    const bPoints = promoAggressiveLowCR ? ((b as any).sortBoost ?? b.lostPoints) : b.lostPoints;
    
    // Primeiro por lostPoints (maior primeiro)
    if (bPoints !== aPoints) {
      return bPoints - aPoints;
    }
    // Depois por prioridade
    const priorityOrder: Record<ActionPriority, number> = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  // Limpar sortBoost (propriedade temporária)
  if (promoAggressiveLowCR) {
    actions.forEach((action) => {
      delete (action as any).sortBoost;
    });
  }

  return actions;
}

/**
 * Gera explicação do porquê essa dimensão importa
 * 
 * @param dimension - Dimensão da ação
 * @param dataQuality - Qualidade dos dados (para casos especiais)
 * @param potentialGain - Potencial de ganho da dimensão (opcional)
 * @param mediaInfo - Informações de mídia para explicações precisas (opcional)
 * @returns Texto explicativo
 */
function generateWhyThisMatters(
  dimension: ActionDimension,
  dataQuality: DataQuality,
  potentialGain?: string,
  mediaInfo?: MediaInfo
): string {
  // Caso especial: performance indisponível (não deve chegar aqui, mas proteção)
  if (dimension === 'performance' && !dataQuality.performanceAvailable) {
    return 'A performance não pôde ser avaliada por indisponibilidade de dados via API.';
  }

  // Texto base
  let text = WHY_THIS_MATTERS_BASE[dimension];

  // MÍDIA: Usar MediaVerdict como fonte única de verdade (apenas hasClips)
  if (dimension === 'midia') {
    const hasClips = mediaInfo?.hasClips;
    const picturesCount = mediaInfo?.picturesCount ?? 0;
    const verdict = getMediaVerdict(hasClips ?? null, picturesCount);
    
    // Usar mensagem do MediaVerdict como base
    if (verdict.hasClipDetected === true) {
      // Tem clip detectado
      if (picturesCount >= 8) {
        text = 'Mídia está completa com fotos e clip (vídeo).';
      } else {
        text = 'Anúncios com mais imagens tendem a gerar maior engajamento e conversão.';
      }
    } else if (verdict.hasClipDetected === false) {
      // Não tem clip (certeza) - pode sugerir
      if (picturesCount >= 8) {
        text = 'Anúncios com clip (vídeo) tendem a gerar maior engajamento e conversão.';
      } else {
        text = 'Anúncios com mídia mais completa (fotos e clip/vídeo) tendem a gerar maior engajamento e conversão.';
      }
    } else {
      // hasClips === null: usar mensagem do verdict (sempre condicional)
      if (picturesCount >= 8) {
        text = `Anúncios com clip (vídeo) tendem a gerar maior engajamento. ${verdict.message}`;
      } else {
        text = `Anúncios com mídia mais completa tendem a gerar maior engajamento e conversão. ${verdict.message}`;
      }
    }
  }

  // Adicionar contexto de potencial de ganho se disponível
  if (potentialGain) {
    text += ` Potencial de ganho: ${potentialGain} pontos no score.`;
  }

  // Adicionar contexto específico para performance se visitsCoverage baixo
  if (dimension === 'performance' && dataQuality.visitsCoverage) {
    const coverage = dataQuality.visitsCoverage.totalDays > 0
      ? (dataQuality.visitsCoverage.filledDays / dataQuality.visitsCoverage.totalDays) * 100
      : 0;
    if (coverage < 50) {
      text += ` Cobertura de dados de visitas: ${Math.round(coverage)}% (dados parciais).`;
    }
  }

  return text;
}

/**
 * Gera explicação do motor para "promoção agressiva + baixa conversão"
 * Usado internamente pelo engine, não pela IA
 */
export function getPromoAggressiveLowCRExplanation(): string {
  return 'Promoção forte já existe; conversão ainda baixa indica gargalo em CTR/qualificação/clareza. Priorize criativos e texto.';
}
