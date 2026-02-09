/**
 * ML Token Helper
 * 
 * Helper para obter access_token válido, usando refresh apenas quando necessário.
 * Não exige refresh_token se access_token ainda é válido.
 */

import { PrismaClient } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import { getMercadoLivreCredentials } from '../lib/secrets';

const prisma = new PrismaClient();
const ML_API_BASE = 'https://api.mercadolibre.com';

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ValidTokenResult {
  token: string;
  usedRefresh: boolean;
  expiresAt: Date;
}

/**
 * Obtém access_token válido, usando refresh apenas se necessário
 * 
 * @param connectionId - ID da conexão no banco
 * @returns Token válido e se foi usado refresh
 * @throws Error se não houver refresh_token quando necessário
 */
export async function getValidAccessToken(
  connectionId: string
): Promise<ValidTokenResult> {
  const connection = await prisma.marketplaceConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      provider_account_id: true,
    },
  });

  if (!connection) {
    throw new Error(`Conexão ${connectionId} não encontrada`);
  }

  const now = new Date();
  const skewMs = 60 * 1000; // 60 segundos de margem

  // Se access_token existe e expires_at está no futuro (com margem), usar direto
  if (
    connection.access_token &&
    connection.expires_at &&
    connection.expires_at.getTime() > (now.getTime() + skewMs)
  ) {
    console.log(`[ML-TOKEN-HELPER] Usando access_token válido connectionId=${connection.id} providerAccountId=${connection.provider_account_id} expiresAt=${connection.expires_at.toISOString()}`);
    
    return {
      token: connection.access_token,
      usedRefresh: false,
      expiresAt: connection.expires_at,
    };
  }

  // Access token expirado ou ausente - precisa refresh
  if (!connection.refresh_token) {
    const error = new Error('Refresh token não disponível. Reconecte a conta.');
    (error as any).code = 'AUTH_REVOKED';
    throw error;
  }

  console.log(`[ML-TOKEN-HELPER] Access token expirado ou ausente, renovando connectionId=${connection.id} providerAccountId=${connection.provider_account_id}`);

  try {
    const credentials = await getMercadoLivreCredentials();
    
    const response = await axios.post<TokenRefreshResponse>(
      `${ML_API_BASE}/oauth/token`,
      null,
      {
        params: {
          grant_type: 'refresh_token',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          refresh_token: connection.refresh_token,
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    
    // Calcular nova data de expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Atualizar conexão no banco
    await prisma.marketplaceConnection.update({
      where: { id: connectionId },
      data: {
        access_token,
        refresh_token,
        expires_at: expiresAt,
        status: 'active',
        updated_at: new Date(),
      },
    });

    console.log(`[ML-TOKEN-HELPER] Token renovado com sucesso connectionId=${connection.id} providerAccountId=${connection.provider_account_id} expiresAt=${expiresAt.toISOString()}`);

    return {
      token: access_token,
      usedRefresh: true,
      expiresAt,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      
      // Se for 400/401, refresh token foi revogado
      if (axiosError.response?.status === 400 || axiosError.response?.status === 401) {
        const errorMsg = axiosError.response?.data?.error || axiosError.response?.data?.message || 'Token revogado';
        
        // Marcar conexão como reauth_required
        await prisma.marketplaceConnection.update({
          where: { id: connectionId },
          data: {
            status: 'reauth_required',
            last_error_code: String(axiosError.response.status),
            last_error_message: errorMsg,
            last_error_at: new Date(),
          },
        });

        const authError = new Error('Refresh token foi revogado. Reconecte a conta.');
        (authError as any).code = 'AUTH_REVOKED';
        throw authError;
      }
    }

    // Re-throw outros erros
    throw error;
  }
}
