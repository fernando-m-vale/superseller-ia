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
  }
): BenchmarkInsights {
  // Se benchmark indisponível, retornar estrutura vazia
  if (!benchmarkResult || benchmarkResult.benchmarkSummary.confidence === 'unavailable') {
    return {
      confidence: 'unavailable',
      wins: [],
      losses: [],
      criticalGaps: [],
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
