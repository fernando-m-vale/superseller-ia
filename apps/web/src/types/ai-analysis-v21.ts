/**
 * Contrato da análise especialista servido em `analysisV21`.
 * Mantém compatibilidade com respostas legadas e com o schema v23.
 */

export interface AnalysisMetaV21 {
  version: string
  model: string
  analyzed_at: string
  prompt_version: string
  processing_time_ms?: number
  cache_hit?: boolean
  error?: string
}

export interface AIAnalysisResultV21 {
  score?: number
  scoreBreakdown?: {
    descoberta?: number
    clique?: number
    conversao?: number
    crescimento?: number
  }
  performanceSignal?: 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO'
  verdict?:
    | string
    | {
        headline?: string
        diagnosis?: string
        whatIsWorking?: string
        rootCause?: string
        rootCauseCode?: string
        performanceSignal?: 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO'
      }
  funnelAnalysis?: {
    descoberta?: { score?: number; status?: 'ok' | 'atencao' | 'critico'; insight?: string }
    clique?: { score?: number; status?: 'ok' | 'atencao' | 'critico'; insight?: string }
    conversao?: { score?: number; status?: 'ok' | 'atencao' | 'critico'; insight?: string }
    crescimento?: { score?: number; status?: 'ok' | 'atencao' | 'critico'; insight?: string }
  }
  potentialGain?: {
    estimatedVisitsIncrease?: string
    estimatedConversionIncrease?: string
    estimatedRevenueIncrease?: string
    confidence?: 'alta' | 'media' | 'baixa'
  }
  growthHacks?: Array<{
    id: string
    actionKey?: string
    pillar?: string
    funnelStage?: string
    priority?: 'high' | 'medium' | 'low'
    impact?: 'high' | 'medium' | 'low'
    effort?: 'low' | 'medium' | 'high'
    title?: string
    summary?: string
    description?: string
    readyCopy?: string
    expectedImpact?: string
    impactReason?: string
    actionGroup?: 'immediate' | 'support' | 'optional'
    rootCauseCode?: string
  }>
  adsIntelligence?: {
    status?: 'available' | 'unavailable' | 'no_campaign'
    summary?: string
    recommendation?: string
  }
  executionRoadmap?: Array<{
    stepNumber: number
    actionId?: string
    actionTitle?: string
    reason?: string
    expectedImpact?: string
  }>

  title_fix?: {
    problem: string
    impact: string
    before: string
    after: string
  }
  image_plan?: Array<{
    image: number
    action: string
  }>
  description_fix?: {
    diagnostic: string
    optimized_copy: string
  }
  price_fix?: {
    diagnostic: string
    action: string
  }
  algorithm_hacks?: Array<{
    hack: string
    how_to_apply: string
    signal_impacted: string
  }>
  final_action_plan?: string[]
  meta: AnalysisMetaV21
}
