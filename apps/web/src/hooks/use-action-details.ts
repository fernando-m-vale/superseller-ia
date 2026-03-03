'use client'

import useSWR from 'swr'
import { api } from '@/lib/axios'

export interface ActionDetailsV1 {
  whyThisMatters?: string
  howToSteps?: string[]
  doThisNow?: string[]
  copySuggestions?: {
    titles?: Array<{ variation: 'A' | 'B' | 'C'; text: string }>
    description?: string
    bullets?: string[]
  }
  benchmark?: {
    available: boolean
    notes?: string
    data?: unknown
  }
  impact?: 'low' | 'medium' | 'high'
  effort?: 'low' | 'medium' | 'high'
  priority?: 'critical' | 'high' | 'medium' | 'low' | string
  confidence?: 'high' | 'medium' | 'low' | string
}

const fetcher = (url: string) => api.get(url).then((res) => res.data as ActionDetailsV1)

export function useActionDetails(listingId: string | null, actionId: string | null) {
  const url = listingId && actionId ? `/listings/${listingId}/actions/${actionId}/details` : null
  const { data, error, isLoading, mutate } = useSWR<ActionDetailsV1>(url, fetcher, {
    revalidateOnFocus: false,
  })

  return {
    data,
    error,
    isLoading,
    refetch: mutate,
  }
}
