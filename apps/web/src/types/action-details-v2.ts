/**
 * Tipos TypeScript para ActionDetailsV2 (frontend)
 * 
 * Mantém compatibilidade com estrutura do backend ActionDetailsV2Schema
 */

export interface TitleSuggestionV2 {
  variation: 'A' | 'B' | 'C'
  text: string
  rationale?: string
}

export interface DescriptionTemplateV2 {
  headline: string
  blocks: string[]
  bullets?: string[]
  cta?: string
}

export interface GallerySlotV2 {
  slotNumber: number
  objective: string
  whatToShow: string
  overlaySuggestion?: string
}

export interface VideoScriptV2 {
  hook: string
  scenes: Array<{
    order: number
    description: string
    durationSeconds?: number
  }>
}

export interface PriceSuggestionV2 {
  suggestedPrice: number
  rationale: string
  expectedImpact?: string
}

export interface VariationSuggestionV2 {
  attributeName: string
  values: string[]
  rationale?: string
}

export interface KitSuggestionV2 {
  comboTitle: string
  items: string[]
  suggestedPrice?: number
  rationale?: string
}

export interface TechSpecSuggestionV2 {
  attributeName: string
  suggestedValue: string
  howToConfirm: string
}

export interface TrustGuaranteeSuggestionV2 {
  type: 'warranty' | 'return_policy' | 'shipping' | 'quality_seal' | 'social_proof'
  text: string
  placement?: 'title' | 'description' | 'bullets' | 'badge'
}

export interface KeywordSuggestionV2 {
  keyword: string
  placement: 'title' | 'description' | 'bullets'
  rationale?: string
}

export interface ActionDetailsV2 {
  version: 'action_details_v2'
  whyThisMatters: string
  howToSteps: string[]
  doThisNow: string[]
  artifacts?: {
    copy?: {
      titleSuggestions?: TitleSuggestionV2[]
      descriptionTemplate?: DescriptionTemplateV2
      bulletSuggestions?: string[]
      keywordSuggestions?: KeywordSuggestionV2[]
    }
    media?: {
      galleryPlan?: GallerySlotV2[]
      videoScript?: VideoScriptV2
    }
    pricing?: {
      suggestions?: PriceSuggestionV2[]
    }
    variations?: VariationSuggestionV2[]
    kits?: KitSuggestionV2[]
    techSpecs?: TechSpecSuggestionV2[]
    trustGuarantees?: TrustGuaranteeSuggestionV2[]
  }
  benchmark: {
    available: boolean
    notes?: string
    data?: unknown
  }
  impact?: 'low' | 'medium' | 'high'
  effort?: 'low' | 'medium' | 'high'
  priority?: 'critical' | 'high' | 'medium' | 'low'
  confidence?: 'high' | 'medium' | 'low'
  requiredInputs?: Array<{
    field: string
    howToConfirm: string
  }>
}
