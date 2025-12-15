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
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }))
        throw new Error(errorData.message || `Erro ${response.status}`)
      }

      const result = await response.json()
      
      setState({
        data: result.data,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erro ao analisar anúncio',
      })
      throw error
    }
  }

  return {
    ...state,
    analyze,
  }
}

