import { z } from 'zod';

const VisualCriterionSchema = z.object({
  score: z.number().min(0).max(100),
  assessment: z.string().min(1),
});

export const ListingVisualAnalysisSchema = z.object({
  visual_score: z.number().min(0).max(100),
  summary: z.string().min(1),
  clarity: VisualCriterionSchema,
  contrast: VisualCriterionSchema,
  visual_pollution: VisualCriterionSchema,
  excessive_text: VisualCriterionSchema,
  differentiation: VisualCriterionSchema,
  main_improvements: z.array(z.string().min(1)).min(1).max(5),
  main_image_url: z.string().url().nullable(),
  analyzed_at: z.string(),
  model: z.string(),
});

export type ListingVisualAnalysis = z.infer<typeof ListingVisualAnalysisSchema>;

export function createFallbackVisualAnalysis(input: {
  mainImageUrl: string | null;
  reason: string;
}): ListingVisualAnalysis {
  return {
    visual_score: 0,
    summary: `Analise visual indisponivel: ${input.reason}`,
    clarity: {
      score: 0,
      assessment: 'Nao foi possivel avaliar a clareza do produto.',
    },
    contrast: {
      score: 0,
      assessment: 'Nao foi possivel avaliar o contraste da imagem.',
    },
    visual_pollution: {
      score: 0,
      assessment: 'Nao foi possivel avaliar a poluicao visual.',
    },
    excessive_text: {
      score: 0,
      assessment: 'Nao foi possivel avaliar excesso de texto na imagem.',
    },
    differentiation: {
      score: 0,
      assessment: 'Nao foi possivel avaliar a diferenciacao visual.',
    },
    main_improvements: ['Validar a imagem principal do anuncio para liberar a analise visual.'],
    main_image_url: input.mainImageUrl,
    analyzed_at: new Date().toISOString(),
    model: 'fallback',
  };
}

export function parseVisualAnalysisResponse(
  rawResponse: unknown,
  mainImageUrl: string | null,
): ListingVisualAnalysis {
  const enriched = {
    ...(rawResponse as Record<string, unknown>),
    main_image_url: (rawResponse as Record<string, unknown>)?.main_image_url ?? mainImageUrl,
    analyzed_at: (rawResponse as Record<string, unknown>)?.analyzed_at ?? new Date().toISOString(),
    model: (rawResponse as Record<string, unknown>)?.model ?? 'gpt-4o',
  };

  return ListingVisualAnalysisSchema.parse(enriched);
}
