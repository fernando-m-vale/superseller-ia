import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface MetricsSummary {
  tenantId: string;
  periodDays: number;
  totalImpressions: number;
  totalVisits: number;
  totalOrders: number;
  totalRevenue: number;
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
      const response = await fetch(`${apiUrl}/metrics/summary?${params}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics summary');
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}
