'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/api';

export interface MarketplaceConnection {
  id: string;
  type: string;
  provider_account_id: string;
  nickname: string | null;
  status: string;
  last_synced_at: string | null;
}

export interface ConnectionsState {
  list: MarketplaceConnection[];
  activeConnectionId: string | null;
  isViewingAll: boolean;
  count: number;
}

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionsState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    try {
      const r = await fetch(`${getApiBaseUrl()}/auth/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setConnections({
          list: data.connections ?? [],
          activeConnectionId: data.activeConnectionId ?? null,
          isViewingAll: data.isViewingAll ?? true,
          count: data.connections?.length ?? 0,
        });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const switchAccount = async (connectionId: string | null) => {
    const token = localStorage.getItem('accessToken');
    await fetch(`${getApiBaseUrl()}/auth/connections/active`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId }),
    });
    await fetchConnections();
    window.location.reload();
  };

  const removeConnection = async (connectionId: string) => {
    const token = localStorage.getItem('accessToken');
    await fetch(`${getApiBaseUrl()}/auth/connections/${connectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchConnections();
  };

  const addConnection = async () => {
    const token = localStorage.getItem('accessToken');
    try {
      const r = await fetch(`${getApiBaseUrl()}/auth/mercadolivre/connect`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.authUrl) window.location.href = d.authUrl;
    } catch { /* ignore */ }
  };

  const activeConnection = connections?.list.find(c => c.id === connections.activeConnectionId);
  const displayName = connections?.isViewingAll
    ? 'Todas as contas'
    : activeConnection?.nickname ?? activeConnection?.provider_account_id ?? 'Minha conta';

  return {
    connections,
    loading,
    activeConnection,
    displayName,
    isViewingAll: connections?.isViewingAll ?? true,
    switchAccount,
    removeConnection,
    addConnection,
    refetch: fetchConnections,
  };
}
