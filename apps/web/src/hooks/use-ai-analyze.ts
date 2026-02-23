'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import type { AIAnalysisResultV21 } from '@/types/ai-analysis-v21'
import type { NormalizedAIAnalysisResponse } from '@/lib/ai/normalizeAiAnalyze'

// Interface da resposta da API (formato bruto)
interface AIAnalysisApiResponse {
  listingId: string
  score: number
  scoreBreakdown?: {
    cadastro: number
    midia: number
    performance: number
    seo: number
    competitividade: number
  }
  potentialGain?: {
    cadastro?: string
    midia?: string
    performance?: string
    seo?: string
    competitividade?: string
  }
  critique: string
  growthHacks?: Array<{
    id: string
    title: string
    summary: string
    why: string[]
    impact: 'low' | 'medium' | 'high'
    confidence: number
    confidenceLevel: 'low' | 'medium' | 'high'
    evidence: string[]
    suggestedActionUrl?: string | null
  }>
  growthHacksMeta?: {
    rulesEvaluated: number
    rulesTriggered: number
    skippedBecauseOfHistory: number
    skippedBecauseOfRequirements: number
  }
  seoSuggestions: {
    suggestedTitle: string
    titleRationale: string
    suggestedDescriptionPoints: string[]
    keywords: string[]
  }
  savedRecommendations: number
  analyzedAt: string
  model: string
  metrics30d?: {
    visits: number
    orders: number
    revenue: number | null
    conversionRate: number | null
    ctr: number | null
  }
  dataQuality?: {
    completenessScore: number
    visitsCoverage?: {
      filledDays: number
      totalDays: number
    }
    performanceAvailable?: boolean
    sources: {
      performance: 'listing_metrics_daily' | 'listing_aggregates'
    }
  }
  cacheHit?: boolean
  // IA Score V2 - Onda 1
  actionPlan?: Array<{
    dimension: 'cadastro' | 'midia' | 'performance' | 'seo' | 'competitividade'
    lostPoints: number
    whyThisMatters: string
    expectedScoreAfterFix: number
    priority: 'high' | 'medium' | 'low'
  }>
  scoreExplanation?: string[]
  // MediaVerdict - Fonte única de verdade para mídia (clip/vídeo)
  mediaVerdict?: {
    hasClipDetected: boolean | null
    canSuggestClip: boolean
    message: string
    shortMessage: string
  }
  // V2.1 - Análise estruturada (opcional)
  analysisV21?: AIAnalysisResultV21
  // Benchmark (Dia 04)
  benchmark?: {
    benchmarkSummary: {
      categoryId: string | null
      sampleSize: number
      computedAt: string
      confidence: 'high' | 'medium' | 'low' | 'unavailable'
      notes?: string
      stats?: {
        medianPicturesCount: number
        percentageWithVideo: number
        medianPrice: number
        medianTitleLength: number
        sampleSize: number
      }
      baselineConversion?: {
        conversionRate: number | null
        sampleSize: number
        totalVisits: number
        confidence: 'high' | 'medium' | 'low' | 'unavailable'
      }
    }
    youWinHere: string[]
    youLoseHere: string[]
    tradeoffs?: string
    recommendations?: string[]
  } | null
  // Benchmark Insights (Dia 05) - insights acionáveis
  benchmarkInsights?: {
    confidence: 'high' | 'medium' | 'low' | 'unavailable'
    wins: Array<{ message: string; evidence?: string }>
    losses: Array<{ message: string; evidence?: string }>
    criticalGaps: Array<{
      id: string
      dimension: 'price' | 'title' | 'images' | 'video' | 'description'
      title: string
      whyItMatters: string
      impact: 'high' | 'medium' | 'low'
      effort: 'low' | 'medium' | 'high'
      confidence: 'high' | 'medium' | 'low'
      metrics?: Record<string, number | string>
    }>
  }
  // Generated Content (Dia 05) - conteúdo pronto para copy/paste
  generatedContent?: {
    titles: Array<{ variation: 'A' | 'B' | 'C'; text: string }>
    bullets: string[]
    seoDescription: {
      short: string
      long: string
    }
  }
  // Promo estruturado (HOTFIX P0)
  promo?: {
    hasPromotion: boolean
    originalPrice: number | null
    finalPrice: number | null
    discountPercent: number | null
    promoText?: string | null
    source: string
    checkedAt: string | null
  }
  // DIA 06.2: Preços normalizados para garantir consistência
  pricingNormalized?: {
    originalPriceForDisplay: number
    finalPriceForDisplay: number
    hasPromotion: boolean
  }
  // Applied Actions (Dia 06)
  appliedActions?: Array<{
    actionType: string
    appliedAt: string
  }>
}

