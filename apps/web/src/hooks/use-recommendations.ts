import { useQuery } from '@tanstack/react-query'
import type { RecommendationsResponse, RecommendationsFilters } from '@/types/recommendations'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

async function fetchRecommendations(filters: RecommendationsFilters): Promise<RecommendationsResponse> {
  const params = new URLSearchParams()
  
  if (filters.marketplace) {
    params.append('marketplace', filters.marketplace)
  }
  if (filters.q) {
    params.append('q', filters.q)
  }
  if (filters.page) {
    params.append('page', filters.page.toString())
  }
  if (filters.pageSize) {
    params.append('pageSize', filters.pageSize.toString())
  }

  const url = `${API_URL}/actions/recommendations?${params.toString()}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch recommendations: ${response.statusText}`)
  }
  
  return response.json()
}

export function useRecommendations(filters: RecommendationsFilters) {
  return useQuery({
    queryKey: ['recommendations', filters],
    queryFn: () => fetchRecommendations(filters),
    staleTime: 30000,
  })
}
