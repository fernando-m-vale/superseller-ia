/**
 * Normalização de resposta de análise IA
 * 
 * Converte snake_case (API) → camelCase (Frontend)
 * Mantém compatibilidade se já vier camelCase
 */

import type { AIAnalysisResponse } from '@/hooks/use-ai-analyze'

/**
 * Tipo normalizado para o frontend (camelCase)
 */
export interface NormalizedAIAnalysisV21 {
  verdict: string
  titleFix?: {
    problem: string
    impact: string
    before: string
    after: string
  }
  imagePlan?: Array<{
    image: number
    action: string
  }>
  descriptionFix?: {
    diagnostic: string
    optimizedCopy: string
  }
  priceFix?: {
    diagnostic: string
    action: string
  }
  algorithmHacks?: Array<{
    hack: string
    howToApply: string
    signalImpacted: string
  }>
  finalActionPlan?: string[]
  meta?: {
    version: string
    model: string
    analyzedAt: string
    promptVersion: string
    processingTimeMs?: number
  }
}

/**
 * Tipo completo normalizado incluindo dados V1
 */
export interface NormalizedAIAnalysisResponse extends Omit<AIAnalysisResponse, 'analysisV21' | 'seoSuggestions' | 'actionPlan' | 'benchmark'> {
  analysisV21?: NormalizedAIAnalysisV21
  seoSuggestions?: {
    suggestedTitle?: string
    suggestedDescriptionPoints?: string[]
  }
  // Campos adicionais para renderização (actionPlan do Expert)
  actionPlan?: Array<{
    id: string
    type: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    description: string
    impact?: {
      metric: string
      estimatedGain: string
      confidence?: string
    }
    howTo?: string[]
    mlDeeplink?: string
  }>
  // Benchmark (Dia 04) - mantém formato original
  benchmark?: AIAnalysisResponse['benchmark']
}

/**
 * Normaliza analysisV21 de snake_case para camelCase
 */
function normalizeAnalysisV21(raw: unknown): NormalizedAIAnalysisV21 | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const rawObj = raw as Record<string, unknown>

  // Se já estiver normalizado (tem camelCase), retornar como está
  if (rawObj.titleFix && rawObj.descriptionFix && rawObj.verdict) {
    return rawObj as unknown as NormalizedAIAnalysisV21
  }

  // Normalizar de snake_case para camelCase
  const titleFixRaw = rawObj.title_fix as Record<string, unknown> | undefined
  const imagePlanRaw = rawObj.image_plan as Array<Record<string, unknown>> | undefined
  const descriptionFixRaw = rawObj.description_fix as Record<string, unknown> | undefined
  const priceFixRaw = rawObj.price_fix as Record<string, unknown> | undefined
  const algorithmHacksRaw = rawObj.algorithm_hacks as Array<Record<string, unknown>> | undefined
  const metaRaw = rawObj.meta as Record<string, unknown> | undefined

  return {
    verdict: (rawObj.verdict as string) || '',
    titleFix: titleFixRaw ? {
      problem: (titleFixRaw.problem as string) || '',
      impact: (titleFixRaw.impact as string) || '',
      before: (titleFixRaw.before as string) || '',
      after: (titleFixRaw.after as string) || '',
    } : undefined,
    imagePlan: imagePlanRaw?.map((item) => ({
      image: (item.image as number) || 0,
      action: (item.action as string) || '',
    })) || (rawObj.imagePlan as NormalizedAIAnalysisV21['imagePlan']),
    descriptionFix: descriptionFixRaw ? {
      diagnostic: (descriptionFixRaw.diagnostic as string) || '',
      optimizedCopy: (descriptionFixRaw.optimized_copy as string) || '',
    } : undefined,
    priceFix: priceFixRaw ? {
      diagnostic: (priceFixRaw.diagnostic as string) || '',
      action: (priceFixRaw.action as string) || '',
    } : undefined,
    algorithmHacks: algorithmHacksRaw?.map((hack) => ({
      hack: (hack.hack as string) || '',
      howToApply: (hack.how_to_apply as string) || '',
      signalImpacted: (hack.signal_impacted as string) || '',
    })) || (rawObj.algorithmHacks as NormalizedAIAnalysisV21['algorithmHacks']),
    finalActionPlan: (rawObj.final_action_plan as string[]) || (rawObj.finalActionPlan as string[]),
    meta: metaRaw ? {
      version: (metaRaw.version as string) || '',
      model: (metaRaw.model as string) || '',
      analyzedAt: (metaRaw.analyzed_at as string) || (metaRaw.analyzedAt as string) || '',
      promptVersion: (metaRaw.prompt_version as string) || (metaRaw.promptVersion as string) || '',
      processingTimeMs: (metaRaw.processing_time_ms as number) || (metaRaw.processingTimeMs as number),
    } : undefined,
  }
}

