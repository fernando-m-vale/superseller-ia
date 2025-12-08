import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';

// Schema de validação do body
const SyncRequestSchema = z.object({
  tenantId: z.string().uuid('tenantId deve ser um UUID válido'),
});

type SyncRequestBody = z.infer<typeof SyncRequestSchema>;

export const syncRoutes: FastifyPluginCallback = (app, _, done) => {
  /**
   * POST /api/v1/sync/mercadolivre
   * 
   * Dispara sincronização manual dos anúncios do Mercado Livre
   * 
   * Body: { "tenantId": "uuid-do-tenant" }
   */
  app.post(
    '/mercadolivre',
    async (
      request: FastifyRequest<{ Body: SyncRequestBody }>,
      reply: FastifyReply
    ) => {
      try {
        // Validar body
        const { tenantId } = SyncRequestSchema.parse(request.body);

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

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validação falhou',
            details: error.errors,
          });
        }

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

