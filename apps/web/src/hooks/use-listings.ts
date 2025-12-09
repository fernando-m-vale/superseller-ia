import useSWR from 'swr'
// Mude de '@/lib/axios' para '../lib/axios'
import { api } from '../lib/axios'

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

// Fetcher usando nossa instância Axios (que já tem o interceptor de token)
const fetcher = (url: string) => api.get(url).then((res) => res.data)

export function useListings(filters: ListingsFilters) {
  // Monta a Query String
  const params = new URLSearchParams()
  if (filters.page) params.append('page', filters.page.toString())
  if (filters.pageSize) params.append('pageSize', filters.pageSize.toString())
  if (filters.marketplace) params.append('marketplace', filters.marketplace)
  if (filters.q) params.append('q', filters.q)

  const queryString = params.toString()
  // O axios já tem a baseURL configurada, então passamos apenas o caminho relativo
  const url = `/listings?${queryString}`

  const { data, error, isLoading, mutate } = useSWR<ListingsResponse>(url, fetcher)

  return {
    data, // Retorna o objeto completo { items, total }
    isLoading,
    error,
    refetch: mutate,
  }
}