/**
 * Converte finalActionPlan e algorithmHacks em actionPlan (formato de cards)
 */
function buildActionPlan(
  analysisV21: NormalizedAIAnalysisV21 | undefined
): Array<{
  id: string
  type: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  impact?: {
    metric: string
    estimatedGain: string
    confidence?: string
  }
  howTo?: string[]
  mlDeeplink?: string
}> {
  const actions: Array<{
    id: string
    type: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    description: string
    impact?: {
      metric: string
      estimatedGain: string
      confidence?: string
    }
    howTo?: string[]
    mlDeeplink?: string
  }> = []

  if (!analysisV21) return actions

  // Adicionar ações do finalActionPlan
  if (analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0) {
    analysisV21.finalActionPlan.forEach((action, index) => {
      actions.push({
        id: `action-${index}`,
        type: 'general',
        priority: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
        title: action,
        description: action,
      })
    })
  }

  // Adicionar hacks algorítmicos
  if (analysisV21.algorithmHacks && analysisV21.algorithmHacks.length > 0) {
    analysisV21.algorithmHacks.forEach((hack, index) => {
      actions.push({
        id: `hack-${index}`,
        type: 'algorithm',
        priority: 'high',
        title: hack.hack,
        description: hack.howToApply,
        impact: {
          metric: hack.signalImpacted,
          estimatedGain: 'Alto',
          confidence: 'high',
        },
        howTo: [hack.howToApply],
      })
    })
  }

  return actions
}

/**
 * Normaliza resposta completa da API
 */
export function normalizeAiAnalyzeResponse(
  response: AIAnalysisResponse
): NormalizedAIAnalysisResponse {
  // Converter seoSuggestions se necessário
  const seoSuggestionsNormalized = response.seoSuggestions 
    ? {
        suggestedTitle: 'title' in response.seoSuggestions ? (response.seoSuggestions as { title?: string }).title : undefined,
        suggestedDescriptionPoints: 'description' in response.seoSuggestions 
          ? [(response.seoSuggestions as { description?: string }).description || ''].filter(Boolean)
          : 'suggestedDescriptionPoints' in response.seoSuggestions
          ? (response.seoSuggestions as { suggestedDescriptionPoints?: string[] }).suggestedDescriptionPoints
          : undefined,
      }
    : undefined

  // Remover actionPlan original antes de criar o novo
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { actionPlan, ...responseWithoutActionPlan } = response

  const normalized: NormalizedAIAnalysisResponse = {
    ...responseWithoutActionPlan,
    analysisV21: normalizeAnalysisV21(response.analysisV21),
    seoSuggestions: seoSuggestionsNormalized,
  }

  // Construir actionPlan a partir de analysisV21
  normalized.actionPlan = buildActionPlan(normalized.analysisV21)

  // Logs de debug (dev-only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[NORMALIZE-AI] Normalized response', {
      hasAnalysisV21: !!normalized.analysisV21,
      hasTitleFix: !!normalized.analysisV21?.titleFix,
      hasDescriptionFix: !!normalized.analysisV21?.descriptionFix,
      hasPriceFix: !!normalized.analysisV21?.priceFix,
      hasImagePlan: !!normalized.analysisV21?.imagePlan?.length,
      algorithmHacksCount: normalized.analysisV21?.algorithmHacks?.length || 0,
      finalActionPlanCount: normalized.analysisV21?.finalActionPlan?.length || 0,
      actionPlanCount: normalized.actionPlan?.length || 0,
      fieldsUsed: {
        title: normalized.analysisV21?.titleFix?.after || normalized.seoSuggestions?.suggestedTitle || 'NONE',
        description: normalized.analysisV21?.descriptionFix?.optimizedCopy || 'NONE',
        actions: normalized.actionPlan?.length || 0,
        algorithmHacks: normalized.analysisV21?.algorithmHacks?.length || 0,
      },
    })
  }

  return normalized
}
