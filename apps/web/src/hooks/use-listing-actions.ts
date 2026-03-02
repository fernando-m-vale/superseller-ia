'use client'

import { useState, useEffect, useCallback } from 'react'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

/**
 * Status no backend: A_IMPLEMENTAR | IMPLEMENTADO | DESCARTADO
 * Status no frontend: pending | applied | dismissed
 */
export type FrontendActionStatus = 'pending' | 'applied' | 'dismissed'

export interface ListingActionItem {
  id: string
  listingId: string
  actionKey: string
  title: string
  description: string
  expectedImpact: string | null
  priority: string | null
  status: FrontendActionStatus
  batchId: string
  createdAt: string
  updatedAt: string
  appliedAt: string | null
  discardedAt: string | null
}

interface ListingActionsApiResponse {
  items: Array<{
    id: string
    listingId: string
    actionKey: string
    title: string
    description: string
    expectedImpact: string | null
    priority: string | null
    status: 'A_IMPLEMENTAR' | 'IMPLEMENTADO' | 'DESCARTADO'
    batchId: string
    createdAt: string
    updatedAt: string
    appliedAt: string | null
    discardedAt: string | null
  }>
  batchId: string | null
}

function mapBackendStatus(status: string): FrontendActionStatus {
  switch (status) {
    case 'IMPLEMENTADO':
      return 'applied'
    case 'DESCARTADO':
      return 'dismissed'
    case 'A_IMPLEMENTAR':
    default:
      return 'pending'
  }
}

function mapFrontendStatus(status: FrontendActionStatus): 'A_IMPLEMENTAR' | 'IMPLEMENTADO' | 'DESCARTADO' {
  switch (status) {
    case 'applied':
      return 'IMPLEMENTADO'
    case 'dismissed':
      return 'DESCARTADO'
    case 'pending':
      return 'A_IMPLEMENTAR'
    default:
      throw new Error(`Unknown frontend status: ${status}`)
  }
}

export interface UseListingActionsResult {
  actions: ListingActionItem[]
  batchId: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateStatus: (actionId: string, newStatus: FrontendActionStatus) => Promise<void>
}

export function useListingActions(listingId: string | null): UseListingActionsResult {
  const [actions, setActions] = useState<ListingActionItem[]>([])
  const [batchId, setBatchId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchActions = useCallback(async () => {
    if (!listingId) {
      setActions([])
      setBatchId(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      const response = await fetch(`${apiUrl}/listings/${listingId}/actions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Erro ao buscar ações (HTTP ${response.status})`)
      }

      const data: ListingActionsApiResponse = await response.json()

      const mapped: ListingActionItem[] = (data.items || []).map((item) => ({
        ...item,
        status: mapBackendStatus(item.status),
      }))

      setActions(mapped)
      setBatchId(data.batchId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar ações'
      setError(message)
      setActions([])
      setBatchId(null)
    } finally {
      setIsLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  const updateStatus = useCallback(async (actionId: string, newStatus: FrontendActionStatus) => {
    if (!listingId) return

    // Não enviar status 'pending' para o backend (não há endpoint para reverter)
    if (newStatus === 'pending') return

    const backendStatus = mapFrontendStatus(newStatus)

    // Capture previous status for rollback
    const previousStatus = actions.find((a) => a.id === actionId)?.status ?? 'pending'

    // Optimistic update
    setActions((prev) =>
      prev.map((a) =>
        a.id === actionId ? { ...a, status: newStatus } : a
      )
    )

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      const response = await fetch(
        `${apiUrl}/listings/${listingId}/actions/${actionId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: backendStatus }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Erro ao atualizar status (HTTP ${response.status})`)
      }
    } catch (err) {
      // Revert optimistic update to previous status
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId ? { ...a, status: previousStatus } : a
        )
      )
      throw err
    }
  }, [listingId])

  return {
    actions,
    batchId,
    isLoading,
    error,
    refetch: fetchActions,
    updateStatus,
  }
}
