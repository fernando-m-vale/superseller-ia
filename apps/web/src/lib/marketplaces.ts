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

  const response = await fetch(`${API_URL}/sync/mercadolivre`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
      if (response.status === 401) {
        errorMessage = 'Erro de autenticação. Por favor, faça login novamente.';
      } else if (response.status === 404) {
        errorMessage = 'Endpoint não encontrado. Entre em contato com o suporte.';
      } else if (response.status >= 500) {
        errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
      }
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
