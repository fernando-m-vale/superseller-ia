/**
 * AI Analysis Result V2.1
 * 
<<<<<<< HEAD
 * Estrutura JSON estruturada retornada pela IA V2.1.
 * Mais rica e estruturada que V1, com actions, title, description, images, promo.
=======
 * Contrato estruturado e acionável para análise de anúncios pela IA.
 * Versão 2.1: modo agressivo + ações concretas + análise de descrição.
>>>>>>> 97bc8bcb89a4380e2154f74201c70ff3d998efd1
 */

import { z } from 'zod';

/**
<<<<<<< HEAD
 * Schema Zod para validação do resultado V2.1
 */
export const AIAnalysisResultV21Schema = z.object({
  verdict: z.object({
    headline: z.string(),
    summary: z.string().optional(),
  }),
  actions: z.array(
    z.object({
      priority: z.number().int().min(1).max(3), // 1 = mais importante, 3 = menos importante
      instruction: z.string(),
      before: z.string().optional(),
      after: z.string().optional(),
      expectedImpact: z.string().optional(),
    })
  ),
  title: z.object({
    suggested: z.string(),
    keywords: z.array(z.string()).optional(),
    rationale: z.string().optional(),
  }),
  description: z.object({
    bullets: z.array(z.string()),
    fullText: z.string().optional(),
  }),
  images: z.object({
    plan: z.array(
      z.object({
        slot: z.number().int().min(1),
        description: z.string(),
        purpose: z.string().optional(),
      })
    ),
  }),
  promo: z.object({
    priceBase: z.number().optional(),
    priceFinal: z.number().optional(),
    discount: z.number().optional(),
    recommendation: z.string().optional(),
  }).optional(),
=======
 * Ação concreta e acionável para melhorar o anúncio
 */
export const ActionItemV21Schema = z.object({
  id: z.string().describe('Identificador único da ação (ex: "add_video", "improve_title")'),
  type: z.enum(['title', 'description', 'media', 'price', 'stock', 'seo', 'promotion']).describe('Tipo da ação'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Prioridade da ação'),
  title: z.string().describe('Título curto da ação (ex: "Adicionar vídeo ao anúncio")'),
  description: z.string().describe('Descrição detalhada do problema e solução'),
  impact: z.object({
    metric: z.string().describe('Métrica impactada (ex: "conversão", "tráfego", "score")'),
    estimated_gain: z.string().describe('Ganho estimado (ex: "+15%", "+10 pontos")'),
    confidence: z.enum(['high', 'medium', 'low']).describe('Confiança na estimativa'),
  }),
  how_to: z.array(z.string()).describe('Passos concretos para implementar a ação'),
  ml_deeplink: z.string().optional().describe('Link direto para edição no Mercado Livre (se aplicável)'),
});

export type ActionItemV21 = z.infer<typeof ActionItemV21Schema>;

/**
 * Análise de título com sugestões
 */
export const TitleAnalysisV21Schema = z.object({
  current: z.string().describe('Título atual do anúncio'),
  score: z.number().min(0).max(100).describe('Score do título (0-100)'),
  issues: z.array(z.string()).describe('Problemas identificados no título'),
  suggestions: z.array(z.object({
    text: z.string().describe('Título sugerido'),
    focus: z.enum(['seo', 'conversion', 'promotion']).describe('Foco da sugestão'),
    rationale: z.string().describe('Por que este título é melhor'),
  })).describe('Sugestões de títulos alternativos'),
  keywords: z.object({
    present: z.array(z.string()).describe('Palavras-chave presentes'),
    missing: z.array(z.string()).describe('Palavras-chave recomendadas ausentes'),
    recommended: z.array(z.string()).describe('Palavras-chave recomendadas para adicionar'),
  }),
});

export type TitleAnalysisV21 = z.infer<typeof TitleAnalysisV21Schema>;

/**
 * Análise de descrição com sugestões
 */
export const DescriptionAnalysisV21Schema = z.object({
  current_length: z.number().describe('Comprimento atual da descrição em caracteres'),
  score: z.number().min(0).max(100).describe('Score da descrição (0-100)'),
  has_description: z.boolean().describe('Se o anúncio tem descrição'),
  issues: z.array(z.string()).describe('Problemas identificados na descrição'),
  structure: z.object({
    has_headline: z.boolean().describe('Tem headline/gancho inicial'),
    has_benefits: z.boolean().describe('Lista benefícios do produto'),
    has_specs: z.boolean().describe('Inclui especificações técnicas'),
    has_trust_elements: z.boolean().describe('Tem elementos de confiança (garantia, suporte)'),
  }),
  suggested_structure: z.array(z.object({
    section: z.string().describe('Nome da seção (ex: "Headline", "Benefícios")'),
    content: z.string().describe('Conteúdo sugerido para a seção'),
  })).describe('Estrutura sugerida para a descrição'),
});

export type DescriptionAnalysisV21 = z.infer<typeof DescriptionAnalysisV21Schema>;

/**
 * Análise de mídia (fotos e vídeos)
 */
export const MediaAnalysisV21Schema = z.object({
  photos: z.object({
    count: z.number().describe('Quantidade de fotos'),
    score: z.number().min(0).max(100).describe('Score das fotos (0-100)'),
    is_sufficient: z.boolean().describe('Se a quantidade é suficiente (>= 6)'),
    issues: z.array(z.string()).describe('Problemas identificados'),
    recommendations: z.array(z.string()).describe('Recomendações de melhoria'),
  }),
  video: z.object({
    has_video: z.boolean().nullable().describe('Se tem vídeo (null = não detectável)'),
    can_suggest: z.boolean().describe('Se pode sugerir adicionar vídeo'),
    status_message: z.string().describe('Mensagem sobre status do vídeo'),
    recommendation: z.string().nullable().describe('Recomendação sobre vídeo (se aplicável)'),
  }),
});

export type MediaAnalysisV21 = z.infer<typeof MediaAnalysisV21Schema>;

/**
 * Análise de preço e promoção
 */
export const PriceAnalysisV21Schema = z.object({
  price_base: z.number().describe('Preço base do anúncio'),
  price_final: z.number().describe('Preço final (com desconto, se houver)'),
  has_promotion: z.boolean().describe('Se tem promoção ativa'),
  discount_percent: z.number().nullable().describe('Percentual de desconto (se houver)'),
  score: z.number().min(0).max(100).describe('Score de competitividade de preço'),
  analysis: z.string().describe('Análise do preço em relação ao mercado'),
  recommendation: z.string().nullable().describe('Recomendação de preço (se aplicável)'),
});

export type PriceAnalysisV21 = z.infer<typeof PriceAnalysisV21Schema>;

/**
 * Diagnóstico geral do anúncio
 */
export const DiagnosticV21Schema = z.object({
  overall_health: z.enum(['critical', 'needs_attention', 'good', 'excellent']).describe('Saúde geral do anúncio'),
  main_bottleneck: z.string().describe('Principal gargalo identificado'),
  quick_wins: z.array(z.string()).describe('Vitórias rápidas (ações de alto impacto e baixo esforço)'),
  long_term: z.array(z.string()).describe('Melhorias de longo prazo'),
});

export type DiagnosticV21 = z.infer<typeof DiagnosticV21Schema>;

/**
 * Metadados da análise
 */
export const AnalysisMetaV21Schema = z.object({
  version: z.literal('2.1').describe('Versão do contrato'),
  model: z.string().describe('Modelo usado (ex: "gpt-4o")'),
  analyzed_at: z.string().describe('Data/hora da análise (ISO 8601)'),
  prompt_version: z.string().describe('Versão do prompt usado'),
  processing_time_ms: z.number().optional().describe('Tempo de processamento em ms'),
  cache_hit: z.boolean().optional().describe('Se foi cache hit'),
  error: z.string().optional().describe('Mensagem de erro (se houver falha parcial)'),
});

export type AnalysisMetaV21 = z.infer<typeof AnalysisMetaV21Schema>;

/**
 * Resultado completo da análise V2.1
 */
export const AIAnalysisResultV21Schema = z.object({
  meta: AnalysisMetaV21Schema,
  
  score: z.object({
    final: z.number().min(0).max(100).describe('Score final (0-100)'),
    breakdown: z.object({
      cadastro: z.number().min(0).max(20).describe('Score de cadastro (0-20)'),
      midia: z.number().min(0).max(20).describe('Score de mídia (0-20)'),
      performance: z.number().min(0).max(30).describe('Score de performance (0-30)'),
      seo: z.number().min(0).max(20).describe('Score de SEO (0-20)'),
      competitividade: z.number().min(0).max(10).describe('Score de competitividade (0-10)'),
    }),
    potential_gain: z.number().describe('Pontos que podem ser ganhos com melhorias'),
  }),
  
  diagnostic: DiagnosticV21Schema,
  
  title_analysis: TitleAnalysisV21Schema,
  
  description_analysis: DescriptionAnalysisV21Schema,
  
  media_analysis: MediaAnalysisV21Schema,
  
  price_analysis: PriceAnalysisV21Schema,
  
  actions: z.array(ActionItemV21Schema).describe('Lista de ações priorizadas'),
  
  critique: z.string().describe('Crítica geral do anúncio (200-400 chars)'),
  
  data_quality: z.object({
    visits_status: z.enum(['ok', 'partial', 'unavailable']).describe('Status dos dados de visitas'),
    performance_available: z.boolean().describe('Se dados de performance estão disponíveis'),
    warnings: z.array(z.string()).describe('Avisos sobre qualidade dos dados'),
  }),
>>>>>>> 97bc8bcb89a4380e2154f74201c70ff3d998efd1
});

export type AIAnalysisResultV21 = z.infer<typeof AIAnalysisResultV21Schema>;

/**
<<<<<<< HEAD
 * Adaptador V1 compatível gerado a partir de V2.1
 */
export interface V1CompatibleResult {
  critique: string;
  growthHacks: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: string;
  }>;
  seoSuggestions: {
    suggestedTitle: string;
    titleRationale: string;
    suggestedDescriptionPoints: string[];
    keywords: string[];
=======
 * Fallback seguro quando a análise falha
 */
export function createFallbackAnalysisV21(
  error: string,
  listingData: {
    title: string;
    price: number;
    price_final: number;
    has_promotion: boolean;
    discount_percent: number | null;
    pictures_count: number;
    has_clips: boolean | null;
    description_length: number;
  },
  scoreData: {
    final: number;
    breakdown: {
      cadastro: number;
      midia: number;
      performance: number;
      seo: number;
      competitividade: number;
    };
    potential_gain: number;
  },
  visitsStatus: 'ok' | 'partial' | 'unavailable',
  performanceAvailable: boolean
): AIAnalysisResultV21 {
  return {
    meta: {
      version: '2.1',
      model: 'fallback',
      analyzed_at: new Date().toISOString(),
      prompt_version: 'ai-v2.1',
      error,
    },
    score: {
      final: scoreData.final,
      breakdown: scoreData.breakdown,
      potential_gain: scoreData.potential_gain,
    },
    diagnostic: {
      overall_health: scoreData.final >= 80 ? 'good' : scoreData.final >= 60 ? 'needs_attention' : 'critical',
      main_bottleneck: 'Análise indisponível - verifique os dados manualmente',
      quick_wins: [],
      long_term: [],
    },
    title_analysis: {
      current: listingData.title,
      score: Math.min(100, Math.round(scoreData.breakdown.cadastro * 5)),
      issues: [],
      suggestions: [],
      keywords: {
        present: [],
        missing: [],
        recommended: [],
      },
    },
    description_analysis: {
      current_length: listingData.description_length,
      score: listingData.description_length > 0 ? 50 : 0,
      has_description: listingData.description_length > 0,
      issues: listingData.description_length === 0 ? ['Descrição ausente'] : [],
      structure: {
        has_headline: false,
        has_benefits: false,
        has_specs: false,
        has_trust_elements: false,
      },
      suggested_structure: [],
    },
    media_analysis: {
      photos: {
        count: listingData.pictures_count,
        score: Math.min(100, listingData.pictures_count * 10),
        is_sufficient: listingData.pictures_count >= 6,
        issues: listingData.pictures_count < 6 ? ['Poucas fotos'] : [],
        recommendations: [],
      },
      video: {
        has_video: listingData.has_clips,
        can_suggest: listingData.has_clips === false,
        status_message: listingData.has_clips === null 
          ? 'Status do vídeo não detectável via API'
          : listingData.has_clips 
            ? 'Vídeo presente'
            : 'Sem vídeo',
        recommendation: listingData.has_clips === false ? 'Adicionar vídeo pode aumentar conversão' : null,
      },
    },
    price_analysis: {
      price_base: listingData.price,
      price_final: listingData.price_final,
      has_promotion: listingData.has_promotion,
      discount_percent: listingData.discount_percent,
      score: 50,
      analysis: 'Análise de preço indisponível',
      recommendation: null,
    },
    actions: [],
    critique: `Não foi possível gerar análise completa: ${error}. Score calculado: ${scoreData.final}/100.`,
    data_quality: {
      visits_status: visitsStatus,
      performance_available: performanceAvailable,
      warnings: [error],
    },
>>>>>>> 97bc8bcb89a4380e2154f74201c70ff3d998efd1
  };
}

/**
<<<<<<< HEAD
 * Converte resultado V2.1 para formato V1 compatível
 */
export function convertV21ToV1(v21: AIAnalysisResultV21): V1CompatibleResult {
  // Mapear actions para growthHacks
  const growthHacks = v21.actions
    .sort((a, b) => a.priority - b.priority) // Ordenar por priority (1 = mais importante)
    .slice(0, 3) // Pegar apenas os 3 primeiros
    .map((action, index) => {
      // Mapear priority numérico para string
      let priorityStr: 'high' | 'medium' | 'low' = 'medium';
      if (action.priority === 1) priorityStr = 'high';
      else if (action.priority === 2) priorityStr = 'medium';
      else if (action.priority === 3) priorityStr = 'low';

      return {
        title: action.instruction.split('.')[0] || action.instruction.substring(0, 50), // Primeira frase ou primeiros 50 chars
        description: action.instruction + (action.expectedImpact ? ` ${action.expectedImpact}` : ''),
        priority: priorityStr,
        estimatedImpact: action.expectedImpact || 'Impacto a ser medido',
      };
    });

  return {
    critique: v21.verdict.headline + (v21.verdict.summary ? ` ${v21.verdict.summary}` : ''),
    growthHacks,
    seoSuggestions: {
      suggestedTitle: v21.title.suggested,
      titleRationale: v21.title.rationale || v21.title.suggested,
      suggestedDescriptionPoints: v21.description.bullets,
      keywords: v21.title.keywords || [],
    },
  };
=======
 * Valida e parseia resposta da IA para V2.1
 * Retorna resultado validado ou fallback em caso de erro
 */
export function parseAIResponseV21(
  rawResponse: unknown,
  listingData: {
    title: string;
    price: number;
    price_final: number;
    has_promotion: boolean;
    discount_percent: number | null;
    pictures_count: number;
    has_clips: boolean | null;
    description_length: number;
  },
  scoreData: {
    final: number;
    breakdown: {
      cadastro: number;
      midia: number;
      performance: number;
      seo: number;
      competitividade: number;
    };
    potential_gain: number;
  },
  visitsStatus: 'ok' | 'partial' | 'unavailable',
  performanceAvailable: boolean
): { success: true; data: AIAnalysisResultV21 } | { success: false; data: AIAnalysisResultV21; error: string } {
  try {
    const parsed = AIAnalysisResultV21Schema.parse(rawResponse);
    return { success: true, data: parsed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao validar resposta da IA';
    const fallback = createFallbackAnalysisV21(
      errorMessage,
      listingData,
      scoreData,
      visitsStatus,
      performanceAvailable
    );
    return { success: false, data: fallback, error: errorMessage };
  }
>>>>>>> 97bc8bcb89a4380e2154f74201c70ff3d998efd1
}
