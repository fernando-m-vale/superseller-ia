import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import { MercadoLivreOrdersService } from '../services/MercadoLivreOrdersService';
import { authGuard } from '../plugins/auth';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

// Schema para validar query params de sync de pedidos
const OrdersSyncQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(30),
});

export const syncRoutes: FastifyPluginCallback = (app, _, done) => {
  // Configurar para aceitar body vazio em rotas POST
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = body ? JSON.parse(body as string) : {};
      done(null, json);
    } catch (err) {
      done(null, {});
    }
  });

  /**
   * POST /api/v1/sync/mercadolivre
   * 
   * Dispara sincronização manual dos anúncios do Mercado Livre.
   * Requer autenticação - usa tenantId do token JWT.
   */
  app.post(
    '/mercadolivre',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        console.log(`[SYNC-ROUTE] Requisição de sync de listings recebida para tenant: ${tenantId}`);

        // Instanciar service e executar sync
        const syncService = new MercadoLivreSyncService(tenantId);
        const result = await syncService.syncListings();

        // Retornar resultado
        if (result.success) {
          return reply.status(200).send({
            message: 'Sincronização concluída com sucesso',
            data: {
              itemsProcessed: result.itemsProcessed,
              itemsCreated: result.itemsCreated,
              itemsUpdated: result.itemsUpdated,
              duration: `${result.duration}ms`,
            },
          });
        } else {
          return reply.status(207).send({
            message: 'Sincronização concluída com erros',
            data: {
              itemsProcessed: result.itemsProcessed,
              itemsCreated: result.itemsCreated,
              itemsUpdated: result.itemsUpdated,
              duration: `${result.duration}ms`,
              errors: result.errors,
            },
          });
        }
      } catch (error) {
        console.error('[SYNC-ROUTE] Erro na sincronização de listings:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha na sincronização',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/v1/sync/mercadolivre/orders
   * 
   * Dispara sincronização manual dos pedidos do Mercado Livre.
   * Query params:
   *   - days: Número de dias para buscar (default: 30, max: 90)
   */
  app.post(
    '/mercadolivre/orders',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        // Validar query params
        const query = OrdersSyncQuerySchema.parse(request.query);
        const daysBack = query.days;

        console.log(`[SYNC-ROUTE] Requisição de sync de pedidos recebida para tenant: ${tenantId} (últimos ${daysBack} dias)`);

        // Instanciar service e executar sync
        const ordersService = new MercadoLivreOrdersService(tenantId);
        const result = await ordersService.syncOrders(daysBack);

        // Retornar resultado
        if (result.success) {
          return reply.status(200).send({
            message: 'Sincronização de pedidos concluída com sucesso',
            data: {
              ordersProcessed: result.ordersProcessed,
              ordersCreated: result.ordersCreated,
              ordersUpdated: result.ordersUpdated,
              totalGMV: result.totalGMV,
              duration: `${result.duration}ms`,
            },
          });
        } else {
          return reply.status(207).send({
            message: 'Sincronização de pedidos concluída com erros',
            data: {
              ordersProcessed: result.ordersProcessed,
              ordersCreated: result.ordersCreated,
              ordersUpdated: result.ordersUpdated,
              totalGMV: result.totalGMV,
              duration: `${result.duration}ms`,
              errors: result.errors,
            },
          });
        }
      } catch (error) {
        console.error('[SYNC-ROUTE] Erro na sincronização de pedidos:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha na sincronização de pedidos',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/v1/sync/mercadolivre/full
   * 
   * Dispara sincronização completa (listings + orders).
   * Útil para onboarding inicial de usuário.
   */
  app.post(
    '/mercadolivre/full',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        console.log(`[SYNC-ROUTE] Requisição de sync COMPLETO recebida para tenant: ${tenantId}`);

        // 1. Sync de listings
        const syncService = new MercadoLivreSyncService(tenantId);
        const listingsResult = await syncService.syncListings();

        // 2. Sync de pedidos (últimos 30 dias)
        const ordersService = new MercadoLivreOrdersService(tenantId);
        const ordersResult = await ordersService.syncOrders(30);

        const allSuccess = listingsResult.success && ordersResult.success;

        return reply.status(allSuccess ? 200 : 207).send({
          message: allSuccess 
            ? 'Sincronização completa concluída com sucesso' 
            : 'Sincronização concluída com alguns erros',
          data: {
            listings: {
              itemsProcessed: listingsResult.itemsProcessed,
              itemsCreated: listingsResult.itemsCreated,
              itemsUpdated: listingsResult.itemsUpdated,
              duration: `${listingsResult.duration}ms`,
              errors: listingsResult.errors,
            },
            orders: {
              ordersProcessed: ordersResult.ordersProcessed,
              ordersCreated: ordersResult.ordersCreated,
              ordersUpdated: ordersResult.ordersUpdated,
              totalGMV: ordersResult.totalGMV,
              duration: `${ordersResult.duration}ms`,
              errors: ordersResult.errors,
            },
          },
        });
      } catch (error) {
        console.error('[SYNC-ROUTE] Erro na sincronização completa:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha na sincronização completa',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/sync/status
   * 
   * Endpoint auxiliar para verificar se o serviço de sync está disponível
   */
  app.get('/status', async (_request, reply) => {
    return reply.status(200).send({
      service: 'sync',
      status: 'available',
      providers: ['mercadolivre'],
      endpoints: [
        'POST /mercadolivre - Sync de anúncios',
        'POST /mercadolivre/orders - Sync de pedidos',
        'POST /mercadolivre/full - Sync completo',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  done();
};
