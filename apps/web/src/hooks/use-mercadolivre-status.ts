'use client'

import { useQuery } from '@tanstack/react-query'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

export interface MercadoLivreStatusResponse {
  connected: boolean
  status: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'REVOKED'
  expiresAt?: string
  isExpired?: boolean
}

async function getMercadoLivreStatus(): Promise<MercadoLivreStatusResponse> {
  const apiUrl = getApiBaseUrl()
  const token = getAccessToken()

  if (!token) {
    return {
      connected: false,
      status: 'DISCONNECTED',
    }
  }

  try {
    const response = await fetch(`${apiUrl}/auth/mercadolivre/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return {
        connected: false,
        status: 'DISCONNECTED',
      }
    }

    return await response.json()
  } catch {
    return {
      connected: false,
      status: 'DISCONNECTED',
    }
  }
}

export function useMercadoLivreStatus() {
  return useQuery<MercadoLivreStatusResponse>({
    queryKey: ['mercadolivre', 'status'],
    queryFn: getMercadoLivreStatus,
    staleTime: 1 * 60 * 1000, // 1 minuto
    refetchInterval: 5 * 60 * 1000, // Refetch a cada 5 minutos
    retry: false,
  })
}

