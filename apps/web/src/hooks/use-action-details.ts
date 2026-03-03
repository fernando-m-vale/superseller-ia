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

interface ActionDetailsResponseEnvelope {
  data: ActionDetailsV1
  cached?: boolean
}

export class ActionDetailsGeneratingError extends Error {
  readonly status = 'GENERATING' as const

  constructor(message = 'Detalhes ainda estão sendo gerados') {
    super(message)
    this.name = 'ActionDetailsGeneratingError'
  }
}

const fetcher = async (url: string): Promise<ActionDetailsV1> => {
  const res = await api.get<ActionDetailsResponseEnvelope>(url)

  if (res.status === 202) {
    throw new ActionDetailsGeneratingError()
  }

  return res.data.data
}

export function useActionDetails(listingId: string | null, actionId: string | null) {
  const url = listingId && actionId ? `/listings/${listingId}/actions/${actionId}/details` : null
  const { data, error, isLoading, mutate } = useSWR<ActionDetailsV1, Error>(url, fetcher, {
    revalidateOnFocus: false,
  })

  const isGenerating = error instanceof ActionDetailsGeneratingError

  return {
    data,
    error: isGenerating ? null : error,
    isGenerating,
    isLoading,
    refetch: mutate,
  }
}
