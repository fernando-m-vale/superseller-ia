/**
 * DIA 08: Hook para status de sync do tenant
 */

import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface SyncStatusResponse {
  lastAutoSyncAt: string | null;
  lastManualSyncAt: string | null;
  lastSyncStatus: 'idle' | 'running' | 'success' | 'error';
  lastSyncError: string | null;
  lastSyncStartedAt: string | null;
  lastSyncFinishedAt: string | null;
  isRunning: boolean;
}

export function useSyncStatus() {
  return useQuery<SyncStatusResponse>({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const apiUrl = getApiBaseUrl();
      const token = getAccessToken();

      const response = await fetch(`${apiUrl}/sync/tenant/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sync status: ${response.status}`);
      }

      return response.json();
    },
    refetchInterval: (query) => {
      // Se estiver rodando, refetch a cada 5s
      const data = query.state.data;
      if (data?.isRunning) {
        return 5000;
      }
      // Senão, refetch a cada 30s
      return 30000;
    },
  });
}
