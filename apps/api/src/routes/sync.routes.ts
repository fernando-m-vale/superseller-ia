import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import { authGuard } from '../plugins/auth';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

export const syncRoutes: FastifyPluginCallback = (app, _, done) => {
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

        console.log(`[SYNC-ROUTE] Requisição de sync recebida para tenant: ${tenantId}`);

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
        console.error('[SYNC-ROUTE] Erro na sincronização:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha na sincronização',
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
      timestamp: new Date().toISOString(),
    });
  });

  done();
};
