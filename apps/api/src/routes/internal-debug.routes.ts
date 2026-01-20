/**
 * Internal Debug Routes
 * 
 * Endpoints de debug protegidos com X-Internal-Key
 * Úteis para diagnosticar problemas de integração com Mercado Livre
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import { internalAuthGuard } from '../plugins/internal-auth';
import axios from 'axios';

const prisma = new PrismaClient();
const ML_API_BASE = 'https://api.mercadolibre.com';

export const internalDebugRoutes: FastifyPluginCallback = (app, _, done) => {
  /**
   * GET /api/v1/internal/debug/mercadolivre/whoami?tenantId=...
   * 
   * Endpoint de debug para verificar conexão e seller ID do Mercado Livre
   * 
   * Retorna:
   * - Informações da conexão (connectionId, providerAccountId, status)
   * - Dados do usuário via users/me (id, nickname, site_id)
   * - Amostra de orders (status, paging.total, primeiro pedido)
   */
  app.get(
    '/mercadolivre/whoami',
    { preHandler: internalAuthGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request.query as { tenantId?: string }).tenantId;

        if (!tenantId) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'tenantId query parameter is required',
          });
        }

        app.log.info({ tenantId }, '[INTERNAL-DEBUG] whoami request recebida');

        // 1. Buscar conexão do Mercado Livre
        const connection = await prisma.marketplaceConnection.findFirst({
          where: {
            tenant_id: tenantId,
            type: Marketplace.mercadolivre,
            status: ConnectionStatus.active,
          },
        });

        if (!connection) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Conexão ativa do Mercado Livre não encontrada para este tenant',
          });
        }

        app.log.info(
          {
            tenantId,
            connectionId: connection.id,
            providerAccountId: connection.provider_account_id,
            status: connection.status,
          },
          '[INTERNAL-DEBUG] Conexão encontrada'
        );

        // 2. Verificar se token está válido (renovar se necessário)
        const now = new Date();
        const expiresAt = connection.expires_at;
        let accessToken = connection.access_token;

        if (expiresAt && expiresAt.getTime() < now.getTime() + 5 * 60 * 1000) {
          // Token expirado ou prestes a expirar, tentar renovar
          app.log.info({ tenantId, connectionId: connection.id }, '[INTERNAL-DEBUG] Token expirado, tentando renovar...');

          if (!connection.refresh_token) {
            return reply.status(401).send({
              error: 'Token Expired',
              message: 'Token expirado e refresh_token não disponível',
              connection: {
                connectionId: connection.id,
                providerAccountId: connection.provider_account_id,
                status: connection.status,
              },
            });
          }

          // Renovar token (simplificado - em produção usar o service completo)
          try {
            const credentials = await import('../lib/secrets').then(m => m.getMercadoLivreCredentials());
            
            const refreshResponse = await axios.post(
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

            accessToken = refreshResponse.data.access_token;
            app.log.info({ tenantId }, '[INTERNAL-DEBUG] Token renovado com sucesso');
          } catch (refreshError) {
            app.log.error({ tenantId, error: refreshError }, '[INTERNAL-DEBUG] Erro ao renovar token');
            
            // Marcar conexão como revoked
            await prisma.marketplaceConnection.update({
              where: { id: connection.id },
              data: { status: ConnectionStatus.revoked },
            });

            return reply.status(401).send({
              error: 'Token Refresh Failed',
              message: 'Falha ao renovar token. Conexão marcada como revoked.',
              connection: {
                connectionId: connection.id,
                providerAccountId: connection.provider_account_id,
                status: 'revoked',
              },
            });
          }
        }

        // 3. Chamar users/me para obter ID real do usuário
        let me: { id: number; nickname: string; site_id: string } | null = null;
        try {
          const meResponse = await axios.get(`${ML_API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const meData = meResponse.data;
          me = {
            id: meData.id,
            nickname: meData.nickname,
            site_id: meData.site_id,
          };
          app.log.info(
            {
              tenantId,
              meId: me.id,
              meNickname: me.nickname,
              providerAccountId: connection.provider_account_id,
            },
            '[INTERNAL-DEBUG] users/me obtido'
          );
        } catch (meError) {
          if (axios.isAxiosError(meError)) {
            const status = meError.response?.status;
            const data = meError.response?.data;
            
            app.log.error(
              {
                tenantId,
                status,
                error: data,
              },
              '[INTERNAL-DEBUG] Erro ao chamar users/me'
            );

            if (status === 401 || status === 403) {
              // Marcar conexão como revoked
              await prisma.marketplaceConnection.update({
                where: { id: connection.id },
                data: { status: ConnectionStatus.revoked },
              });

              return reply.status(401).send({
                error: 'Unauthorized',
                message: `ML API retornou ${status}. Conexão marcada como revoked.`,
                connection: {
                  connectionId: connection.id,
                  providerAccountId: connection.provider_account_id,
                  status: 'revoked',
                },
                mlError: {
                  status,
                  message: data?.message || 'Unauthorized',
                },
              });
            }
          }
          throw meError;
        }

        // 4. Chamar orders/search com seller = me.id para testar (se me foi obtido)
        let ordersSample: {
          status: number;
          pagingTotal: number;
          resultsLength: number;
          firstOrderDate?: string;
          firstOrderId?: number;
        } | null = null;

        if (me) {
          try {
            const sellerId = String(me.id);
            const ordersResponse = await axios.get(`${ML_API_BASE}/orders/search`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              params: {
                seller: sellerId,
                limit: 1,
                sort: 'date_desc',
              },
            });

            const pagingTotal = ordersResponse.data.paging?.total || 0;
            const resultsLength = ordersResponse.data.results?.length || 0;
            const firstOrder = resultsLength > 0 ? ordersResponse.data.results[0] : null;

            ordersSample = {
              status: ordersResponse.status,
              pagingTotal,
              resultsLength,
              firstOrderDate: firstOrder?.date_created,
              firstOrderId: firstOrder?.id,
            };

            app.log.info(
              {
                tenantId,
                sellerId,
                pagingTotal,
                resultsLength,
                firstOrderId: firstOrder?.id,
              },
              '[INTERNAL-DEBUG] orders/search obtido'
            );
          } catch (ordersError) {
            if (axios.isAxiosError(ordersError)) {
              const status = ordersError.response?.status;
              const data = ordersError.response?.data;
              
              app.log.error(
                {
                  tenantId,
                  sellerId: me.id,
                  status,
                  error: data,
                },
                '[INTERNAL-DEBUG] Erro ao chamar orders/search'
              );

              ordersSample = {
                status: status || 0,
                pagingTotal: 0,
                resultsLength: 0,
              };
            } else {
              throw ordersError;
            }
          }
        }

        // 5. Retornar resultado consolidado
        return reply.status(200).send({
          connection: {
            connectionId: connection.id,
            providerAccountId: connection.provider_account_id,
            status: connection.status,
          },
          me: me ? {
            id: me.id,
            nickname: me.nickname,
            site_id: me.site_id,
          } : null,
          ordersSample,
          note: me && connection.provider_account_id !== String(me.id)
            ? `⚠️ providerAccountId (${connection.provider_account_id}) diverge de me.id (${me.id}). Usar me.id como seller.`
            : null,
        });
      } catch (error) {
        app.log.error({ error }, '[INTERNAL-DEBUG] Erro fatal em whoami');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );

  done();
};
