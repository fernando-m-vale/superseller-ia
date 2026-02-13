/**
 * DIA 08: Hook para sync manual (botão "Sincronizar agora")
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { toast } from 'sonner';

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
    onSuccess: (data) => {
      if (data.started) {
        toast.success('Sincronização iniciada');
        // Invalidar queries para atualizar UI
        queryClient.invalidateQueries({ queryKey: ['sync-status'] });
        queryClient.invalidateQueries({ queryKey: ['listings'] });
      } else {
        if (data.reason === 'cooldown' && data.retryAfterSeconds) {
          const minutes = Math.ceil(data.retryAfterSeconds / 60);
          toast.info(`Aguarde ${minutes} minuto${minutes > 1 ? 's' : ''} antes de sincronizar novamente`);
        } else if (data.reason === 'running') {
          toast.info('Sincronização já em andamento');
        }
      }
    },
    onError: (error) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });
}
