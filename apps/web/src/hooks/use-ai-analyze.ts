'use client'

import { useState, useEffect } from 'react'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

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
  }
}

export interface AIAnalysisState {
  data: AIAnalysisResponse | null
  isLoading: boolean
  error: string | null
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
  })

  // Resetar COMPLETAMENTE o state quando listingId mudar
  // Isso evita misturar dados entre anúncios diferentes
  useEffect(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    })
  }, [listingId])

  const analyze = async (forceRefresh: boolean = false): Promise<void> => {
    if (!listingId) {
      setState({ data: null, isLoading: false, error: 'ID do anúncio não fornecido' })
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      // Build URL with forceRefresh query param if needed
      const url = forceRefresh 
        ? `${apiUrl}/ai/analyze/${listingId}?forceRefresh=true`
        : `${apiUrl}/ai/analyze/${listingId}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // REQUIRED: Fastify strict mode requires a valid JSON body
      })

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
      
      // Adaptar resposta da API para o formato esperado pelo frontend
      const adaptedData = adaptAIAnalysisResponse(result.data as AIAnalysisApiResponse)
      
      setState({
        data: adaptedData,
        isLoading: false,
        error: null,
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
      })
      
      // Não re-throw o erro para evitar quebrar a UI
      // O estado de erro já foi atualizado acima
    }
  }

  return {
    ...state,
    analyze,
  }
}

