import { z } from 'zod';

export const ActionDetailsV1Schema = z.object({
  summary: z.string().min(1),
  rationale: z.string().min(1),
  howToSteps: z.array(z.string().min(1)).min(3).max(7),
  doThisNow: z.array(z.string().min(1)).min(3).max(6),
  titleSuggestions: z.array(z.string().min(1)).length(3).optional(),
  descriptionTemplateBlocks: z.array(z.string().min(1)).min(2).optional(),
  benchmark: z.object({
    available: z.boolean(),
    explanation: z.string().min(1),
    estimationHeuristics: z.array(z.string().min(1)).optional(),
  }),
  confirmBeforeApplying: z.array(z.string().min(1)).min(1),
});

export type ActionDetailsV1 = z.infer<typeof ActionDetailsV1Schema>;

export interface BuildActionDetailsPromptInput {
  listing: {
    idExt: string;
    title: string;
    category?: string | null;
    breadcrumb?: string | null;
  };
  metrics30d: {
    visits: number;
    orders: number;
    conversionRate: number | null;
    revenue: number;
  };
  pricingNormalized: {
    price: number;
    priceFinal: number | null;
    originalPrice: number | null;
    hasPromotion: boolean;
    discountPercent: number | null;
  };
  benchmark: {
    available: boolean;
    confidence?: string | null;
    baselineConversionRate?: number | null;
    medianPrice?: number | null;
    p25Price?: number | null;
    p75Price?: number | null;
  };
  action: {
    actionKey: string;
    title: string;
    description: string;
    expectedImpact?: string | null;
    priority?: string | null;
    suggestedActionUrl?: string | null;
  };
}

export const ACTION_DETAILS_PROMPT_VERSION = 'action-details-v1';

export function buildActionDetailsPrompt(input: BuildActionDetailsPromptInput): string {
  return `Você é um especialista de growth para e-commerce no Mercado Livre.

Objetivo: expandir um card de ação curto em instruções práticas para execução.

Regras obrigatórias:
1) Responda APENAS JSON válido (sem markdown, sem comentários).
2) Use EXATAMENTE o formato ActionDetailsV1 abaixo.
3) Sempre inclua "howToSteps" (3-7 passos práticos).
4) Sempre inclua "doThisNow" (3-6 itens de checklist acionável).
5) Para ações de SEO/título/descrição: inclua SEMPRE "titleSuggestions" (3 opções) e "descriptionTemplateBlocks".
6) Em benchmark sem dados: benchmark.available=false + explique como estimar via heurísticas (top sellers da categoria, faixa de preço, quantidade de fotos, presença de vídeo).
7) Nunca invente atributos do produto. Se faltar info, inclua em "confirmBeforeApplying" frases como "confirmar X antes".
8) Idioma: Português do Brasil.

Formato ActionDetailsV1:
{
  "summary": "string",
  "rationale": "string",
  "howToSteps": ["string"],
  "doThisNow": ["string"],
  "titleSuggestions": ["string", "string", "string"],
  "descriptionTemplateBlocks": ["string", "string"],
  "benchmark": {
    "available": true,
    "explanation": "string",
    "estimationHeuristics": ["string"]
  },
  "confirmBeforeApplying": ["string"]
}

Input JSON:
${JSON.stringify(input, null, 2)}`;
}
