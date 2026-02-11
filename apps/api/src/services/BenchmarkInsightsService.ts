/**
 * Benchmark Insights Service
 * 
 * Transforma benchmark em insights acionáveis (wins, losses, criticalGaps).
 * NUNCA inventa números; se baseline indisponível, não gera expected/actual.
 */

import { BenchmarkResult, BenchmarkStats, BaselineConversion } from './BenchmarkService';

export interface BenchmarkWin {
  message: string;
  evidence?: string;
}

export interface BenchmarkLoss {
  message: string;
  evidence?: string;
}

export type GapDimension = 'price' | 'title' | 'images' | 'video' | 'description';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface CriticalGap {
  id: string;
  dimension: GapDimension;
  title: string;
  whyItMatters: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  confidence: ConfidenceLevel;
  metrics?: Record<string, number | string>;
}

export interface BenchmarkInsights {
  confidence: 'high' | 'medium' | 'low' | 'unavailable';
  wins: BenchmarkWin[];
  losses: BenchmarkLoss[];
  criticalGaps: CriticalGap[];
}

/**
 * Normaliza output do BenchmarkService em BenchmarkInsights
 * HOTFIX P0: Implementa fallback heurístico quando benchmark unavailable
 */
export function normalizeBenchmarkInsights(
  benchmarkResult: BenchmarkResult | null,
  listing: {
    picturesCount: number;
    hasClips: boolean | null;
    titleLength: number;
    price: number;
    hasPromotion: boolean;
    discountPercent: number | null;
  },
  metrics30d: {
    visits: number;
    orders: number;
    conversionRate: number | null;
  },
  fallbackData?: {
    mediaVerdict?: {
      hasClipDetected: boolean | null;
      canSuggestClip: boolean;
    };
    seoSuggestions?: {
      suggestedTitle?: string;
    };
    analysisV21?: {
      titleFix?: {
        problem?: string;
      };
      descriptionFix?: {
        diagnostic?: string;
      };
    };
  }
): BenchmarkInsights {
  // Se benchmark indisponível, usar fallback heurístico (HOTFIX P0)
  if (!benchmarkResult || benchmarkResult.benchmarkSummary.confidence === 'unavailable' || benchmarkResult.benchmarkSummary.sampleSize === 0) {
    const fallbackGaps = generateFallbackGaps(listing, metrics30d, fallbackData);
    return {
      confidence: 'low', // Mudado de 'unavailable' para 'low' quando há fallback
      wins: [],
      losses: [],
      criticalGaps: fallbackGaps,
    };
  }

  const { benchmarkSummary, youWinHere, youLoseHere } = benchmarkResult;
  const { stats, baselineConversion } = benchmarkSummary;

  // Normalizar wins
  const wins: BenchmarkWin[] = youWinHere.map(message => ({
    message,
    evidence: undefined, // Pode ser expandido no futuro
  }));

  // Normalizar losses
  const losses: BenchmarkLoss[] = youLoseHere.map(message => ({
    message,
    evidence: undefined, // Pode ser expandido no futuro
  }));

  // Gerar criticalGaps via rankGaps
  const criticalGaps = rankGaps(listing, stats, baselineConversion, metrics30d);

  return {
    confidence: benchmarkSummary.confidence,
    wins,
    losses,
    criticalGaps,
  };
}

/**
 * Transforma benchmark em Top 3 prioridades acionáveis (criticalGaps)
 * 
 * Regras de priorização:
 * 1) Impact DESC
 * 2) Effort ASC
 * 3) Confidence DESC
 * 
 * Máximo: 3 gaps
 */
