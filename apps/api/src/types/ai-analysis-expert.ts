/**
 * AI Analysis Result - Mercado Livre Expert
 *
 * Contrato do prompt especialista. Mantém compatibilidade com respostas antigas,
 * mas aceita o schema completo da Recommendation Engine V2 (ml-expert-v23).
 */

import { z } from 'zod';

const PromptVersionSchema = z.enum(['ml-expert-v1', 'ml-expert-v21', 'ml-sales-v22', 'ml-expert-v22', 'ml-expert-v23']);

const LegacyTitleFixSchema = z.object({
  problem: z.string(),
  impact: z.string(),
  before: z.string(),
  after: z.string(),
}).optional();

const LegacyImagePlanItemSchema = z.object({
  image: z.number(),
  action: z.string(),
});

const LegacyDescriptionFixSchema = z.object({
  diagnostic: z.string(),
  optimized_copy: z.string(),
}).optional();

const LegacyPriceFixSchema = z.object({
  diagnostic: z.string(),
  action: z.string(),
}).optional();

const LegacyAlgorithmHackSchema = z.object({
  hack: z.string(),
  how_to_apply: z.string(),
  signal_impacted: z.string(),
}).passthrough();

const ScoreBreakdownV23Schema = z.object({
  descoberta: z.number(),
  clique: z.number(),
  conversao: z.number(),
  crescimento: z.number(),
}).partial().optional();

const VerdictV23Schema = z.object({
  headline: z.string().optional(),
  diagnosis: z.string().optional(),
  whatIsWorking: z.string().optional(),
  rootCause: z.string().optional(),
  rootCauseCode: z.string().optional(),
  performanceSignal: z.enum(['EXCELENTE', 'BOM', 'ATENCAO', 'CRITICO']).optional(),
}).partial().optional();

const FunnelStageV23Schema = z.object({
  score: z.number().optional(),
  status: z.enum(['ok', 'atencao', 'critico']).optional(),
  insight: z.string().optional(),
}).partial();

const FunnelAnalysisV23Schema = z.object({
  descoberta: FunnelStageV23Schema.optional(),
  clique: FunnelStageV23Schema.optional(),
  conversao: FunnelStageV23Schema.optional(),
  crescimento: FunnelStageV23Schema.optional(),
}).partial().optional();

const PotentialGainV23Schema = z.object({
  estimatedVisitsIncrease: z.string().optional(),
  estimatedConversionIncrease: z.string().optional(),
  estimatedRevenueIncrease: z.string().optional(),
  confidence: z.enum(['alta', 'media', 'baixa']).optional(),
}).partial().optional();