// Interface adaptada para o frontend
export interface AIAnalysisResponse {
  listingId: string
  score: number
  scoreBreakdown?: {
    cadastro: number
    midia: number
    performance: number
    seo: number
    competitividade: number
  }
  potentialGain?: {
    cadastro?: string
    midia?: string
    performance?: string
    seo?: string
    competitividade?: string
  }
  critique: string
  growthHacks?: Array<{
    id: string
    title: string
    summary: string
    why: string[]
    impact: 'low' | 'medium' | 'high'
    confidence: number
    confidenceLevel: 'low' | 'medium' | 'high'
    evidence: string[]
    suggestedActionUrl?: string | null
  }>
  growthHacksMeta?: {
    rulesEvaluated: number
    rulesTriggered: number
    skippedBecauseOfHistory: number
    skippedBecauseOfRequirements: number
  }
  seoSuggestions: {
    title: string
    description: string
  }
  savedRecommendations: number
  analyzedAt: string
  model: string
  metrics30d?: {
    visits: number
    orders: number
    revenue: number | null
    conversionRate: number | null
    ctr: number | null
  }
  dataQuality?: {
    completenessScore: number
    visitsCoverage?: {
      filledDays: number
      totalDays: number
    }
    performanceAvailable?: boolean
    sources: {
      performance: 'listing_metrics_daily' | 'listing_aggregates'
    }
  }
  cacheHit?: boolean
  // IA Score V2 - Onda 1
  actionPlan?: Array<{
    dimension: 'cadastro' | 'midia' | 'performance' | 'seo' | 'competitividade'
    lostPoints: number
    whyThisMatters: string
    expectedScoreAfterFix: number
    priority: 'high' | 'medium' | 'low'
  }>
  scoreExplanation?: string[]
  // MediaVerdict - Fonte única de verdade para mídia (clip/vídeo)
  mediaVerdict?: {
    hasClipDetected: boolean | null
    canSuggestClip: boolean
    message: string
    shortMessage: string
  }
  // V2.1 - Análise estruturada (opcional)
  analysisV21?: AIAnalysisResultV21
  // Benchmark (Dia 04)
  benchmark?: {
    benchmarkSummary: {
      categoryId: string | null
      sampleSize: number
      computedAt: string
      confidence: 'high' | 'medium' | 'low' | 'unavailable'
      notes?: string
      stats?: {
        medianPicturesCount: number
        percentageWithVideo: number
        medianPrice: number
        medianTitleLength: number
        sampleSize: number
      }
      baselineConversion?: {
        conversionRate: number | null
        sampleSize: number
        totalVisits: number
        confidence: 'high' | 'medium' | 'low' | 'unavailable'
      }
    }
    youWinHere: string[]
    youLoseHere: string[]
    tradeoffs?: string
    recommendations?: string[]
  } | null
  // Benchmark Insights (Dia 05) - insights acionáveis
  benchmarkInsights?: {
    confidence: 'high' | 'medium' | 'low' | 'unavailable'
    wins: Array<{ message: string; evidence?: string }>
    losses: Array<{ message: string; evidence?: string }>
    criticalGaps: Array<{
      id: string
      dimension: 'price' | 'title' | 'images' | 'video' | 'description'
      title: string
      whyItMatters: string
      impact: 'high' | 'medium' | 'low'
      effort: 'low' | 'medium' | 'high'
      confidence: 'high' | 'medium' | 'low'
      metrics?: Record<string, number | string>
    }>
  }
  // Generated Content (Dia 05) - conteúdo pronto para copy/paste
  generatedContent?: {
    titles: Array<{ variation: 'A' | 'B' | 'C'; text: string }>
    bullets: string[]
    seoDescription: {
      short: string
      long: string
    }
  }
  // Promo estruturado (HOTFIX P0)
  promo?: {
    hasPromotion: boolean
    originalPrice: number | null
    finalPrice: number | null
    discountPercent: number | null
    promoText?: string | null
    source: string
    checkedAt: string | null
  }
  // DIA 06.2: Preços normalizados para garantir consistência
  pricingNormalized?: {
    originalPriceForDisplay: number
    finalPriceForDisplay: number
    hasPromotion: boolean
  }
  // Applied Actions (Dia 06)
  appliedActions?: Array<{
    actionType: string
    appliedAt: string
  }>
}

