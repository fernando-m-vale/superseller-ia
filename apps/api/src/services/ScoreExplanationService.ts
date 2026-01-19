/**
 * Score Explanation Service
 * 
 * Explica o score de forma clara e determinística.
 * Gera frases explicativas por dimensão baseadas no breakdown e dataQuality.
 */

import { IAScoreBreakdown } from './IAScoreService';
import { DataQuality } from './ScoreActionEngine';
import { getMediaVerdict } from '../utils/media-verdict';

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
    explanations.push(`Você perdeu ${cadastroLost} ponto${cadastroLost > 1 ? 's' : ''} em Cadastro por informações incompletas no anúncio.`);
  } else if (scoreBreakdown.cadastro === 20) {
    explanations.push('Cadastro está completo (20/20 pontos).');
  }

  // Mídia (0-20) - Usar MediaVerdict como fonte única de verdade (apenas hasClips)
  const midiaLost = 20 - scoreBreakdown.midia;
  if (midiaLost > 0) {
    const picturesCount = mediaInfo?.picturesCount ?? 0;
    const hasClips = mediaInfo?.hasClips;
    const verdict = getMediaVerdict(hasClips ?? null, picturesCount);
    
    // Construir explicação baseada no MediaVerdict
    const reasons: string[] = [];
    
    // Se tem clip detectado, não mencionar falta de clip
    if (verdict.hasClipDetected === true) {
      // Tem clip, só mencionar imagens se necessário
      if (picturesCount < 6) {
        reasons.push(`poucas imagens (${picturesCount})`);
      }
    } else if (verdict.hasClipDetected === false) {
      // Não tem clip (certeza) - pode mencionar
      reasons.push('não ter clip (vídeo)');
      if (picturesCount < 6) {
        reasons.push(`poucas imagens (${picturesCount})`);
      }
    } else {
      // hasClips === null: usar mensagem do verdict (sempre condicional)
      if (picturesCount >= 8) {
        explanations.push(
          `Você perdeu ${midiaLost} ponto${midiaLost > 1 ? 's' : ''} em Mídia. ` +
          `Fotos estão boas (${picturesCount}), mas ${verdict.message.toLowerCase()}`
        );
      } else if (picturesCount >= 6) {
        explanations.push(
          `Você perdeu ${midiaLost} ponto${midiaLost > 1 ? 's' : ''} em Mídia. ` +
          `Imagens estão suficientes (${picturesCount}), mas ${verdict.message.toLowerCase()}`
        );
      } else {
        reasons.push(`poucas imagens (${picturesCount})`);
        reasons.push(verdict.message.toLowerCase());
      }
    }
    
    // Se já não gerou explicação acima, construir com reasons
    if (reasons.length > 0 && !explanations.some(e => e.includes('Mídia'))) {
      const reasonText = reasons.length === 1 
        ? reasons[0]
        : reasons.slice(0, -1).join(', ') + ' e ' + reasons[reasons.length - 1];
      explanations.push(`Você perdeu ${midiaLost} ponto${midiaLost > 1 ? 's' : ''} em Mídia por ${reasonText}.`);
    }
  } else if (scoreBreakdown.midia === 20) {
    // Score máximo - usar MediaVerdict para mensagem
    const picturesCount = mediaInfo?.picturesCount ?? 0;
    const hasClips = mediaInfo?.hasClips;
    const verdict = getMediaVerdict(hasClips ?? null, picturesCount);
    
    if (verdict.hasClipDetected === true && picturesCount >= 6) {
      explanations.push('Mídia está forte: fotos e clip (vídeo) presentes.');
    } else if (picturesCount >= 8) {
      explanations.push(`Mídia está boa em fotos (${picturesCount}).`);
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
      explanations.push(`Você perdeu ${performanceLost} ponto${performanceLost > 1 ? 's' : ''} em Performance. Melhorar visitas, conversão ou pedidos pode aumentar o score.`);
    } else if (scoreBreakdown.performance === 30) {
      explanations.push('Performance está excelente (30/30 pontos).');
    }
  }

  // SEO (0-20)
  const seoLost = 20 - scoreBreakdown.seo;
  if (seoLost > 0) {
    explanations.push(`SEO pode ser melhorado para aumentar o CTR nas buscas (${scoreBreakdown.seo}/20 pontos).`);
  } else if (scoreBreakdown.seo === 20) {
    explanations.push('SEO está otimizado (20/20 pontos).');
  }

  // Competitividade (0-10)
  const competitividadeLost = 10 - scoreBreakdown.competitividade;
  if (competitividadeLost > 0) {
    explanations.push(`Competitividade pode ser melhorada através de preço e condições mais atraentes (${scoreBreakdown.competitividade}/10 pontos).`);
  } else if (scoreBreakdown.competitividade === 10) {
    explanations.push('Competitividade está no máximo (10/10 pontos).');
  }

  // Se nenhuma explicação foi gerada (caso raro - score perfeito)
  if (explanations.length === 0) {
    explanations.push('Seu anúncio está com score máximo em todas as dimensões!');
  }

  return explanations;
}

