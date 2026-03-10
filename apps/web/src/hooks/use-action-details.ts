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

type AnalysisStatusResponse = {
  analysis?: {
    status?: string
  }
}

const fetcher = async (url: string): Promise<ActionDetailsResponse> => {
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

const fetchAnalysisStatus = async (url: string): Promise<AnalysisStatusResponse> => {
  const res = await api.get(url)
  return res.data as AnalysisStatusResponse
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

  const statusUrl = listingId && actionId ? `/ai/analyze/${listingId}/status` : null

  const {
    data: analysisStatusData,
    isLoading: statusLoading,
  } = useSWR<AnalysisStatusResponse, Error>(
    statusUrl,
    fetchAnalysisStatus,
    {
      revalidateOnFocus: false,
      refreshInterval: (data) => {
        const status = data?.analysis?.status?.toLowerCase()
        return status === 'generating' ? 2000 : 0
      },
    },
  )

  const analysisStatus = analysisStatusData?.analysis?.status?.toLowerCase() ?? null
  const shouldWaitForAnalysis = Boolean(listingId && actionId && analysisStatus === 'generating')
  const shouldFetchDetails = Boolean(url && !shouldWaitForAnalysis)

  const { data, error, isLoading, mutate } = useSWR<ActionDetailsResponse, Error>(
    shouldFetchDetails ? url : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryInterval: 2000,
      onErrorRetry: (error, _key, _config, revalidate, context) => {
        if (!(error instanceof ActionDetailsGeneratingError) || context.retryCount >= 15) {
          return
        }

        setTimeout(() => {
          revalidate({ retryCount: context.retryCount + 1 })
        }, 2000)
      },
    },
  )

  const isGenerating = shouldWaitForAnalysis || error instanceof ActionDetailsGeneratingError
  const combinedLoading = Boolean((statusUrl && statusLoading && analysisStatus === null) || isLoading || isGenerating)

  return {
    data: data?.data,
    version: data?.version || (effectiveSchema === 'v2' ? 'action_details_v2' : 'action_details_v1'),
    cached: data?.cached ?? false,
    error: isGenerating ? null : error,
    isLoading: combinedLoading,
    isGenerating,
    refetch: mutate,
  }
}
