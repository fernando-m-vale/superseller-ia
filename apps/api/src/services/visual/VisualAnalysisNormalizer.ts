import { z } from 'zod';
import {
  createFallbackVisualAnalysis,
  type ListingVisualAnalysis,
  type VisualAnalysisStatus,
} from '../../types/visual-analysis';
import { VISUAL_ANALYSIS_MODEL, VISUAL_ANALYSIS_PROMPT_VERSION } from './visual-analysis.constants';
import type { VisualSignals } from './VisualSignalsBuilder';
import type { VisualImageSource } from './VisualAssetResolver';

const RawCriterionSchema = z.object({
  score: z.number().optional(),
  verdict: z.string().optional(),
  reason: z.string().optional(),
});

const RawVisualAnalysisSchema = z.object({
  visualScore: z.number(),
  visualSummary: z.string(),
  clarity: RawCriterionSchema,
  contrast: RawCriterionSchema,
  visualPollution: RawCriterionSchema,
  excessiveText: RawCriterionSchema,
  differentiation: RawCriterionSchema,
  clickability: RawCriterionSchema,
  mainImprovements: z.array(z.string()),
});

type NormalizeInput = {
  rawResponse: unknown;
  mainImageUrl: string | null;
  imageSource: VisualImageSource;
  imageHash: string | null;
  cacheHit?: boolean;
  promptVersion?: string;
  model?: string;
};

type FailureInput = {
  reason: string;
  status: VisualAnalysisStatus;
  mainImageUrl: string | null;
  imageSource: VisualImageSource;
  imageHash: string | null;
  cacheHit?: boolean;
  promptVersion?: string;
  model?: string;
};

function clampScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function shortenSummary(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return 'Analise visual indisponivel.';
  }
  return text.length <= 180 ? text : `${text.slice(0, 177).trim()}...`;
}

function toAssessment(verdict: string, reason: string): string {
  if (!reason) {
    return verdict || 'Sem observacoes adicionais.';
  }
  return verdict ? `${verdict}: ${reason}` : reason;
}

function normalizeCriterion(rawCriterion: { score?: number; verdict?: string; reason?: string }) {
  const verdict = (rawCriterion.verdict || 'neutro').trim().slice(0, 24) || 'neutro';
  const reason = (rawCriterion.reason || 'Sem justificativa fornecida.').trim().slice(0, 220);
  return {
    score: clampScore(rawCriterion.score),
    verdict,
    reason,
    assessment: toAssessment(verdict, reason),
  };
}

export class VisualAnalysisNormalizer {
  normalize(input: NormalizeInput): ListingVisualAnalysis {
    let parsed: z.infer<typeof RawVisualAnalysisSchema>;
    try {
      parsed = RawVisualAnalysisSchema.parse(input.rawResponse);
    } catch (error) {
      return this.createFailure({
        reason: error instanceof Error ? error.message : 'schema invalido da IA visual',
        status: 'invalid_output',
        mainImageUrl: input.mainImageUrl,
        imageSource: input.imageSource,
        imageHash: input.imageHash,
        cacheHit: input.cacheHit,
        promptVersion: input.promptVersion,
        model: input.model,
      });
    }

    const clarity = normalizeCriterion(parsed.clarity);
    const contrast = normalizeCriterion(parsed.contrast);
    const visualPollution = normalizeCriterion(parsed.visualPollution);
    const excessiveText = normalizeCriterion(parsed.excessiveText);
    const differentiation = normalizeCriterion(parsed.differentiation);
    const clickability = normalizeCriterion(parsed.clickability);
    const analyzedAt = new Date().toISOString();
    const model = input.model || VISUAL_ANALYSIS_MODEL;
    const promptVersion = input.promptVersion || VISUAL_ANALYSIS_PROMPT_VERSION;
    const improvements = parsed.mainImprovements
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);

    return {
      visual_score: clampScore(parsed.visualScore),
      summary: shortenSummary(parsed.visualSummary),
      clarity,
      contrast,
      visual_pollution: visualPollution,
      excessive_text: excessiveText,
      differentiation,
      clickability,
      criteria: {
        clarity,
        contrast,
        visual_pollution: visualPollution,
        excessive_text: excessiveText,
        differentiation,
        clickability,
      },
      main_improvements: improvements.length > 0 ? improvements : ['Simplificar a imagem principal para aumentar o clique.'],
      main_image_url: input.mainImageUrl,
      analyzed_at: analyzedAt,
      model,
      meta: {
        status: 'success',
        cache_hit: input.cacheHit ?? false,
        prompt_version: promptVersion,
        model,
        analyzed_at: analyzedAt,
        image_hash: input.imageHash,
        image_source: input.imageSource,
      },
    };
  }

  createFailure(input: FailureInput): ListingVisualAnalysis {
    return createFallbackVisualAnalysis({
      mainImageUrl: input.mainImageUrl,
      reason: input.reason,
      status: input.status,
      imageHash: input.imageHash,
      imageSource: input.imageSource,
      promptVersion: input.promptVersion || VISUAL_ANALYSIS_PROMPT_VERSION,
      model: input.model || VISUAL_ANALYSIS_MODEL,
      cacheHit: input.cacheHit ?? false,
    });
  }

  withCacheMetadata(
    analysis: ListingVisualAnalysis,
    cacheHit: boolean,
    signals?: VisualSignals,
  ): ListingVisualAnalysis {
    return {
      ...analysis,
      criteria: analysis.criteria || {
        clarity: analysis.clarity,
        contrast: analysis.contrast,
        visual_pollution: analysis.visual_pollution,
        excessive_text: analysis.excessive_text,
        differentiation: analysis.differentiation,
        clickability: analysis.clickability,
      },
      meta: {
        status: analysis.meta?.status || 'success',
        cache_hit: cacheHit,
        prompt_version: analysis.meta?.prompt_version || VISUAL_ANALYSIS_PROMPT_VERSION,
        model: analysis.meta?.model || analysis.model,
        analyzed_at: analysis.meta?.analyzed_at || analysis.analyzed_at,
        image_hash: analysis.meta?.image_hash ?? signals?.imageHash ?? null,
        image_source: analysis.meta?.image_source || signals?.imageSource || 'none',
      },
    };
  }
}
