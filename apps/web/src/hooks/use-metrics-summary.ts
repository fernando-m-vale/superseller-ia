import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface MetricsSummary {
  // Dados de Listings
  totalListings: number;
  activeListings: number;
  pausedListings: number;
  averagePrice: number;
  averageHealthScore: number;
  averageSuperSellerScore: number; // Super Seller Score proprietário (0-100)
  totalStock: number;
  byMarketplace: Array<{
    marketplace: string;
    count: number;
    avgPrice: number;
    avgHealthScore: number;
    avgSuperSellerScore: number;
  }>;
  // Dados de Vendas (dos últimos 30 dias)
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  salesSeries: Array<{
    date: string;
    revenue: number;
    orders: number;
    visits?: number | null; // null quando não disponível
  }>;
  visitsByDay?: Array<{
    date: string;
    visits: number | null;
  }>;
  visitsCoverage?: {
    filledDays: number;
    totalDays: number;
  };
  topListings: Array<{
    title: string;
    revenue: number;
    orders: number;
  }>;
  // Campos legados para compatibilidade com a UI existente
  totalImpressions: number;
  totalVisits: number;
  avgCTR: number;
  avgCVR: number;
  bestListing: {
    id: string;
    title: string;
    healthScore: number;
  } | null;
  updatedAt: string;
}

interface UseMetricsSummaryOptions {
  days?: number;
  marketplace?: 'shopee' | 'mercadolivre';
}

export function useMetricsSummary(options: UseMetricsSummaryOptions = {}) {
  const { days = 7, marketplace } = options;

  return useQuery<MetricsSummary>({
    queryKey: ['metrics-summary', days, marketplace],
    queryFn: async () => {
      const params = new URLSearchParams();
      // CORREÇÃO: Passar days para a API para filtrar período
      params.set('days', days.toString());
      if (marketplace) {
        params.set('marketplace', marketplace);
      }

      const apiUrl = getApiBaseUrl();
      const token = getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Buscar dados do endpoint /overview (tem dados de listings + orders)
      const response = await fetch(`${apiUrl}/metrics/overview?${params}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics summary');
      }

      const data = await response.json();

      // Mapear para o formato esperado pela UI, preenchendo campos legados
      return {
        ...data,
        // Campos legados (zeros por enquanto, podem ser calculados do ListingMetricsDaily se necessário)
        totalImpressions: 0,
        totalVisits: 0,
        avgCTR: 0,
        avgCVR: 0,
        bestListing: null,
        updatedAt: new Date().toISOString(),
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}