const GrowthHackV23Schema = z.object({
  id: z.string(),
  actionKey: z.string().optional(),
  pillar: z.enum(['seo', 'midia', 'preco', 'ads', 'confianca', 'crescimento']).optional(),
  funnelStage: z.enum(['DESCOBERTA', 'CLIQUE', 'CONVERSAO', 'CRESCIMENTO']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  impact: z.enum(['high', 'medium', 'low']).optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  readyCopy: z.string().optional(),
  expectedImpact: z.string().optional(),
  impactReason: z.string().optional(),
  actionGroup: z.enum(['immediate', 'support', 'optional']).optional(),
  rootCauseCode: z.string().optional(),
}).passthrough();

const AdsIntelligenceV23Schema = z.object({
  status: z.enum(['available', 'unavailable', 'no_campaign']).optional(),
  summary: z.string().optional(),
  recommendation: z.string().optional(),
}).partial().optional();

const ExecutionRoadmapStepV23Schema = z.object({
  stepNumber: z.number(),
  actionId: z.string().optional(),
  actionTitle: z.string().optional(),
  reason: z.string().optional(),
  expectedImpact: z.string().optional(),
}).passthrough();

export const AIAnalysisResultExpertSchema = z.object({
  score: z.number().optional(),
  scoreBreakdown: ScoreBreakdownV23Schema,
  performanceSignal: z.enum(['EXCELENTE', 'BOM', 'ATENCAO', 'CRITICO']).optional(),
  verdict: z.union([z.string(), VerdictV23Schema]).optional(),
  funnelAnalysis: FunnelAnalysisV23Schema,
  potentialGain: PotentialGainV23Schema,
  growthHacks: z.array(GrowthHackV23Schema).optional(),
  adsIntelligence: AdsIntelligenceV23Schema,
  executionRoadmap: z.array(ExecutionRoadmapStepV23Schema).optional(),

  // Campos legados preservados
  title_fix: LegacyTitleFixSchema,
  image_plan: z.array(LegacyImagePlanItemSchema).optional(),
  description_fix: LegacyDescriptionFixSchema,
  price_fix: LegacyPriceFixSchema,
  algorithm_hacks: z.array(LegacyAlgorithmHackSchema).optional(),
  final_action_plan: z.array(z.string()).optional(),

  meta: z.object({
    version: PromptVersionSchema,
    model: z.string(),
    analyzed_at: z.string(),
    prompt_version: PromptVersionSchema,
    processing_time_ms: z.number().optional(),
  }),
}).passthrough();

export type AIAnalysisResultExpert = z.infer<typeof AIAnalysisResultExpertSchema>;

export function parseAIResponseExpert(
  rawResponse: unknown,
  _listingData: {
    title: string;
    price_base: number;
    price_final: number;
    has_promotion: boolean;
    discount_percent: number | null;
    pictures_count: number;
    description_length: number;
  }
): { success: true; data: AIAnalysisResultExpert } | { success: false; error: z.ZodError } {
  try {
    const raw = (rawResponse ?? {}) as Record<string, unknown>;
    const existingMeta = (raw.meta ?? {}) as Record<string, unknown>;
    const verdict = raw.verdict;
    const normalizedPerformanceSignal =
      typeof raw.performanceSignal === 'string'
        ? raw.performanceSignal
        : verdict && typeof verdict === 'object' && typeof (verdict as Record<string, unknown>).performanceSignal === 'string'
          ? (verdict as Record<string, unknown>).performanceSignal
          : undefined;

    const enriched = {
      ...raw,
      performanceSignal: normalizedPerformanceSignal,
      meta: {
        ...existingMeta,
        version: 'ml-expert-v23' as const,
        model: typeof existingMeta.model === 'string' ? existingMeta.model : 'gpt-4o',
        analyzed_at: typeof existingMeta.analyzed_at === 'string' ? existingMeta.analyzed_at : new Date().toISOString(),
        prompt_version: 'ml-expert-v23' as const,
      },
    };

    const result = AIAnalysisResultExpertSchema.safeParse(enriched);
    if (result.success) {
      const data = result.data;
      // Recover v23 top-level fields from raw if Zod returned them as undefined
      // (happens when GPT omits a field or when optional schema strips it)
      const recovered: typeof data = { ...data };
      if (recovered.performanceSignal === undefined && normalizedPerformanceSignal !== undefined) {
        recovered.performanceSignal = normalizedPerformanceSignal as typeof data.performanceSignal;
      }
      if (recovered.funnelAnalysis === undefined && raw.funnelAnalysis && typeof raw.funnelAnalysis === 'object') {
        recovered.funnelAnalysis = raw.funnelAnalysis as typeof data.funnelAnalysis;
      }
      if (recovered.potentialGain === undefined && raw.potentialGain && typeof raw.potentialGain === 'object') {
        recovered.potentialGain = raw.potentialGain as typeof data.potentialGain;
      }
      return { success: true, data: recovered };
    }
    return { success: false, error: result.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof z.ZodError ? error : new z.ZodError([]),
    };
  }
}

export function createFallbackAnalysisExpert(
  errorMessage: string,
  listingData: {
    title: string;
    price_base: number;
    price_final: number;
    has_promotion: boolean;
    discount_percent: number | null;
    pictures_count: number;
    description_length: number;
  }
): AIAnalysisResultExpert {
  return {
    score: 0,
    scoreBreakdown: {
      descoberta: 0,
      clique: 0,
      conversao: 0,
      crescimento: 0,
    },
    performanceSignal: 'ATENCAO',
    verdict: {
      headline: `Erro ao analisar anúncio: ${errorMessage}`,
      diagnosis: 'A análise automática não pôde ser concluída.',
      whatIsWorking: 'Dados insuficientes para identificar pontos fortes com segurança.',
      rootCause: 'Falha na geração da análise.',
      rootCauseCode: 'healthy_maintain',
    },
    funnelAnalysis: {
      descoberta: { score: 0, status: 'atencao', insight: 'Análise indisponível.' },
      clique: { score: 0, status: 'atencao', insight: 'Análise indisponível.' },
      conversao: { score: 0, status: 'atencao', insight: 'Análise indisponível.' },
      crescimento: { score: 0, status: 'atencao', insight: 'Análise indisponível.' },
    },
    potentialGain: {
      estimatedVisitsIncrease: 'Indisponível',
      estimatedConversionIncrease: 'Indisponível',
      estimatedRevenueIncrease: 'Indisponível',
      confidence: 'baixa',
    },
    growthHacks: [
      {
        id: 'retry_analysis',
        actionKey: 'maintain_monitor',
        pillar: 'crescimento',
        funnelStage: 'CRESCIMENTO',
        priority: 'low',
        impact: 'low',
        effort: 'low',
        title: 'Reprocessar análise',
        summary: 'A análise falhou e precisa ser gerada novamente.',
        description: `Erro ao analisar "${listingData.title}". Gere a análise novamente após validar os dados do anúncio.`,
        expectedImpact: 'Restabelecer diagnóstico',
        actionGroup: 'support',
        rootCauseCode: 'healthy_maintain',
      },
    ],
    adsIntelligence: {
      status: 'unavailable',
      summary: 'Dados de ads indisponíveis.',
    },
    executionRoadmap: [
      {
        stepNumber: 1,
        actionId: 'retry_analysis',
        actionTitle: 'Reprocessar análise',
        reason: 'Sem análise válida não há evidência suficiente para recomendar ações.',
        expectedImpact: 'Restabelecer o diagnóstico',
      },
    ],
    meta: {
      version: 'ml-expert-v23',
      model: 'gpt-4o',
      analyzed_at: new Date().toISOString(),
      prompt_version: 'ml-expert-v23',
    },
  };
}
