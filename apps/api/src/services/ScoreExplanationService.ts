/**
 * Score Explanation Service
 * 
 * Explica o score de forma clara e determinística.
 * Gera frases explicativas por dimensão baseadas no breakdown e dataQuality.
 */

import { IAScoreBreakdown } from './IAScoreService';
import { DataQuality } from './ScoreActionEngine';

export interface MediaInfo {
  hasClips: boolean | null; // null = indisponível via API (no ML, clip = vídeo)
  picturesCount: number | null;
}

/**
 * Gera explicação do score baseado no breakdown e data quality
 * 
 * @param scoreBreakdown - Breakdown do score por dimensão
 * @param dataQuality - Qualidade e disponibilidade dos dados
 * @param mediaInfo - Informações de mídia (has_video, pictures_count) para explicações precisas
 * @returns Array de frases explicativas (uma por dimensão relevante)
 */
export function explainScore(
  scoreBreakdown: IAScoreBreakdown,
  dataQuality: DataQuality,
  mediaInfo?: MediaInfo
): string[] {
  const explanations: string[] = [];

  // Cadastro (0-20)
  const cadastroLost = 20 - scoreBreakdown.cadastro;
  if (cadastroLost > 0) {
    explanations.push(`Cadastro perdeu ${cadastroLost} ponto${cadastroLost > 1 ? 's' : ''} porque o anúncio ainda não organiza com clareza todas as informações decisivas da oferta.`);
  } else if (scoreBreakdown.cadastro === 20) {
    explanations.push('Cadastro está completo (20/20 pontos).');
  }

  // Mídia (0-20) - seller-facing focado em galeria, sem mencionar clip
  const midiaLost = 20 - scoreBreakdown.midia;
  if (midiaLost > 0) {
    const picturesCount = mediaInfo?.picturesCount ?? 0;
    const reasons: string[] = [];

    if (picturesCount < 6) {
      reasons.push(`poucas imagens (${picturesCount})`);
    } else if (picturesCount < 8) {
      reasons.push(`galeria ainda curta para sustentar melhor a decisão (${picturesCount} imagens)`);
    } else {
      reasons.push('há espaço para melhorar contexto de uso, prova visual e ordem da galeria');
    }

    if (reasons.length > 0) {
      const reasonText = reasons.length === 1 
        ? reasons[0]
        : reasons.slice(0, -1).join(', ') + ' e ' + reasons[reasons.length - 1];
      explanations.push(`Mídia perdeu ${midiaLost} ponto${midiaLost > 1 ? 's' : ''} porque a apresentação visual ainda sofre com ${reasonText}.`);
    }
  } else if (scoreBreakdown.midia === 20) {
    const picturesCount = mediaInfo?.picturesCount ?? 0;

    if (picturesCount >= 8) {
      explanations.push(`Mídia está boa em fotos (${picturesCount}).`);
    } else if (picturesCount >= 6) {
      explanations.push(`Mídia está forte com galeria suficiente (${picturesCount} imagens).`);
    } else {
      explanations.push('Mídia está completa (20/20 pontos).');
    }
  }

  // Performance (0-30)
  if (!dataQuality.performanceAvailable) {
    explanations.push('Performance não foi avaliada devido à indisponibilidade de dados via API.');
  } else {
    const performanceLost = 30 - scoreBreakdown.performance;
    if (performanceLost > 0) {
      explanations.push(`Performance perdeu ${performanceLost} ponto${performanceLost > 1 ? 's' : ''}. O anúncio já mostra sinais mensuráveis, mas ainda não transforma descoberta em resultado comercial com consistência.`);
    } else if (scoreBreakdown.performance === 30) {
      explanations.push('Performance está excelente (30/30 pontos).');
    }
  }

  // SEO (0-20)
  const seoLost = 20 - scoreBreakdown.seo;
  if (seoLost > 0) {
    explanations.push(`SEO está em ${scoreBreakdown.seo}/20 e pode ser melhorado porque o anúncio ainda não compete tão bem nas buscas específicas nem traduz rápido os atributos procurados.`);
  } else if (scoreBreakdown.seo === 20) {
    explanations.push('SEO está otimizado (20/20 pontos).');
  }

  // Competitividade (0-10)
  const competitividadeLost = 10 - scoreBreakdown.competitividade;
  if (competitividadeLost > 0) {
    explanations.push(`Competitividade está em ${scoreBreakdown.competitividade}/10 porque a oferta ainda não sustenta com força suficiente sua posição comercial em preço, condição ou valor percebido.`);
  } else if (scoreBreakdown.competitividade === 10) {
    explanations.push('Competitividade está no máximo (10/10 pontos).');
  }

  // Se nenhuma explicação foi gerada (caso raro - score perfeito)
  if (explanations.length === 0) {
    explanations.push('Seu anúncio está com score máximo em todas as dimensões!');
  }

  return explanations;
}
