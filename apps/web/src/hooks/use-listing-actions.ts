'use client'

import useSWR from 'swr'
import { api } from '@/lib/axios'

export type ListingActionStatus = 'A_IMPLEMENTAR' | 'IMPLEMENTADO' | 'DESCARTADO'

export interface ListingActionItem {
  id: string
  listingId: string
  actionKey: string
  title: string
  description: string
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
  const url = listingId ? `/listings/${listingId}/actions` : null
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

