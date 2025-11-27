import { useQuery } from '@tanstack/react-query'
import { getApiBaseUrl } from '@/lib/api'

export interface HealthIssue {
  code: string
  severity: 'warning' | 'critical'
  message: string
}

export interface Listing {
  id: string
  title: string
  marketplace: 'shopee' | 'mercadolivre'
  price: number
  stock: number
  status: string
  category?: string
  healthScore?: number
  healthIssues?: HealthIssue[]
}

export interface ListingsResponse {
  items: Listing[]
  total: number
  page: number
  pageSize: number
  tenantId: string
}

export interface ListingsFilters {
  q?: string
  marketplace?: 'shopee' | 'mercadolivre'
  page?: number
  pageSize?: number
}

async function fetchListings(filters: ListingsFilters = {}): Promise<ListingsResponse> {
  const apiUrl = getApiBaseUrl()
  
  const params = new URLSearchParams()
  if (filters.q) params.append('q', filters.q)
  if (filters.marketplace) params.append('marketplace', filters.marketplace)
  if (filters.page) params.append('page', filters.page.toString())
  if (filters.pageSize) params.append('pageSize', filters.pageSize.toString())

  const url = `${apiUrl}/listings${params.toString() ? `?${params.toString()}` : ''}`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch listings: ${response.status}`)
  }
  
  return response.json()
}

export function useListings(filters: ListingsFilters = {}) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: () => fetchListings(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
