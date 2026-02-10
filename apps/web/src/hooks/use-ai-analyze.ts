'use client'

import { useState, useEffect } from 'react'
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
  growthHacks: Array<{
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    estimatedImpact: string
  }>
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
  growthHacks: Array<{
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    estimatedImpact: string
  }>
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
   */
  const fetchExisting = async (): Promise<void> => {
    if (!listingId) return
    if (state.isLoading) return

    // Se já temos dados em memória, não buscar novamente
    if (state.data?.analysisV21) {
      console.log('[AI-ANALYZE] Using cached data in memory', { listingId })
      return
    }

    console.log('[AI-ANALYZE] Fetching existing analysis', { listingId })
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      // Usar POST sem forceRefresh (que retorna cache se existir)
      const response = await fetch(`${apiUrl}/ai/analyze/${listingId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        // Se não existir análise, não é erro - apenas não temos dados
        if (response.status === 404) {
          setState(prev => ({ ...prev, isLoading: false, data: null }))
          return
        }
        throw new Error(`Erro ao buscar análise: ${response.status}`)
      }

      const result = await response.json()
      
      // Adaptar resposta da API
      const adaptedData = adaptAIAnalysisResponse(result.data as AIAnalysisApiResponse)
      
      // Ler analysisV21
      const analysisV21 = result.data?.analysisV21 ?? null
      
      if (analysisV21) {
        adaptedData.analysisV21 = analysisV21 as AIAnalysisResultV21
      }

      // Ler benchmark
      const benchmark = result.data?.benchmark ?? null
      if (benchmark) {
        adaptedData.benchmark = benchmark
      }
      
      // Normalizar resposta
      const { normalizeAiAnalyzeResponse } = await import('@/lib/ai/normalizeAiAnalyze')
      const normalizedData = normalizeAiAnalyzeResponse(adaptedData)
      
      // Extrair metadados
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
      console.error('[AI-ANALYZE] Error fetching existing analysis', { listingId, error })
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Erro ao buscar análise',
        data: null,
      }))
    }
  }

  return {
    ...state,
    analyze,
    triggerAIAnalysis,
    fetchExisting,
  }
}

