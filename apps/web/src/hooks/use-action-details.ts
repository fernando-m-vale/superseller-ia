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

  constructor(message = 'Gerando detalhes da ação...') {
    super(message)
    this.name = 'ActionDetailsGeneratingError'
  }
}

export type ActionDetailsResponse = {
  data: ActionDetailsV1 | ActionDetailsV2
  cached: boolean
  version?: 'action_details_v1' | 'action_details_v2'
}

function extractListingId(url: string): string | null {
  const match = url.match(/\/listings\/([^/]+)\/actions\//)
  return match?.[1] ?? null
}

const fetcher = async (url: string): Promise<ActionDetailsResponse> => {
  const listingId = extractListingId(url)

  if (listingId) {
    try {
      const statusRes = await api.get(`/ai/analyze/${listingId}/status`)
      const status = statusRes?.data?.analysis?.status
      if (status === 'generating') {
        throw new ActionDetailsGeneratingError()
      }
    } catch (error) {
      if (error instanceof ActionDetailsGeneratingError) {
        throw error
      }
    }
  }

  const res = await api.get(url)
  
  if (res.status === 202) {
    throw new ActionDetailsGeneratingError()
  }

  if (res.data?.status === 'generating' || res.data?.status === 'GENERATING') {
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