export function rankGaps(
  listing: {
    picturesCount: number;
    hasClips: boolean | null;
    titleLength: number;
    price: number;
    hasPromotion: boolean;
    discountPercent: number | null;
  },
  stats: BenchmarkStats,
  baselineConversion: BaselineConversion,
  metrics30d: {
    visits: number;
    orders: number;
    conversionRate: number | null;
  }
): CriticalGap[] {
  const gaps: CriticalGap[] = [];

  // 1. Gap de imagens (picturesCount < medianPicturesCount)
  if (listing.picturesCount < stats.medianPicturesCount && stats.medianPicturesCount > 0) {
    const gap = stats.medianPicturesCount - listing.picturesCount;
    gaps.push({
      id: 'gap_images',
      dimension: 'images',
      title: `Adicionar ${gap} imagem${gap > 1 ? 'ns' : ''} para alcançar a média da categoria`,
      whyItMatters: 'Anúncios com mais imagens tendem a gerar maior engajamento e conversão.',
      impact: 'high',
      effort: 'low',
      confidence: stats.sampleSize >= 10 ? 'high' : 'medium',
      metrics: {
        current: listing.picturesCount,
        median: stats.medianPicturesCount,
        gap,
      },
    });
  }

  // 2. Gap de vídeo (categoria tem alta % com vídeo e listing sem clip detectável)
  if (stats.percentageWithVideo > 50) {
    if (listing.hasClips === false) {
      gaps.push({
        id: 'gap_video',
        dimension: 'video',
        title: 'Adicionar vídeo para aumentar confiança e engajamento',
        whyItMatters: `${Math.round(stats.percentageWithVideo)}% dos concorrentes têm vídeo. Vídeos aumentam confiança e conversão.`,
        impact: 'high',
        effort: 'medium',
        confidence: stats.sampleSize >= 10 ? 'high' : 'medium',
        metrics: {
          competitorsWithVideo: Math.round(stats.percentageWithVideo),
          hasVideo: 'false',
        },
      });
    } else if (listing.hasClips === null) {
      // Não detectável - sugerir verificar
      gaps.push({
        id: 'gap_video_check',
        dimension: 'video',
        title: 'Verificar se há vídeo no anúncio',
        whyItMatters: `${Math.round(stats.percentageWithVideo)}% dos concorrentes têm vídeo detectável. Se não houver, considere adicionar.`,
        impact: 'medium',
        effort: 'low',
        confidence: 'medium',
        metrics: {
          competitorsWithVideo: Math.round(stats.percentageWithVideo),
          hasVideo: 'unknown',
        },
      });
    }
  }

  // 3. Gap de título (titleLength muito fora da mediana)
  if (stats.medianTitleLength > 0) {
    const titleDiff = Math.abs(listing.titleLength - stats.medianTitleLength);
    const titleDiffPercent = (titleDiff / stats.medianTitleLength) * 100;
    
    // Se diferença > 20% da mediana, considerar gap
    if (titleDiffPercent > 20) {
      if (listing.titleLength < stats.medianTitleLength) {
        const gap = Math.round(stats.medianTitleLength - listing.titleLength);
        gaps.push({
          id: 'gap_title_short',
          dimension: 'title',
          title: `Expandir título em ${gap} caracteres para alcançar a média da categoria`,
          whyItMatters: 'Títulos mais completos aumentam a visibilidade e o CTR nas buscas.',
          impact: 'medium',
          effort: 'low',
          confidence: stats.sampleSize >= 10 ? 'high' : 'medium',
          metrics: {
            current: listing.titleLength,
            median: Math.round(stats.medianTitleLength),
            gap,
          },
        });
      } else {
        // Título muito longo (menos crítico, mas pode ser otimizado)
        gaps.push({
          id: 'gap_title_long',
          dimension: 'title',
          title: 'Otimizar título para melhor legibilidade',
          whyItMatters: 'Títulos muito longos podem reduzir a legibilidade e o CTR.',
          impact: 'low',
          effort: 'low',
          confidence: 'medium',
          metrics: {
            current: listing.titleLength,
            median: Math.round(stats.medianTitleLength),
            diff: Math.round(listing.titleLength - stats.medianTitleLength),
          },
        });
      }
    }
  }

  // 4. Gap de conversão vs promo (promo ativa + CR abaixo do baseline)
  // Só gerar se baseline estiver disponível (não inventar números)
  if (
    listing.hasPromotion &&
    listing.discountPercent !== null &&
    listing.discountPercent >= 30 &&
    baselineConversion.conversionRate !== null &&
    baselineConversion.confidence !== 'unavailable' &&
    metrics30d.visits >= 150 &&
    metrics30d.conversionRate !== null &&
    metrics30d.conversionRate < baselineConversion.conversionRate
  ) {
    const crGap = baselineConversion.conversionRate - metrics30d.conversionRate;
    gaps.push({
      id: 'gap_conversion_vs_promo',
      dimension: 'description',
      title: 'Otimizar comunicação da promoção para aumentar conversão',
      whyItMatters: `Você tem promoção ativa (${listing.discountPercent}% OFF) mas conversão (${(metrics30d.conversionRate * 100).toFixed(2)}%) está abaixo do baseline da categoria (${(baselineConversion.conversionRate * 100).toFixed(2)}%). Isso indica gargalo em CTR/qualificação/clareza.`,
      impact: 'high',
      effort: 'medium',
      confidence: baselineConversion.confidence,
      metrics: {
        currentCR: metrics30d.conversionRate,
        baselineCR: baselineConversion.conversionRate,
        gap: crGap,
        discountPercent: listing.discountPercent,
        visits: metrics30d.visits,
      },
    });
  }

  // Ordenar por prioridade: Impact DESC, Effort ASC, Confidence DESC
  gaps.sort((a, b) => {
    // 1. Impact DESC
    const impactOrder: Record<ImpactLevel, number> = { high: 3, medium: 2, low: 1 };
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[b.impact] - impactOrder[a.impact];
    }
    
    // 2. Effort ASC
    const effortOrder: Record<EffortLevel, number> = { low: 1, medium: 2, high: 3 };
    if (effortOrder[a.effort] !== effortOrder[b.effort]) {
      return effortOrder[a.effort] - effortOrder[b.effort];
    }
    
    // 3. Confidence DESC
    const confidenceOrder: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
    return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
  });

  // Retornar máximo 3 gaps
  return gaps.slice(0, 3);
}

