import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import { getMercadoLivreCredentials } from '../lib/secrets';

const prisma = new PrismaClient();
const ML_API_BASE = 'https://api.mercadolibre.com';

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Serviço para refresh proativo de tokens do Mercado Livre
 * Executa refresh de tokens que estão prestes a expirar (próximas 2 horas)
 */
export class TokenRefreshService {
  /**
   * Refresh tokens que estão prestes a expirar (próximas 2 horas)
   */
  static async refreshExpiringTokens(): Promise<{ refreshed: number; failed: number; errors: string[] }> {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 horas

    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TOKEN-REFRESH] Iniciando refresh proativo de tokens...');
    }

    // Buscar conexões que expiram nas próximas 2 horas
    const expiringConnections = await prisma.marketplaceConnection.findMany({
      where: {
        type: Marketplace.mercadolivre,
        status: { in: [ConnectionStatus.active, ConnectionStatus.expired] },
        expires_at: {
          lte: twoHoursFromNow,
          gte: now, // Ainda não expirou completamente
        },
        refresh_token: { not: null },
      },
    });

    // Log apenas contagem, sem detalhes sensíveis
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[TOKEN-REFRESH] Encontradas ${expiringConnections.length} conexões para refresh`);
    }

    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const connection of expiringConnections) {
      try {
        await this.refreshToken(connection.id, connection.refresh_token!);
        refreshed++;
        // Log apenas em desenvolvimento, sem tokens
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[TOKEN-REFRESH] Token renovado para conexão ${connection.id} (tenant: ${connection.tenant_id})`);
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push(`Conexão ${connection.id}: ${errorMsg}`);
        // Log erro sem detalhes sensíveis
        console.error(`[TOKEN-REFRESH] Falha ao renovar token para conexão ${connection.id}`);
      }
    }

    console.log(`[TOKEN-REFRESH] Concluído: ${refreshed} renovados, ${failed} falhas`);

    return { refreshed, failed, errors };
  }

  /**
   * Refresh um token específico
   */
  static async refreshToken(connectionId: string, refreshToken: string): Promise<void> {
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
            refresh_token: refreshToken,
          },
        }
      );

      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;

      // Atualizar no banco
      await prisma.marketplaceConnection.update({
        where: { id: connectionId },
        data: {
          access_token,
          refresh_token: newRefreshToken || refreshToken,
          expires_at: new Date(Date.now() + expires_in * 1000),
          status: ConnectionStatus.active,
        },
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        
        // Se o refresh token foi revogado, marcar como revogado
        if (status === 400 || status === 401) {
          await prisma.marketplaceConnection.update({
            where: { id: connectionId },
            data: { status: ConnectionStatus.revoked },
          });
          throw new Error('Refresh token revogado');
        }
      }
      throw error;
    }
  }
}
