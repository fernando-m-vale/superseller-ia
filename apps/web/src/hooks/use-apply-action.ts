'use client'

import { useState } from 'react'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

export type ActionType = 
  | 'seo_title'
  | 'seo_description'
  | 'media_images'
  | 'promo_cover_badge'
  | 'promo_banner'
  | 'seo' // Compatibilidade
  | 'midia' // Compatibilidade
  | 'cadastro' // Compatibilidade
  | 'competitividade' // Compatibilidade

export interface ApplyActionInput {
  actionType: ActionType
  beforePayload: Record<string, unknown>
  afterPayload: Record<string, unknown>
}

export interface AppliedAction {
  id: string
  tenantId: string
  listingId: string
  actionType: string
  appliedAt: string
  createdAt: string
}

export interface UseApplyActionResult {
  applyAction: (input: ApplyActionInput) => Promise<AppliedAction>
  isLoading: boolean
  error: string | null
}

export function useApplyAction(listingId: string | null): UseApplyActionResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyAction = async (input: ApplyActionInput): Promise<AppliedAction> => {
    if (!listingId) {
      throw new Error('ID do anúncio não fornecido')
    }

    setIsLoading(true)
    setError(null)

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      const response = await fetch(`${apiUrl}/listings/${listingId}/apply-action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        // DIA 06.2: Capturar status e body do erro para mostrar detalhes
        const errorData = await response.json().catch(() => ({}))
        const status = response.status
        const message = errorData.error || errorData.message || 'Erro desconhecido'
        const errorMessage = `Erro ao registrar ação (HTTP ${status}): ${message}`
        
        // Em dev, log completo do erro
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao aplicar ação:', {
            status,
            errorData,
            input,
            listingId,
          })
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()
      setIsLoading(false)
      return result.data
    } catch (err) {
      // DIA 06.2: Preservar mensagem de erro detalhada
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar ação'
      setError(errorMessage)
      setIsLoading(false)
      throw err
    }
  }

  return {
    applyAction,
    isLoading,
    error,
  }
}
