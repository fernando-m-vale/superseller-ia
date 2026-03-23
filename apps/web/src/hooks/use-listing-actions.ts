'use client'

import useSWR from 'swr'
import { api } from '@/lib/axios'

export type ListingActionStatus = 'A_IMPLEMENTAR' | 'IMPLEMENTADO' | 'DESCARTADO'

// DIA 10: Validar se listingId é UUID válido (nunca MLB/ID externo)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

export interface ListingActionItem {
  id: string
  listingId: string
  actionKey: string
  title: string
  description: string
  executionPayload?: {
    diagnostic?: string
    readyCopy?: string
    copyableVersion?: string
    practicalApplication?: string
  } | null
  expectedImpact?: string | null
  priority?: string | null
  status: ListingActionStatus
  batchId: string
  createdAt: string
  updatedAt: string
  appliedAt?: string | null
  discardedAt?: string | null
}

export interface ListingActionsResponse {
  items: ListingActionItem[]
  batchId: string | null
}

const fetcher = (url: string) => api.get(url).then((res) => res.data)

export function useListingActions(listingId: string | null) {
  // DIA 10: Guardrail — não chamar endpoint se listingId não for UUID válido
  const validId = listingId && isValidUUID(listingId) ? listingId : null

  if (process.env.NODE_ENV === 'development' && listingId && !validId) {
    console.warn(
      '[useListingActions] listingId is not a valid UUID, skipping fetch.',
      { listingId }
    )
  }

  const url = validId ? `/listings/${validId}/actions` : null
  const { data, error, isLoading, mutate } = useSWR<ListingActionsResponse>(url, fetcher)

  return {
    data,
    error,
    isLoading,
    refetch: mutate,
  }
}

export async function updateListingActionStatus(input: {
  listingId: string
  actionId: string
  status: ListingActionStatus
}) {
  const { listingId, actionId, status } = input
  const res = await api.patch(`/listings/${listingId}/actions/${actionId}/status`, { status })
  return res.data as { message: string; item: ListingActionItem }
}
