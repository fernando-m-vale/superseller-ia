'use client'

import { useState } from 'react'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

export interface AIAnalysisResponse {
  listingId: string
  score: number
  critique: string
  growthHacks: string[]
  seoSuggestions: {
    title?: string
    description?: string
  }
  savedRecommendations: number
  analyzedAt: string
  model: string
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

  const analyze = async (): Promise<void> => {
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

      const response = await fetch(`${apiUrl}/ai/analyze/${listingId}`, {
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

        // Log específico do código de erro
        console.error('[AI-ANALYZE] Erro na análise:', {
          statusCode,
          listingId,
          error: errorData.error || errorData.message,
          details: errorData.details,
          response: errorData,
        })

        // Mensagens específicas por código de status
        let errorMessage = 'Não foi possível gerar a análise. Tente novamente em alguns instantes.'
        
        if (statusCode === 500) {
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
          errorMessage = errorData.message
        }

        const error: ErrorWithStatusCode = new Error(errorMessage)
        error.statusCode = statusCode
        error.errorData = errorData
        throw error
      }

      const result = await response.json()
      
      setState({
        data: result.data,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      // Log do erro completo para debugging
      const errorWithStatus = error as ErrorWithStatusCode
      console.error('[AI-ANALYZE] Erro capturado:', {
        error,
        listingId,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        statusCode: errorWithStatus.statusCode,
        errorData: errorWithStatus.errorData,
      })

      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Não foi possível gerar a análise. Tente novamente em alguns instantes.'
      
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

