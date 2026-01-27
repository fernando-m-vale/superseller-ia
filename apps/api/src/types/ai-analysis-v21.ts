/**
 * AI Analysis Result V2.1
 * 
 * Estrutura JSON estruturada retornada pela IA V2.1.
 * Mais rica e estruturada que V1, com actions, title, description, images, promo.
 */

import { z } from 'zod';

/**
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
});

export type AIAnalysisResultV21 = z.infer<typeof AIAnalysisResultV21Schema>;

/**
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
  };
}

/**
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
}
