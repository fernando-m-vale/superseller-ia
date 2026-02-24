/**
 * DIA 08: Hook para auto-sync (chamado ao abrir /listings)
 * 
 * HOTFIX: Guard para disparar apenas 1x por sessão/tenant
 */

import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface AutoSyncResponse {
  started: boolean;
  jobId?: string;
  reason?: 'cooldown' | 'running';
  retryAfterSeconds?: number;
}

// Guard global por tenant (sessionStorage)
function getAutoSyncKey(): string {
  // Usar timestamp da sessão como identificador único
  // Isso permite 1 disparo por carregamento de página
  if (typeof window === 'undefined') return 'autosync_fired';
  
  const sessionKey = sessionStorage.getItem('autosync_session_id');
  if (!sessionKey) {
    const newSessionId = `session_${Date.now()}`;
    sessionStorage.setItem('autosync_session_id', newSessionId);
    return `autosync_fired_${newSessionId}`;
  }
  
  return `autosync_fired_${sessionKey}`;
}

function hasFiredAutoSync(): boolean {
  if (typeof window === 'undefined') return false;
  const key = getAutoSyncKey();
  return sessionStorage.getItem(key) === '1';
}

function markAutoSyncFired(): void {
  if (typeof window === 'undefined') return;
  const key = getAutoSyncKey();
  sessionStorage.setItem(key, '1');
}

export function useAutoSync() {
  const firedRef = useRef(false);
  
  const mutation = useMutation<AutoSyncResponse, Error>({
    mutationFn: async () => {
      // Guard: não disparar se já foi disparado nesta sessão
      if (firedRef.current || hasFiredAutoSync()) {
        const debug = process.env.NEXT_PUBLIC_DEBUG_SYNC === '1' || process.env.NODE_ENV === 'development';
        if (debug) {
          console.log('[AUTO_SYNC] Bloqueado: já foi disparado nesta sessão');
        }
        return { started: false, reason: 'cooldown' as const };
      }

      const apiUrl = getApiBaseUrl();
      const token = getAccessToken();

      if (!token) {
        const debug = process.env.NEXT_PUBLIC_DEBUG_SYNC === '1' || process.env.NODE_ENV === 'development';
        if (debug) {
          console.log('[AUTO_SYNC] Bloqueado: token não disponível');
        }
        return { started: false, reason: 'cooldown' as const };
      }

      // HOTFIX 09.7: Log sempre (não apenas em debug) para validação
      console.log('[AUTO_SYNC] Disparando auto-sync...', { 
        timestamp: new Date().toISOString(),
        sessionKey: getAutoSyncKey(),
      });

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

      const data = await response.json();
      
      // Marcar como disparado apenas se realmente iniciou
      if (data.started) {
        firedRef.current = true;
        markAutoSyncFired();
        
        // HOTFIX 09.7: Log sempre (não apenas em debug) para validação
        console.log('[AUTO_SYNC] Auto-sync iniciado com sucesso', { 
          jobId: data.jobId,
          timestamp: new Date().toISOString(),
        });
      } else {
        // HOTFIX 09.7: Log quando não iniciou (cooldown/running)
        console.log('[AUTO_SYNC] Auto-sync não iniciado', {
          reason: data.reason,
          retryAfterSeconds: data.retryAfterSeconds,
          timestamp: new Date().toISOString(),
        });
      }
      
      return data;
    },
    // Silent: não mostrar erro se falhar (auto-sync é opcional)
    // Zero retries para evitar avalanche
    retry: 0,
    networkMode: 'online',
    onError: (error) => {
      const debug = process.env.NEXT_PUBLIC_DEBUG_SYNC === '1' || process.env.NODE_ENV === 'development';
      if (debug) {
        console.warn('[AUTO_SYNC] Falha silenciosa:', error);
      }
    },
  });

  return mutation;
}
