/**
 * DIA 08: Hook para auto-sync (chamado ao abrir /listings)
 */

import { useMutation } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface AutoSyncResponse {
  started: boolean;
  jobId?: string;
  reason?: 'cooldown' | 'running';
  retryAfterSeconds?: number;
}

export function useAutoSync() {
  return useMutation<AutoSyncResponse, Error>({
    mutationFn: async () => {
      const apiUrl = getApiBaseUrl();
      const token = getAccessToken();

      const response = await fetch(`${apiUrl}/sync/tenant/auto`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to start auto sync: ${response.status}`);
      }

      return response.json();
    },
    // Silent: não mostrar erro se falhar (auto-sync é opcional)
    onError: (error) => {
      console.warn('[AUTO_SYNC] Falha silenciosa:', error);
    },
  });
}
