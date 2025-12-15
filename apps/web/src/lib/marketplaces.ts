import { getAccessToken } from './auth';
import { getApiBaseUrl } from './api';

const API_URL = getApiBaseUrl();

export interface MercadoLivreAuthResponse {
  authUrl: string;
}

export interface MercadoLivreHealthResponse {
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'REVOKED';
  expiresAt?: string;
  isExpired?: boolean;
  message?: string;
}

export interface MercadoLivreSyncResponse {
  success: boolean;
  synced: number;
  listings: Array<{
    id: string;
    title: string;
    price: number;
    stock: number;
    status: string;
  }>;
}

export const getMercadoLivreAuthUrl = async (): Promise<string> => {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_URL}/auth/mercadolivre/connect`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get Mercado Livre auth URL');
  }

  const data: MercadoLivreAuthResponse = await response.json();
  return data.authUrl;
};

export const getMercadoLivreHealth = async (): Promise<MercadoLivreHealthResponse | null> => {
  const token = getAccessToken();
  
  if (!token) {
    return {
      connected: false,
      status: 'DISCONNECTED',
    };
  }

  try {
    const response = await fetch(`${API_URL}/auth/mercadolivre/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return {
        connected: false,
        status: 'DISCONNECTED',
      };
    }

    return await response.json();
  } catch {
    return {
      connected: false,
      status: 'DISCONNECTED',
    };
  }
};

export const syncMercadoLivreListings = async (): Promise<MercadoLivreSyncResponse> => {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_URL}/mercadolivre/sync`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to sync Mercado Livre listings');
  }

  return await response.json();
};
