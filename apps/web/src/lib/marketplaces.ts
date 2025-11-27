import { getAccessToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export interface MercadoLivreAuthResponse {
  authUrl: string;
}

export interface MercadoLivreHealthResponse {
  ok: boolean;
  sellerId: string;
  nickname: string;
  siteId: string;
  countryId: string;
  tags: string[];
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

  const response = await fetch(`${API_URL}/auth/mercadolivre/authorize`, {
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
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/mercadolivre/health`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
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