/**
 * Adapter que converte a resposta da API para o formato esperado pelo frontend
 */
function adaptAIAnalysisResponse(apiResponse: AIAnalysisApiResponse): AIAnalysisResponse {
  // Converter seoSuggestions
  const seoDescription = [
    ...(apiResponse.seoSuggestions.suggestedDescriptionPoints || []),
    ...(apiResponse.seoSuggestions.keywords?.map(k => `#${k}`) || []),
  ].join('\n')

  return {
    listingId: apiResponse.listingId,
    score: apiResponse.score,
    scoreBreakdown: apiResponse.scoreBreakdown,
    potentialGain: apiResponse.potentialGain,
    critique: apiResponse.critique,
    growthHacks: apiResponse.growthHacks || [],
    growthHacksMeta: apiResponse.growthHacksMeta,
    seoSuggestions: {
      title: apiResponse.seoSuggestions.suggestedTitle || '',
      description: seoDescription,
    },
    savedRecommendations: apiResponse.savedRecommendations,
    analyzedAt: apiResponse.analyzedAt,
    model: apiResponse.model,
    metrics30d: apiResponse.metrics30d,
    dataQuality: apiResponse.dataQuality,
    cacheHit: apiResponse.cacheHit,
    // IA Score V2 - Onda 1
    actionPlan: apiResponse.actionPlan,
    scoreExplanation: apiResponse.scoreExplanation,
    // MediaVerdict - Fonte única de verdade para mídia
    mediaVerdict: apiResponse.mediaVerdict,
    // V2.1 - Análise estruturada (opcional, não processada pelo adaptador)
    // Será preenchido diretamente do response após adaptação
    analysisV21: undefined,
    // Benchmark (Dia 04) - não processado pelo adaptador, será preenchido diretamente do response
    // Não incluir aqui pois é opcional e será lido de result.data.benchmark
    // Benchmark Insights (Dia 05) - será preenchido diretamente do response
    benchmarkInsights: apiResponse.benchmarkInsights,
    // Generated Content (Dia 05) - será preenchido diretamente do response
    generatedContent: apiResponse.generatedContent,
  }
}

export interface AIAnalysisState {
  data: NormalizedAIAnalysisResponse | null
  isLoading: boolean
  error: string | null
  // Metadados para UX de cache
  analyzedAt?: string // analysisV21?.meta?.analyzedAt
  cacheHit?: boolean // response.data?.cacheHit ou message includes "(cache)"
  message?: string // response.data?.message
}

interface ErrorWithStatusCode extends Error {
  statusCode?: number
  errorData?: {
    message?: string
    error?: string
    details?: string
  }
}

/**
 * Hook para gerenciar análise de IA de um listing
 */
