'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface BillingStatus {
  plan: 'free' | 'pro';
  planStatus: string;
  isTrialing: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  planExpiresAt: string | null;
  hasPaymentMethod: boolean;
  limits: {
    maxAiAnalysesPerMonth: number;
    historyDays: number;
    autoSync: boolean;
    readyCopy: boolean;
  } | null;
}

export function useBilling() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${getApiBaseUrl()}/billing/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setBilling(await r.json());
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const startCheckout = async (interval: 'month' | 'year' = 'month') => {
    const token = getAccessToken();
    const r = await fetch(`${getApiBaseUrl()}/billing/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval }),
    });
    const d = await r.json();
    if (d.checkoutUrl) window.location.href = d.checkoutUrl;
  };

  const openPortal = async () => {
    const token = getAccessToken();
    const r = await fetch(`${getApiBaseUrl()}/billing/portal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.portalUrl) window.location.href = d.portalUrl;
  };

  return {
    billing,
    loading,
    isPro: billing?.plan === 'pro',
    isFree: billing?.plan === 'free',
    isTrialing: billing?.isTrialing ?? false,
    trialDaysLeft: billing?.trialDaysLeft ?? null,
    startCheckout,
    openPortal,
    refetch: fetchBilling,
  };
}
