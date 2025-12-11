import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import { MercadoLivreOrdersService } from '../services/MercadoLivreOrdersService';
import { ScoreCalculator } from '../services/ScoreCalculator';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

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
   * POST /api/v1/sync/recalculate-scores
   * 
   * Recalcula o Super Seller Score de TODOS os anúncios do tenant.
   * Útil após mudanças no algoritmo ou para correção de dados.
   */
  app.post(
    '/recalculate-scores',
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

        console.log(`[SYNC-ROUTE] Recálculo de scores iniciado para tenant: ${tenantId}`);

        // Buscar todos os anúncios do tenant
        const listings = await prisma.listing.findMany({
          where: { tenant_id: tenantId },
        });

        console.log(`[SYNC-ROUTE] Encontrados ${listings.length} anúncios para recalcular`);

        let updated = 0;
        const scoreStats = {
          excelente: 0,
          bom: 0,
          regular: 0,
          critico: 0,
        };

        for (const listing of listings) {
          // Calcular novo score
          const scoreResult = ScoreCalculator.calculate({
            id: listing.id,
            title: listing.title,
            description: listing.description,
            price: listing.price.toString(),
            stock: listing.stock,
            status: listing.status,
            thumbnail_url: listing.thumbnail_url,
            pictures_count: listing.pictures_count,
            visits_last_7d: listing.visits_last_7d,
            sales_last_7d: listing.sales_last_7d,
          });

          // Atualizar no banco
          await prisma.listing.update({
            where: { id: listing.id },
            data: {
              super_seller_score: scoreResult.total,
              score_breakdown: {
                cadastro: scoreResult.cadastro,
                trafego: scoreResult.trafego,
                disponibilidade: scoreResult.disponibilidade,
                details: scoreResult.details,
              },
            },
          });

          updated++;

          // Contabilizar estatísticas
          const grade = ScoreCalculator.getGrade(scoreResult.total);
          if (grade.label === 'Excelente') scoreStats.excelente++;
          else if (grade.label === 'Bom') scoreStats.bom++;
          else if (grade.label === 'Regular') scoreStats.regular++;
          else scoreStats.critico++;
        }

        // Calcular média
        const avgScore = listings.length > 0
          ? Math.round(listings.reduce((sum, l) => sum + (l.super_seller_score || 0), 0) / listings.length)
          : 0;

        // Buscar nova média após atualização
        const newAvg = await prisma.listing.aggregate({
          where: { tenant_id: tenantId },
          _avg: { super_seller_score: true },
        });

        console.log(`[SYNC-ROUTE] Recálculo concluído. ${updated} anúncios atualizados. Nova média: ${newAvg._avg.super_seller_score?.toFixed(0)}%`);

        return reply.status(200).send({
          message: 'Recálculo de scores concluído com sucesso',
          data: {
            totalListings: listings.length,
            updated,
            averageScore: Math.round(newAvg._avg.super_seller_score || 0),
            distribution: scoreStats,
          },
        });
      } catch (error) {
        console.error('[SYNC-ROUTE] Erro no recálculo de scores:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha no recálculo de scores',
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
        'POST /recalculate-scores - Recalcular Super Seller Score',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  done();
};
