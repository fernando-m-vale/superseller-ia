/**
 * Score Explanation Service
 * 
 * Explica o score de forma clara e determinística.
 * Gera frases explicativas por dimensão baseadas no breakdown e dataQuality.
 */

import { IAScoreBreakdown } from './IAScoreService';
import { DataQuality } from './ScoreActionEngine';

/**
 * Gera explicação do score baseado no breakdown e data quality
 * 
 * @param scoreBreakdown - Breakdown do score por dimensão
 * @param dataQuality - Qualidade e disponibilidade dos dados
 * @returns Array de frases explicativas (uma por dimensão relevante)
 */
export function explainScore(
  scoreBreakdown: IAScoreBreakdown,
  dataQuality: DataQuality
): string[] {
  const explanations: string[] = [];

  // Cadastro (0-20)
  const cadastroLost = 20 - scoreBreakdown.cadastro;
  if (cadastroLost > 0) {
    explanations.push(`Você perdeu ${cadastroLost} ponto${cadastroLost > 1 ? 's' : ''} em Cadastro por informações incompletas no anúncio.`);
  } else if (scoreBreakdown.cadastro === 20) {
    explanations.push('Cadastro está completo (20/20 pontos).');
  }

  // Mídia (0-20)
  // IMPORTANTE: videoStatusKnown = false significa que has_video = null (não detectável via API)
  // Nesse caso, não afirmar ausência de vídeo/clips
  const midiaLost = 20 - scoreBreakdown.midia;
  if (midiaLost > 0) {
    if (dataQuality.videoStatusKnown === false) {
      // Não sabemos se tem vídeo - usar linguagem condicional
      if (midiaLost >= 10) {
        explanations.push(`Você perdeu ${midiaLost} pontos em Mídia. Verifique no painel do Mercado Livre se seu anúncio possui vídeo ou clips, e considere adicionar mais imagens.`);
      } else {
        explanations.push(`Você perdeu ${midiaLost} ponto${midiaLost > 1 ? 's' : ''} em Mídia. Revise suas imagens e verifique vídeos/clips no painel do Mercado Livre.`);
      }
    } else {
      // Sabemos o status do vídeo - usar linguagem assertiva
      if (midiaLost >= 10) {
        explanations.push(`Você perdeu ${midiaLost} pontos em Mídia por não utilizar vídeo ou clips e ter poucas imagens.`);
      } else {
        explanations.push(`Você perdeu ${midiaLost} ponto${midiaLost > 1 ? 's' : ''} em Mídia. Adicionar mais imagens ou vídeo pode melhorar o engajamento.`);
      }
    }
  } else if (scoreBreakdown.midia === 20) {
    explanations.push('Mídia está completa (20/20 pontos).');
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

