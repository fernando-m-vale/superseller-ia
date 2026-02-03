/**
 * AI Analysis Result - Mercado Livre Expert
 * 
 * Formato especialista focado em ações diretas e implementáveis.
 * Versão ml-expert-v1: consultor sênior especialista em Mercado Livre.
 */

import { z } from 'zod';

/**
 * Schema para análise de título com correção
 */
export const TitleFixExpertSchema = z.object({
  problem: z.string().describe('Onde o título atual falha para o algoritmo do Mercado Livre'),
  impact: z.string().describe('Qual sinal algorítmico está sendo perdido'),
  before: z.string().describe('Título atual exatamente como está no anúncio'),
  after: z.string().describe('Título otimizado pronto para copiar e colar'),
});

export type TitleFixExpert = z.infer<typeof TitleFixExpertSchema>;

/**
 * Schema para plano de imagens
 */
export const ImagePlanItemExpertSchema = z.object({
  image: z.number().describe('Número da imagem (1, 2, 3, etc)'),
  action: z.string().describe('O que essa imagem deve mostrar para converter melhor'),
});

export type ImagePlanItemExpert = z.infer<typeof ImagePlanItemExpertSchema>;

/**
 * Schema para correção de descrição
 */
export const DescriptionFixExpertSchema = z.object({
  diagnostic: z.string().describe('Problema real da descrição atual'),
  optimized_copy: z.string().describe('Descrição completa pronta para colar no Mercado Livre'),
});

export type DescriptionFixExpert = z.infer<typeof DescriptionFixExpertSchema>;

/**
 * Schema para correção de preço
 */
export const PriceFixExpertSchema = z.object({
  diagnostic: z.string().describe('Avaliação do preço considerando preço final e promoções'),
  action: z.string().describe('O que fazer com preço/promoção'),
});

export type PriceFixExpert = z.infer<typeof PriceFixExpertSchema>;

/**
 * Schema para hack algorítmico
 */
export const AlgorithmHackExpertSchema = z.object({
  hack: z.string().describe('Nome curto do hack'),
  how_to_apply: z.string().describe('Como executar no Mercado Livre'),
  signal_impacted: z.string().describe('Sinal algorítmico impactado'),
});

export type AlgorithmHackExpert = z.infer<typeof AlgorithmHackExpertSchema>;

/**
 * Schema completo da análise especialista
 */
export const AIAnalysisResultExpertSchema = z.object({
  verdict: z.string().describe('Frase curta, direta e incômoda sobre o anúncio'),
  title_fix: TitleFixExpertSchema,
  image_plan: z.array(ImagePlanItemExpertSchema).describe('Plano de imagens (mínimo 3)'),
  description_fix: DescriptionFixExpertSchema,
  price_fix: PriceFixExpertSchema,
  algorithm_hacks: z.array(AlgorithmHackExpertSchema).describe('Hacks algorítmicos do Mercado Livre'),
  final_action_plan: z.array(z.string()).describe('Ações concretas ordenadas por prioridade'),
  meta: z.object({
    version: z.enum(['ml-expert-v1', 'ml-expert-v21', 'ml-sales-v22']),
    model: z.string(),
    analyzed_at: z.string(),
    prompt_version: z.enum(['ml-expert-v1', 'ml-expert-v21', 'ml-sales-v22']),
    processing_time_ms: z.number().optional(),
  }),
});

export type AIAnalysisResultExpert = z.infer<typeof AIAnalysisResultExpertSchema>;

/**
 * Parse e valida resposta da IA
 */
export function parseAIResponseExpert(
  rawResponse: unknown,
  listingData: {
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
    // Enriquecer resposta com meta se necessário
    const enriched = {
      ...(rawResponse as Record<string, unknown>),
      meta: {
        ...((rawResponse as Record<string, unknown>).meta as Record<string, unknown> || {}),
        version: 'ml-expert-v1' as const,
        model: 'gpt-4o',
        analyzed_at: new Date().toISOString(),
        prompt_version: 'ml-expert-v1' as const,
      },
    };

    const result = AIAnalysisResultExpertSchema.safeParse(enriched);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof z.ZodError ? error : new z.ZodError([]),
    };
  }
}

/**
 * Cria análise fallback em caso de erro
 */
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
    verdict: `Erro ao analisar anúncio: ${errorMessage}`,
    title_fix: {
      problem: 'Não foi possível analisar o título devido a erro na análise',
      impact: 'Análise indisponível',
      before: listingData.title,
      after: listingData.title,
    },
    image_plan: [
      { image: 1, action: 'Análise indisponível' },
      { image: 2, action: 'Análise indisponível' },
      { image: 3, action: 'Análise indisponível' },
    ],
    description_fix: {
      diagnostic: 'Análise indisponível devido a erro',
      optimized_copy: 'Análise indisponível',
    },
    price_fix: {
      diagnostic: 'Análise indisponível',
      action: 'Verifique os dados do anúncio',
    },
    algorithm_hacks: [],
    final_action_plan: ['Verificar dados do anúncio', 'Tentar novamente a análise'],
    meta: {
      version: 'ml-expert-v21',
      model: 'gpt-4o',
      analyzed_at: new Date().toISOString(),
      prompt_version: 'ml-expert-v21',
    },
  };
}
