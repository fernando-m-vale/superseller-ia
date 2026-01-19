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
 * @returns Array de ações priorizadas e ordenadas
 */
export function generateActionPlan(
  scoreBreakdown: IAScoreBreakdown,
  dataQuality: DataQuality,
  potentialGain?: IAScorePotentialGain,
  mediaInfo?: MediaInfo
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

