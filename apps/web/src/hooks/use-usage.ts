'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface UsageSummary {
  analysesThisMonth: number;
  analysesLimit: number | null; // null = unlimited (pro)
  allowed: boolean;
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${getApiBaseUrl()}/usage/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setUsage(await r.json());
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return { usage, loading, refetch: fetchUsage };
}
