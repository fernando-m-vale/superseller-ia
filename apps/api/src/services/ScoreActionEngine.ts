/**
 * Score Action Engine
 * 
 * Converte scoreBreakdown + dataQuality em plano de ação priorizado.
 * Nenhuma ação contradiz dataQuality (ex: não gera action de performance se performanceAvailable=false).
 * Todas as regras são determinísticas (sem LLM).
 */

import { IAScoreBreakdown, IAScorePotentialGain } from './IAScoreService';

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
 * @returns Array de ações priorizadas e ordenadas
 */
export function generateActionPlan(
  scoreBreakdown: IAScoreBreakdown,
  dataQuality: DataQuality,
  potentialGain?: IAScorePotentialGain
): ActionPlanItem[] {
  const actions: ActionPlanItem[] = [];

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

    // Calcular score esperado após correção (assumindo recuperar todos os pontos perdidos)
    const expectedScoreAfterFix = Math.min(maxScore, currentScore + lostPoints);

    // Determinar prioridade
    let priority: ActionPriority;
    if (lostPoints >= 10) {
      priority = 'high';
    } else if (lostPoints >= 5) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Gerar whyThisMatters baseado na dimensão e contexto
    const whyThisMatters = generateWhyThisMatters(dimension, dataQuality, potentialGain?.[dimension]);

    actions.push({
      dimension,
      lostPoints,
      whyThisMatters,
      expectedScoreAfterFix,
      priority,
    });
  }

  // Ordenar por:
  // 1) maior lostPoints (decrescente)
  // 2) prioridade (high > medium > low)
  actions.sort((a, b) => {
    // Primeiro por lostPoints (maior primeiro)
    if (b.lostPoints !== a.lostPoints) {
      return b.lostPoints - a.lostPoints;
    }
    // Depois por prioridade
    const priorityOrder: Record<ActionPriority, number> = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return actions;
}

/**
 * Gera explicação do porquê essa dimensão importa
 * 
 * @param dimension - Dimensão da ação
 * @param dataQuality - Qualidade dos dados (para casos especiais)
 * @param potentialGain - Potencial de ganho da dimensão (opcional)
 * @returns Texto explicativo
 */
function generateWhyThisMatters(
  dimension: ActionDimension,
  dataQuality: DataQuality,
  potentialGain?: string
): string {
  // Caso especial: performance indisponível (não deve chegar aqui, mas proteção)
  if (dimension === 'performance' && !dataQuality.performanceAvailable) {
    return 'A performance não pôde ser avaliada por indisponibilidade de dados via API.';
  }

  // Texto base
  let text = WHY_THIS_MATTERS_BASE[dimension];

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

