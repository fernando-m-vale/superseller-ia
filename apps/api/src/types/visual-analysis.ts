import { z } from 'zod';

export const VisualAnalysisStatusSchema = z.enum([
  'success',
  'missing_image',
  'model_error',
  'invalid_output',
]);

const VisualCriterionSchema = z.object({
  score: z.number().min(0).max(100),
  assessment: z.string().min(1),
  verdict: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
});

const VisualCriteriaMapSchema = z.object({
  clarity: VisualCriterionSchema,
  contrast: VisualCriterionSchema,
  visual_pollution: VisualCriterionSchema,
  excessive_text: VisualCriterionSchema,
  differentiation: VisualCriterionSchema,
  clickability: VisualCriterionSchema,
});

const VisualMetaSchema = z.object({
  status: VisualAnalysisStatusSchema,
  cache_hit: z.boolean(),
  prompt_version: z.string().min(1),
  model: z.string().min(1),
  analyzed_at: z.string(),
  image_hash: z.string().min(1).nullable(),
  image_source: z.enum(['pictures_json_first', 'thumbnail_url', 'none']),
});

export const ListingVisualAnalysisSchema = z.object({
  visual_score: z.number().min(0).max(100),
  summary: z.string().min(1),
  clarity: VisualCriterionSchema,
  contrast: VisualCriterionSchema,
  visual_pollution: VisualCriterionSchema,
  excessive_text: VisualCriterionSchema,
  differentiation: VisualCriterionSchema,
  clickability: VisualCriterionSchema,
  criteria: VisualCriteriaMapSchema.optional(),
  main_improvements: z.array(z.string().min(1)).min(1).max(5),
  main_image_url: z.string().url().nullable(),
  analyzed_at: z.string(),
  model: z.string(),
  meta: VisualMetaSchema.optional(),
});

export type ListingVisualAnalysis = z.infer<typeof ListingVisualAnalysisSchema>;
export type VisualAnalysisStatus = z.infer<typeof VisualAnalysisStatusSchema>;

function buildFallbackCriterion(message: string) {
  return {
    score: 0,
    assessment: message,
    verdict: 'indisponivel',
    reason: message,
  };
}

export function createFallbackVisualAnalysis(input: {
  mainImageUrl: string | null;
  reason: string;
  status?: VisualAnalysisStatus;
  promptVersion?: string;
  imageHash?: string | null;
  imageSource?: 'pictures_json_first' | 'thumbnail_url' | 'none';
  model?: string;
  cacheHit?: boolean;
}): ListingVisualAnalysis {
  const analyzedAt = new Date().toISOString();
  const message = `Nao foi possivel avaliar este criterio: ${input.reason}.`;
  const criteria = {
    clarity: buildFallbackCriterion(message),
    contrast: buildFallbackCriterion(message),
    visual_pollution: buildFallbackCriterion(message),
    excessive_text: buildFallbackCriterion(message),
    differentiation: buildFallbackCriterion(message),
    clickability: buildFallbackCriterion(message),
  };

  return {
    visual_score: 0,
    summary: `Analise visual indisponivel: ${input.reason}`,
    ...criteria,
    criteria,
    main_improvements: ['Validar a imagem principal do anuncio para liberar a analise visual.'],
    main_image_url: input.mainImageUrl,
    analyzed_at: analyzedAt,
    model: input.model || 'fallback',
    meta: {
      status: input.status || 'missing_image',
      cache_hit: input.cacheHit ?? false,
      prompt_version: input.promptVersion || 'visual-v1-legacy',
      model: input.model || 'fallback',
      analyzed_at: analyzedAt,
      image_hash: input.imageHash ?? null,
      image_source: input.imageSource || 'none',
    },
  };
}

export function parseVisualAnalysisResponse(
  rawResponse: unknown,
  mainImageUrl: string | null,
): ListingVisualAnalysis {
  const raw = (rawResponse || {}) as Record<string, unknown>;
  const criteria = {
    clarity: raw.clarity,
    contrast: raw.contrast,
    visual_pollution: raw.visual_pollution ?? raw.visualPollution,
    excessive_text: raw.excessive_text ?? raw.excessiveText,
    differentiation: raw.differentiation,
    clickability: raw.clickability ?? {
      score: raw.visual_score ?? raw.visualScore ?? 0,
      assessment: 'Capacidade de clique nao informada.',
    },
  };

  const enriched = {
    ...raw,
    clarity: criteria.clarity,
    contrast: criteria.contrast,
    visual_pollution: criteria.visual_pollution,
    excessive_text: criteria.excessive_text,
    differentiation: criteria.differentiation,
    clickability: criteria.clickability,
    criteria,
    main_improvements: raw.main_improvements ?? raw.mainImprovements ?? [],
    main_image_url: raw.main_image_url ?? raw.mainImageUrl ?? mainImageUrl,
    analyzed_at: raw.analyzed_at ?? raw.analyzedAt ?? new Date().toISOString(),
    model: raw.model ?? 'gpt-4o',
    meta: raw.meta,
  };

  return ListingVisualAnalysisSchema.parse(enriched);
}
