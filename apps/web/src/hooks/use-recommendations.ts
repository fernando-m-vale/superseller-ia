'use client'

import useSWR from 'swr'
import { api } from '../lib/axios'

export interface Recommendation {
  id: string
  listingId: string
  listing?: {
    id: string
    title: string
    listingIdExt: string
    marketplace: string
    superSellerScore: number | null
  }
  type: 'seo' | 'image' | 'price' | 'conversion' | 'stock' | 'content'
  status: 'pending' | 'applied' | 'dismissed' | 'expired'
  priority: number
  title: string
  description: string
  impactEstimate: string | null
  scoreImpact: number | null
  ruleTrigger: string | null
  createdAt: string
  appliedAt: string | null
  dismissedAt: string | null
}

export interface RecommendationsResponse {
  items: Recommendation[]
  total: number
}

export interface RecommendationsSummary {
  total: number
  critical: number
  byType: Array<{ type: string; count: number }>
}

export interface RecommendationsFilters {
  listingId?: string
  status?: 'pending' | 'applied' | 'dismissed' | 'expired'
  type?: string
  limit?: number
}

const fetcher = (url: string) => api.get(url).then((res) => res.data)

export function useRecommendations(filters: RecommendationsFilters = {}) {
  const params = new URLSearchParams()
  if (filters.listingId) params.append('listingId', filters.listingId)
  if (filters.status) params.append('status', filters.status)
  if (filters.type) params.append('type', filters.type)
  if (filters.limit) params.append('limit', filters.limit.toString())

  const queryString = params.toString()
  const url = `/recommendations?${queryString}`

  const { data, error, isLoading, mutate } = useSWR<RecommendationsResponse>(url, fetcher)

  return {
    data,
    isLoading,
    error,
    refetch: mutate,
  }
}

export function useRecommendationsSummary() {
  const { data, error, isLoading, mutate } = useSWR<RecommendationsSummary>(
    '/recommendations/summary',
    fetcher
  )

  return {
    data,
    isLoading,
    error,
    refetch: mutate,
  }
}

export function useListingRecommendations(listingId: string | null) {
  const url = listingId ? `/recommendations/listing/${listingId}` : null

  const { data, error, isLoading, mutate } = useSWR<{ items: Recommendation[] }>(
    url,
    fetcher
  )

  return {
    recommendations: data?.items || [],
    isLoading,
    error,
    refetch: mutate,
  }
}

// Funções de ação
export async function applyRecommendation(id: string) {
  return api.patch(`/recommendations/${id}/apply`)
}

export async function dismissRecommendation(id: string) {
  return api.patch(`/recommendations/${id}/dismiss`)
}

export async function generateRecommendations() {
  return api.post('/recommendations/generate')
}
