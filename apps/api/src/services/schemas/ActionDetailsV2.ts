import { z } from 'zod';

/**
 * JsonValueSchema - Schema recursivo compatível com JSON válido
 * 
 * Garante que valores sejam JSON-safe (sem unknown, sem funções, etc)
 * Compatível com Prisma.InputJsonValue
 */
export const JsonValueSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
);

export type JsonValue = z.infer<typeof JsonValueSchema>;

/**
 * ActionDetailsV2 - Schema com artifacts tipados e específicos por ActionType
 * 
 * Estrutura modular: cada ActionType pode ter artifacts diferentes (required/optional)
 * Validação via validateArtifacts.ts garante que requiredArtifacts estão presentes
 */

export const TitleSuggestionV2Schema = z.object({
  variation: z.enum(['A', 'B', 'C']),
  text: z.string().min(1).max(60),
  rationale: z.string().optional(),
});

export const DescriptionTemplateV2Schema = z.object({
  headline: z.string().min(1),
  blocks: z.array(z.string().min(1)).min(2),
  bullets: z.array(z.string().min(1)).min(3).optional(),
  cta: z.string().optional(),
});

export const GallerySlotV2Schema = z.object({
  slotNumber: z.number().int().min(1).max(12),
  objective: z.string().min(1), // "mostrar uso real", "close técnico", etc
  whatToShow: z.string().min(1), // descrição do que mostrar
  overlaySuggestion: z.string().optional(), // texto de overlay se aplicável
});

export const VideoScriptV2Schema = z.object({
  hook: z.string().min(1), // primeiros 3-5 segundos
  scenes: z.array(z.object({
    order: z.number().int().min(1),
    description: z.string().min(1),
    durationSeconds: z.number().int().min(1).optional(),
  })).min(2),
});

export const PriceSuggestionV2Schema = z.object({
  suggestedPrice: z.number().positive(),
  rationale: z.string().min(1),
  expectedImpact: z.string().optional(),
});

export const VariationSuggestionV2Schema = z.object({
  attributeName: z.string().min(1), // "Cor", "Tamanho", etc
  values: z.array(z.string().min(1)).min(2),
  rationale: z.string().optional(),
});

export const KitSuggestionV2Schema = z.object({
  comboTitle: z.string().min(1),
  items: z.array(z.string().min(1)).min(2),
  suggestedPrice: z.number().positive().optional(),
  rationale: z.string().optional(),
});

export const TechSpecSuggestionV2Schema = z.object({
  attributeName: z.string().min(1),
  suggestedValue: z.string().min(1),
  howToConfirm: z.string().min(1), // como o usuário confirma este valor
});

export const TrustGuaranteeSuggestionV2Schema = z.object({
  type: z.enum(['warranty', 'return_policy', 'shipping', 'quality_seal', 'social_proof']),
  text: z.string().min(1),
  placement: z.enum(['title', 'description', 'bullets', 'badge']).optional(),
});

export const KeywordSuggestionV2Schema = z.object({
  keyword: z.string().min(1),
  placement: z.enum(['title', 'description', 'bullets']),
  rationale: z.string().optional(),
});

// Schema principal ActionDetailsV2
export const ActionDetailsV2Schema = z.object({
  version: z.literal('action_details_v2'),
  
  // Campos base (sempre presentes)
  whyThisMatters: z.string().min(1),
  howToSteps: z.array(z.string().min(1)).min(3).max(10),
  doThisNow: z.array(z.string().min(1)).min(3).max(8),
  
  // Artifacts específicos (opcionais, mas validados por ActionType)
  artifacts: z.object({
    // SEO / Title
    copy: z.object({
      titleSuggestions: z.array(TitleSuggestionV2Schema).min(3).max(5).optional(),
      descriptionTemplate: DescriptionTemplateV2Schema.optional(),
      bulletSuggestions: z.array(z.string().min(1)).min(3).optional(),
      keywordSuggestions: z.array(KeywordSuggestionV2Schema).min(3).optional(),
    }).optional(),
    
    // Media
    media: z.object({
      galleryPlan: z.array(GallerySlotV2Schema).min(6).max(12).optional(),
      videoScript: VideoScriptV2Schema.optional(),
    }).optional(),
    
    // Pricing
    pricing: z.object({
      suggestions: z.array(PriceSuggestionV2Schema).min(1).max(3).optional(),
    }).optional(),
    
    // Variations / Kits
    variations: z.array(VariationSuggestionV2Schema).optional(),
    kits: z.array(KitSuggestionV2Schema).optional(),
    
    // Tech Specs
    techSpecs: z.array(TechSpecSuggestionV2Schema).optional(),
    
    // Trust / Guarantees
    trustGuarantees: z.array(TrustGuaranteeSuggestionV2Schema).optional(),
  }).optional(),
  
  // Benchmark (mantido compatível com V1)
  benchmark: z.object({
    available: z.boolean(),
    notes: z.string().optional(),
    data: JsonValueSchema.optional(), // JSON-safe ao invés de unknown
  }),
  
  // Metadados
  impact: z.enum(['low', 'medium', 'high']).optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  
  // Inputs requeridos que faltam (para fallback/retry)
  requiredInputs: z.array(z.object({
    field: z.string(),
    howToConfirm: z.string(),
  })).optional(),
});

export type ActionDetailsV2 = z.infer<typeof ActionDetailsV2Schema>;
export type TitleSuggestionV2 = z.infer<typeof TitleSuggestionV2Schema>;
export type DescriptionTemplateV2 = z.infer<typeof DescriptionTemplateV2Schema>;
export type GallerySlotV2 = z.infer<typeof GallerySlotV2Schema>;
export type VideoScriptV2 = z.infer<typeof VideoScriptV2Schema>;
export type PriceSuggestionV2 = z.infer<typeof PriceSuggestionV2Schema>;
export type VariationSuggestionV2 = z.infer<typeof VariationSuggestionV2Schema>;
export type KitSuggestionV2 = z.infer<typeof KitSuggestionV2Schema>;
export type TechSpecSuggestionV2 = z.infer<typeof TechSpecSuggestionV2Schema>;
export type TrustGuaranteeSuggestionV2 = z.infer<typeof TrustGuaranteeSuggestionV2Schema>;
export type KeywordSuggestionV2 = z.infer<typeof KeywordSuggestionV2Schema>;
