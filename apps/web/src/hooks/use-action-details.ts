'use client'

import useSWR from 'swr'
import { api } from '@/lib/axios'
import type { ActionDetailsV2 } from '@/types/action-details-v2'

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

export class ActionDetailsGeneratingError extends Error {
  readonly status = 'GENERATING' as const

  constructor(message = 'Detalhes ainda estão sendo gerados') {
    super(message)
    this.name = 'ActionDetailsGeneratingError'
  }
}

export type ActionDetailsResponse = {
  data: ActionDetailsV1 | ActionDetailsV2
  cached: boolean
  version?: 'action_details_v1' | 'action_details_v2'
}

const fetcher = async (url: string): Promise<ActionDetailsResponse> => {
  const res = await api.get(url)
  
  if (res.status === 202) {
    throw new ActionDetailsGeneratingError()
  }
  
  // Backend retorna { data: {...}, cached: boolean, version?: string }
  return res.data as ActionDetailsResponse
}

export function useActionDetails(
  listingId: string | null,
  actionId: string | null,
  schemaVersion: 'v1' | 'v2' = 'v1',
) {
  // Feature flag: verificar se V2 está habilitado no frontend
  const v2Enabled = process.env.NEXT_PUBLIC_ACTION_DETAILS_V2_ENABLED === 'true'
  const effectiveSchema = schemaVersion === 'v2' && v2Enabled ? 'v2' : 'v1'
  
  const url =
    listingId && actionId
      ? `/listings/${listingId}/actions/${actionId}/details?schema=${effectiveSchema}`
      : null
  
  const { data, error, isLoading, mutate } = useSWR<ActionDetailsResponse, Error>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  )

  const isGenerating = error instanceof ActionDetailsGeneratingError

  return {
    data: data?.data,
    version: data?.version || (effectiveSchema === 'v2' ? 'action_details_v2' : 'action_details_v1'),
    cached: data?.cached ?? false,
    error: isGenerating ? null : error,
    isLoading,
    isGenerating,
    refetch: mutate,
  }
}
