import useSWR from 'swr'
// Mude de '@/lib/axios' para '../lib/axios'
import { api } from '../lib/axios'

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  totalVisits: number;
  conversionRate: number;
  activeListings: number;
  totalListings: number;
  averagePrice: number;
  averageHealthScore: number;
  series: Array<{
    date: string;
    revenue: number;
    orders: number;
    visits: number;
  }>
}

// Fetcher usando nossa instância Axios (com token)
const fetcher = (url: string) => api.get(url).then((res) => res.data)

export function useMetrics(days = 7) {
  // Chama a rota /metrics/summary que criamos na API
  // O Axios já lida com a BaseURL e o Token
  const { data, error, isLoading, mutate } = useSWR<DashboardMetrics>(`/metrics/summary?days=${days}`, fetcher)

  return {
    data,
    isLoading,
    error,
    refetch: mutate,
  }
}