/**
 * Gera gaps heurísticos quando benchmark está unavailable (HOTFIX P0)
 * Usa apenas dados internos do listing/análise, sem inventar números
 */
function generateFallbackGaps(
  listing: {
    picturesCount: number;
    hasClips: boolean | null;
    titleLength: number;
    hasPromotion: boolean;
    discountPercent: number | null;
  },
  metrics30d: {
    visits: number;
    orders: number;
    conversionRate: number | null;
  },
  fallbackData?: {
    mediaVerdict?: {
      hasClipDetected: boolean | null;
      canSuggestClip: boolean;
    };
    seoSuggestions?: {
      suggestedTitle?: string;
    };
    analysisV21?: {
      titleFix?: {
        problem?: string;
      };
      descriptionFix?: {
        diagnostic?: string;
      };
    };
  }
): CriticalGap[] {
  const gaps: CriticalGap[] = [];

  // 1. Gap de vídeo (se não há vídeo e pode sugerir)
  if (
    listing.hasClips === false &&
    fallbackData?.mediaVerdict?.canSuggestClip === true
  ) {
    gaps.push({
      id: 'gap_video_fallback',
      dimension: 'video',
      title: 'Adicionar vídeo para aumentar confiança e engajamento',
      whyItMatters: 'Vídeos aumentam a confiança do comprador e podem melhorar a conversão.',
      impact: 'high',
      effort: 'medium',
      confidence: 'medium',
      metrics: {
        hasVideo: 'false',
        source: 'internal_heuristics',
        fields: ['hasClips', 'mediaVerdict.canSuggestClip'],
      },
    });
  }

  // 2. Gap de título (se há sugestão de título ou problema detectado)
  if (
    (fallbackData?.seoSuggestions?.suggestedTitle || fallbackData?.analysisV21?.titleFix?.problem) &&
    listing.titleLength < 50
  ) {
    gaps.push({
      id: 'gap_title_fallback',
      dimension: 'title',
      title: 'Otimizar título para melhor visibilidade e SEO',
      whyItMatters: 'Títulos otimizados aumentam a visibilidade nas buscas e melhoram o CTR.',
      impact: 'high',
      effort: 'low',
      confidence: 'medium',
      metrics: {
        currentLength: listing.titleLength,
        source: 'internal_heuristics',
        fields: ['titleLength', 'seoSuggestions', 'titleFix'],
      },
    });
  }

  // 3. Gap de imagens (se tiver poucas imagens)
  if (listing.picturesCount < 5) {
    gaps.push({
      id: 'gap_images_fallback',
      dimension: 'images',
      title: `Adicionar mais imagens (atualmente ${listing.picturesCount})`,
      whyItMatters: 'Anúncios com mais imagens tendem a gerar maior engajamento e conversão.',
      impact: 'medium',
      effort: 'low',
      confidence: 'low',
      metrics: {
        current: listing.picturesCount,
        source: 'internal_heuristics',
        fields: ['picturesCount'],
      },
    });
  }

  // 4. Gap de descrição (se há problema detectado)
  if (fallbackData?.analysisV21?.descriptionFix?.diagnostic) {
    gaps.push({
      id: 'gap_description_fallback',
      dimension: 'description',
      title: 'Otimizar descrição para melhor SEO e conversão',
      whyItMatters: 'Descrições estruturadas melhoram SEO e reduzem objeções do comprador.',
      impact: 'medium',
      effort: 'low',
      confidence: 'medium',
      metrics: {
        source: 'internal_heuristics',
        fields: ['descriptionFix'],
      },
    });
  }

  // Ordenar por prioridade: Impact DESC, Effort ASC, Confidence DESC
  gaps.sort((a, b) => {
    const impactOrder: Record<ImpactLevel, number> = { high: 3, medium: 2, low: 1 };
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[b.impact] - impactOrder[a.impact];
    }
    const effortOrder: Record<EffortLevel, number> = { low: 1, medium: 2, high: 3 };
    if (effortOrder[a.effort] !== effortOrder[b.effort]) {
      return effortOrder[a.effort] - effortOrder[b.effort];
    }
    const confidenceOrder: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
    return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
  });

  // Retornar máximo 3 gaps
  return gaps.slice(0, 3);
}
