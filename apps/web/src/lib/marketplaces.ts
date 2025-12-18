import { getAccessToken } from './auth';
import { getApiBaseUrl } from './api';
import { apiFetch } from './api-fetch';

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
  // Campos adicionais do backend
  itemsProcessed?: number;
  itemsCreated?: number;
  itemsUpdated?: number;
}

export const getMercadoLivreAuthUrl = async (): Promise<string> => {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await apiFetch(`${API_URL}/auth/mercadolivre/connect`);

  if (!response.ok) {
    let errorMessage = 'Failed to get Mercado Livre auth URL';
    try {
      const error = await response.json();
      errorMessage = String(error.error || error.message || errorMessage);
    } catch {
      // Se não conseguir parsear JSON, usar mensagem padrão
    }
    throw new Error(errorMessage);
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
    const response = await apiFetch(`${API_URL}/auth/mercadolivre/status`);

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

  const response = await apiFetch(`${API_URL}/sync/mercadolivre`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}), // Fastify strict mode requires a valid JSON body
  });

  if (!response.ok) {
    let errorMessage = 'Falha ao sincronizar anúncios do Mercado Livre';
    
    try {
      const errorData = await response.json();
      // Extrair mensagem de erro de múltiplas possíveis estruturas
      errorMessage = String(
        errorData.message || 
        errorData.error || 
        errorData.details || 
        'Falha ao sincronizar anúncios do Mercado Livre'
      );
    } catch {
      // Se não conseguir parsear JSON, usar mensagem padrão baseada no status
      if (response.status === 404) {
        errorMessage = 'Endpoint não encontrado. Entre em contato com o suporte.';
      } else if (response.status >= 500) {
        errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
      }
      // 401 já é tratado pelo apiFetch via handleUnauthorized()
    }
    
    throw new Error(errorMessage);
  }

  const result = await response.json();
  
  // Adaptar resposta do backend para o formato esperado pelo frontend
  const itemsProcessed = result.data?.itemsProcessed || 0;
  
  return {
    success: result.data ? true : false,
    synced: itemsProcessed,
    listings: [], // O backend não retorna lista de listings, apenas estatísticas
    itemsProcessed,
    itemsCreated: result.data?.itemsCreated || 0,
    itemsUpdated: result.data?.itemsUpdated || 0,
  };
};