export function useAIAnalyze(listingId: string | null) {
  const [state, setState] = useState<AIAnalysisState>({
    data: null,
    isLoading: false,
    error: null,
    analyzedAt: undefined,
    cacheHit: undefined,
    message: undefined,
  })

  // HOTFIX 09.5: refs para evitar dependência direta de `state` dentro de callbacks
  // Isso evita recriar funções e re-disparar effects (ex: fetchExisting) sem necessidade.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // HOTFIX 09.3: Single-flight guard para evitar múltiplas chamadas simultâneas
  const isFetchingExistingRef = useRef<boolean>(false)
  
  // HOTFIX 09.4: Anti-loop latch definitivo por listingId
  const fetchAttemptStatusRef = useRef<Map<string, 'idle' | 'inflight' | 'done' | 'failed'>>(new Map())

  // Resetar COMPLETAMENTE o state quando listingId mudar
  // Isso evita misturar dados entre anúncios diferentes
  useEffect(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
      analyzedAt: undefined,
      cacheHit: undefined,
      message: undefined,
    })
    // Resetar guards ao mudar listingId
    isFetchingExistingRef.current = false
    if (listingId) {
      fetchAttemptStatusRef.current.delete(listingId)
    }
  }, [listingId])

  const analyze = async (forceRefresh: boolean = false): Promise<void> => {
    // Proteção: evitar múltiplas requisições simultâneas
    if (state.isLoading) {
      console.warn('[AI-ANALYZE] Already loading, skipping request', { listingId })
      return
    }
    if (!listingId) {
      console.error('[AI-ANALYZE] No listingId provided')
      setState({ data: null, isLoading: false, error: 'ID do anúncio não fornecido' })
      return
    }

    console.log('[AI-ANALYZE] Starting analysis', { listingId, forceRefresh })
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      // Build URL with forceRefresh query param if needed
      // Tentar query param primeiro (preferencial)
      const url = forceRefresh 
        ? `${apiUrl}/ai/analyze/${listingId}?forceRefresh=true`
        : `${apiUrl}/ai/analyze/${listingId}`

      console.log('[AI-ANALYZE] POST request', { url, listingId, forceRefresh })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // REQUIRED: Fastify strict mode requires a valid JSON body
      })
      
      console.log('[AI-ANALYZE] Response status', { status: response.status, listingId })

      if (!response.ok) {
        // Log detalhado do erro para debugging
        const statusCode = response.status
        let errorData: { message?: string; error?: string; details?: string } = {}
        
        try {
          errorData = await response.json()
        } catch {
          // Se não conseguir parsear JSON, usar mensagem padrão
          errorData = { message: 'Erro desconhecido' }
        }

        // Log erro sem detalhes sensíveis (sem response completo)
        console.error('[AI-ANALYZE] Erro na análise:', {
          statusCode,
          listingId,
        })

        // Mensagens específicas por código de status
        let errorMessage = 'Não foi possível gerar a análise. Tente novamente em alguns instantes.'
        
        if (statusCode === 429) {
          errorMessage = 'Limite de uso da IA atingido. Tente novamente mais tarde.'
        } else if (statusCode === 500) {
          errorMessage = 'Erro interno do servidor. Nossa equipe foi notificada. Tente novamente em alguns instantes.'
        } else if (statusCode === 504) {
          errorMessage = 'Tempo de resposta excedido. O serviço de IA pode estar sobrecarregado. Tente novamente em alguns instantes.'
        } else if (statusCode === 503) {
          errorMessage = 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.'
        } else if (statusCode === 401 || statusCode === 403) {
          errorMessage = 'Erro de autenticação. Por favor, faça login novamente.'
        } else if (statusCode === 404) {
          errorMessage = 'Anúncio não encontrado. Verifique se o anúncio ainda existe.'
        } else if (errorData.message) {
          errorMessage = String(errorData.message) // Garantir que seja string
        }

        const error: ErrorWithStatusCode = new Error(errorMessage)
        error.statusCode = statusCode
        error.errorData = errorData
        throw error
      }

      const result = await response.json()
      
      console.log('[AI-ANALYZE] Response received', { 
        listingId,
        responseListingId: result.data?.listingId,
        hasAnalysisV21: !!result.data?.analysisV21,
        cacheHit: result.data?.cacheHit,
        message: result.message,
      })
      
      // Verificar se o listingId da resposta corresponde ao request
      if (result.data?.listingId && result.data.listingId !== listingId) {
        console.error('[AI-ANALYZE] ListingId mismatch!', {
          requested: listingId,
          received: result.data.listingId,
        })
      }
      
      // Adaptar resposta da API para o formato esperado pelo frontend
      const adaptedData = adaptAIAnalysisResponse(result.data as AIAnalysisApiResponse)
      
      // Ler analysisV21 do schema real: response.data.analysisV21 (não response.data.data.analysisV21)
      const analysisV21 = result.data?.analysisV21 ?? null
      
      if (analysisV21) {
        adaptedData.analysisV21 = analysisV21 as AIAnalysisResultV21
        console.log('[AI-ANALYZE] AnalysisV21 found', {
          listingId,
          promptVersion: (analysisV21 as AIAnalysisResultV21)?.meta?.prompt_version,
          analyzedAt: (analysisV21 as AIAnalysisResultV21)?.meta?.analyzed_at,
        })
      } else {
        console.warn('[AI-ANALYZE] No analysisV21 in response', { listingId })
      }

      // Ler benchmark do schema real: response.data.benchmark
      const benchmark = result.data?.benchmark ?? null
      if (benchmark) {
        adaptedData.benchmark = benchmark
        console.log('[AI-ANALYZE] Benchmark found', {
          listingId,
          confidence: benchmark?.benchmarkSummary?.confidence,
          sampleSize: benchmark?.benchmarkSummary?.sampleSize,
        })
      }

      // Ler benchmarkInsights e generatedContent (Dia 05)
      const benchmarkInsights = result.data?.benchmarkInsights ?? null
      if (benchmarkInsights) {
        adaptedData.benchmarkInsights = benchmarkInsights
        console.log('[AI-ANALYZE] BenchmarkInsights found', {
          listingId,
          confidence: benchmarkInsights?.confidence,
          criticalGapsCount: benchmarkInsights?.criticalGaps?.length || 0,
        })
      }

      const generatedContent = result.data?.generatedContent ?? null
      if (generatedContent) {
        adaptedData.generatedContent = generatedContent
        console.log('[AI-ANALYZE] GeneratedContent found', {
          listingId,
          titlesCount: generatedContent?.titles?.length || 0,
          bulletsCount: generatedContent?.bullets?.length || 0,
        })
      }

      // Ler appliedActions (Dia 06)
      const appliedActions = result.data?.appliedActions ?? []
      if (appliedActions) {
        adaptedData.appliedActions = appliedActions
        console.log('[AI-ANALYZE] AppliedActions found', {
          listingId,
          count: appliedActions.length,
        })
      }
      
      // Normalizar resposta (snake_case → camelCase)
      const { normalizeAiAnalyzeResponse } = await import('@/lib/ai/normalizeAiAnalyze')
      const normalizedData = normalizeAiAnalyzeResponse(adaptedData)
      
      // Extrair metadados para UX de cache
      // cacheHit pode estar em result.data.cacheHit ou result.cacheHit
      // Também verificar se message contém "(cache)"
      const cacheHit = result.data?.cacheHit 
        ?? result.cacheHit 
        ?? (result.message && result.message.includes('(cache)'))
        ?? false
      
      const analyzedAt = normalizedData.analysisV21?.meta?.analyzedAt || analysisV21?.meta?.analyzed_at
      const message = result.message ?? result.data?.message
      
      setState({
        data: normalizedData,
        isLoading: false,
        error: null,
        analyzedAt,
        cacheHit: Boolean(cacheHit),
        message,
      })
    } catch (error) {
      // Log erro sem detalhes sensíveis
      const errorWithStatus = error as ErrorWithStatusCode
      console.error('[AI-ANALYZE] Erro capturado:', {
        listingId,
        statusCode: errorWithStatus.statusCode,
      })

      // Garantir que errorMessage seja sempre uma string válida
      let errorMessage: string
      if (error instanceof Error) {
        errorMessage = String(error.message || 'Erro desconhecido')
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message?: unknown }
        errorMessage = String(errorObj.message || 'Erro desconhecido')
      } else {
        errorMessage = 'Não foi possível gerar a análise. Tente novamente em alguns instantes.'
      }
      
      // Garantir que não seja string vazia
      if (!errorMessage || errorMessage.trim().length === 0) {
        errorMessage = 'Não foi possível gerar a análise. Tente novamente em alguns instantes.'
      }
      
      setState({
        data: null,
        isLoading: false,
        error: errorMessage,
        analyzedAt: undefined,
        cacheHit: undefined,
        message: undefined,
      })
      
      // Não re-throw o erro para evitar quebrar a UI
      // O estado de erro já foi atualizado acima
    }
  }

  // Wrapper para compatibilidade com código existente
  const triggerAIAnalysis = async (force?: boolean) => {
    if (state.isLoading) {
      // Evitar múltiplas requisições simultâneas
      return
    }
    await analyze(force || false)
  }

  /**
   * Busca análise existente sem regenerar (para exibição ao expandir accordion)
   * HOTFIX 09.2: Usa GET /latest primeiro para evitar regeneração desnecessária
   * HOTFIX 09.3: Single-flight guard para evitar múltiplas chamadas simultâneas
   * HOTFIX 09.4: Anti-loop latch definitivo por listingId
   */
  const fetchExisting = useCallback(async (): Promise<void> => {
    if (!listingId) return
    if (stateRef.current.isLoading) return

    // HOTFIX 09.4: Anti-loop latch - verificar status por listingId
    const currentStatus = fetchAttemptStatusRef.current.get(listingId) || 'idle'
    if (currentStatus !== 'idle') {
      console.log('[AI-ANALYZE] Fetch attempt already processed, skipping', { 
        listingId, 
        status: currentStatus 
      })
      return
    }

    // HOTFIX 09.3: Single-flight guard - se já está buscando, retornar
    if (isFetchingExistingRef.current) {
      console.log('[AI-ANALYZE] Already fetching, skipping duplicate request', { listingId })
      return
    }

    // Se já temos dados em memória, não buscar novamente
    if (stateRef.current.data?.analysisV21) {
      console.log('[AI-ANALYZE] Using cached data in memory', { listingId })
      fetchAttemptStatusRef.current.set(listingId, 'done')
      return
    }

    // Marcar como buscando
    isFetchingExistingRef.current = true
    fetchAttemptStatusRef.current.set(listingId, 'inflight')
    console.log('[AI-ANALYZE] Fetching existing analysis (GET latest)', { listingId })
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      // HOTFIX 09.2: Tentar GET /latest primeiro (não chama OpenAI)
      const latestResponse = await fetch(`${apiUrl}/ai/analyze/${listingId}/latest`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      // Se encontrou análise recente (< 7 dias), usar ela
      if (latestResponse.ok) {
        const latestResult = await latestResponse.json()
        
        console.log('[AI-ANALYZE] Latest analysis found (GET latest)', {
          listingId,
          available: latestResult.available !== false,
          ageDays: latestResult.meta?.ageDays,
        })

        // Adaptar resposta da API
        const adaptedData = adaptAIAnalysisResponse(latestResult.data as AIAnalysisApiResponse)
        
        // Ler analysisV21
        const analysisV21 = latestResult.data?.analysisV21 ?? null
        
        if (analysisV21) {
          adaptedData.analysisV21 = analysisV21 as AIAnalysisResultV21
        }

        // Ler benchmark
        const benchmark = latestResult.data?.benchmark ?? null
        if (benchmark) {
          adaptedData.benchmark = benchmark
        }

        // Ler appliedActions
        const appliedActions = latestResult.data?.appliedActions ?? []
        if (appliedActions) {
          adaptedData.appliedActions = appliedActions
        }

        // Ler growthHacks (DIA 09)
        const growthHacks = latestResult.data?.growthHacks ?? []
        if (growthHacks) {
          adaptedData.growthHacks = growthHacks
        }
        const growthHacksMeta = latestResult.data?.growthHacksMeta
        if (growthHacksMeta) {
          adaptedData.growthHacksMeta = growthHacksMeta
        }

        // Ler benchmarkInsights e generatedContent (DIA 05)
        const benchmarkInsights = latestResult.data?.benchmarkInsights ?? null
        if (benchmarkInsights) {
          adaptedData.benchmarkInsights = benchmarkInsights
        }

        const generatedContent = latestResult.data?.generatedContent ?? null
        if (generatedContent) {
          adaptedData.generatedContent = generatedContent
        }
        
        // Normalizar resposta
        const { normalizeAiAnalyzeResponse } = await import('@/lib/ai/normalizeAiAnalyze')
        const normalizedData = normalizeAiAnalyzeResponse(adaptedData)
        
        // Extrair metadados
        const cacheHit = latestResult.meta?.cacheHit ?? true
        const analyzedAt = normalizedData.analysisV21?.meta?.analyzedAt || analysisV21?.meta?.analyzed_at
        const message = latestResult.message ?? 'Análise encontrada (fetch-only)'
        
        // HOTFIX 09.4: Validar shape do payload antes de setar state
        if (!normalizedData.listingId || !normalizedData.analyzedAt || normalizedData.score === undefined) {
          console.warn('[AI-ANALYZE] Invalid payload shape from GET latest', {
            listingId,
            hasListingId: !!normalizedData.listingId,
            hasAnalyzedAt: !!normalizedData.analyzedAt,
            hasScore: normalizedData.score !== undefined,
          })
          // Marcar como failed e não loopar
          fetchAttemptStatusRef.current.set(listingId, 'failed')
          isFetchingExistingRef.current = false
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Formato de resposta inválido. Clique em "Gerar análise" para continuar.',
            data: null,
          }))
          return
        }

        setState({
          data: normalizedData,
          isLoading: false,
          error: null,
          analyzedAt,
          cacheHit: Boolean(cacheHit),
          message,
        })
        // HOTFIX 09.4: Marcar como done após sucesso
        fetchAttemptStatusRef.current.set(listingId, 'done')
        isFetchingExistingRef.current = false
        return // Sucesso: análise encontrada via GET latest
      }

      // Se não encontrou (404), não é erro - apenas não temos análise recente
      if (latestResponse.status === 404) {
        console.log('[AI-ANALYZE] No recent analysis found (GET latest returned 404)', { listingId })
        setState(prev => ({ ...prev, isLoading: false, data: null }))
        // HOTFIX 09.4: Marcar como done (sem loop) e habilitar botão "Gerar análise"
        fetchAttemptStatusRef.current.set(listingId, 'done')
        isFetchingExistingRef.current = false
        return
      }

      // HOTFIX 09.5: Stop definitivo no analyze duplo
      // Não fazer POST /analyze automaticamente aqui.
      // O usuário deve clicar explicitamente em "Gerar análise" / "Regenerar análise".
      console.warn('[AI-ANALYZE] GET latest failed (no automatic POST fallback)', {
        listingId,
        status: latestResponse.status,
      })

      fetchAttemptStatusRef.current.set(listingId, 'failed')
      isFetchingExistingRef.current = false
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Não foi possível carregar a análise salva. Clique em "Gerar análise" para continuar.',
        data: null,
      }))
      return
    } catch (error) {
      console.error('[AI-ANALYZE] Error fetching existing analysis', { listingId, error })
      // HOTFIX 09.4: Marcar como failed e não re-tentar automaticamente
      fetchAttemptStatusRef.current.set(listingId, 'failed')
      isFetchingExistingRef.current = false
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Não foi possível carregar a análise salva. Clique em "Gerar análise" para continuar.',
        data: null,
      }))
    }
  }, [listingId])

  return {
    ...state,
    analyze,
    triggerAIAnalysis,
    fetchExisting,
  }
}

