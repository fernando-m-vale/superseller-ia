/**
 * DIA 08: Hook para sync manual (botão "Sincronizar agora")
 * 
 * Nota: Este hook não emite toasts. O componente que usa este hook deve
 * tratar os toasts baseado no resultado da mutation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface ManualSyncResponse {
  started: boolean;
  jobId?: string;
  reason?: 'cooldown' | 'running';
  retryAfterSeconds?: number;
}

export function useManualSync() {
  const queryClient = useQueryClient();

  return useMutation<ManualSyncResponse, Error>({
    mutationFn: async () => {
      const apiUrl = getApiBaseUrl();
      const token = getAccessToken();

      const response = await fetch(`${apiUrl}/sync/tenant/manual`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to start manual sync: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries para atualizar UI
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}
