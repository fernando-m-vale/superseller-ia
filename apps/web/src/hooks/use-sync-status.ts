/**
 * DIA 08: Hook para status de sync do tenant
 * 
 * HOTFIX: Polling inteligente sem avalanche
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

      if (!token) {
        throw new Error('Token não disponível');
      }

      const debug = process.env.NEXT_PUBLIC_DEBUG_SYNC === '1' || process.env.NODE_ENV === 'development';
      if (debug) {
        console.log('[SYNC_STATUS] Polling status...', { timestamp: new Date().toISOString() });
      }

      const response = await fetch(`${apiUrl}/sync/tenant/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sync status: ${response.status}`);
      }

      const data = await response.json();
      
      if (debug) {
        console.log('[SYNC_STATUS] Status recebido', { 
          isRunning: data.isRunning, 
          status: data.lastSyncStatus,
          lastSyncAt: data.lastAutoSyncAt || data.lastManualSyncAt 
        });
      }

      return data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      
      // Se estiver rodando, polling rápido (5s)
      if (data?.isRunning) {
        return 5000;
      }
      
      // Se idle/success/error, polling lento (60s) ou desligado
      // Desligar polling quando idle para evitar requests desnecessários
      return false; // Desligar polling quando não está rodando
    },
    // Zero retries para evitar avalanche em caso de erro
    retry: 0,
    // Refetch apenas quando a janela ganha foco (opcional, mas útil)
    refetchOnWindowFocus: false,
    // Não refetch ao reconectar (evitar avalanche)
    refetchOnReconnect: false,
  });
}
