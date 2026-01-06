import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import { MercadoLivreOrdersService } from '../services/MercadoLivreOrdersService';
import { MercadoLivreVisitsService } from '../services/MercadoLivreVisitsService';
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

// Schema para validar query params de sync de métricas
const MetricsSyncQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(30),
});

// Schema para validar query params de re-sync de listings
const ResyncListingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
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

        // Verificar se há erro de autenticação revogada
        const hasAuthRevoked = result.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') || 
          err.includes('Reconecte sua conta')
        );

        if (hasAuthRevoked) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

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
      } catch (error: any) {
        // Capturar erros AUTH_REVOKED lançados diretamente
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        app.log.error(error);
        return reply.status(500).send({
          error: 'Falha na sincronização',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
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

        // Verificar se há erro de autenticação revogada
        const hasAuthRevoked = result.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') || 
          err.includes('Reconecte sua conta')
        );

        if (hasAuthRevoked) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

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
      } catch (error: any) {
        // Capturar erros AUTH_REVOKED lançados diretamente
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        console.error('[SYNC-ROUTE] Erro na sincronização de pedidos:', error);
        return reply.status(500).send({
          error: 'Falha na sincronização de pedidos',
          message: error instanceof Error ? error.message : 'Erro interno',
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

        // Verificar se há erro de autenticação revogada
        const hasAuthRevoked = 
          listingsResult.errors.some(err => err.includes('AUTH_REVOKED') || err.includes('Conexão expirada')) ||
          ordersResult.errors.some(err => err.includes('AUTH_REVOKED') || err.includes('Conexão expirada'));

        if (hasAuthRevoked) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

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
      } catch (error: any) {
        // Capturar erros AUTH_REVOKED lançados diretamente
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        console.error('[SYNC-ROUTE] Erro na sincronização completa:', error);
        return reply.status(500).send({
          error: 'Falha na sincronização completa',
          message: error instanceof Error ? error.message : 'Erro interno',
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
              } as any, // Cast para InputJsonValue do Prisma
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
   * POST /api/v1/sync/mercadolivre/listings
   * 
   * Re-sincroniza detalhes dos anúncios do Mercado Livre para atualizar campos de cadastro
   * (description, pictures_count, has_video, thumbnail_url).
   * 
   * Útil para corrigir listings que foram criados sem esses dados ou após mudanças no ML.
   * 
   * Query params:
   *   - limit: Número máximo de listings para processar (default: 100, max: 500)
   */
  app.post(
    '/mercadolivre/listings',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        // Validar query params com Zod
        const parsed = ResyncListingsQuerySchema.safeParse(request.query);
        if (!parsed.success) {
          app.log.warn({ 
            requestId,
            userId,
            tenantId,
            query: request.query,
            errors: parsed.error.flatten(),
          }, 'Query params inválidos para re-sync de listings');
          
          return reply.status(400).send({
            error: 'Invalid query parameters',
            message: 'Parâmetros de query inválidos',
            details: parsed.error.flatten(),
          });
        }

        const effectiveLimit = parsed.data.limit ?? 100;

        app.log.info({ 
          requestId,
          userId,
          tenantId,
          limit: effectiveLimit,
        }, 'Requisição de re-sync de listings recebida');

        // Buscar listings do tenant (limitados)
        const listings = await prisma.listing.findMany({
          where: {
            tenant_id: tenantId,
            marketplace: 'mercadolivre',
          },
          take: effectiveLimit,
          orderBy: {
            updated_at: 'asc', // Processar os mais antigos primeiro
          },
        });

        app.log.info({
          requestId,
          tenantId,
          listingsFound: listings.length,
        }, 'Listings encontrados para re-sync');

        if (listings.length === 0) {
          return reply.status(200).send({
            message: 'Nenhum listing encontrado para re-sincronizar',
            data: {
              listingsProcessed: 0,
              listingsUpdated: 0,
              errorsCount: 0,
            },
          });
        }

        // Instanciar service e executar re-sync apenas dos listings encontrados
        const syncService = new MercadoLivreSyncService(tenantId);
        
        // Buscar IDs externos dos listings
        const itemIds = listings.map(l => l.listing_id_ext);
        
        // Executar re-sync
        const result = await syncService.resyncListings(itemIds);

        app.log.info({
          requestId,
          userId,
          tenantId,
          listingsProcessed: result.itemsProcessed,
          listingsUpdated: result.itemsUpdated,
          errorsCount: result.errors.length,
        }, 'Re-sync de listings concluído');

        if (result.success) {
          return reply.status(200).send({
            message: 'Re-sincronização de listings concluída com sucesso',
            data: {
              listingsProcessed: result.itemsProcessed,
              listingsUpdated: result.itemsUpdated,
              errorsCount: result.errors.length,
            },
          });
        } else {
          return reply.status(207).send({
            message: 'Re-sincronização de listings concluída com erros',
            data: {
              listingsProcessed: result.itemsProcessed,
              listingsUpdated: result.itemsUpdated,
              errorsCount: result.errors.length,
              errors: result.errors.slice(0, 10), // Limitar a 10 erros
            },
          });
        }
      } catch (error: any) {
        // Capturar erros AUTH_REVOKED lançados diretamente
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        app.log.error({ requestId, userId, tenantId, err: error }, 'Erro na re-sincronização de listings');
        return reply.status(500).send({
          error: 'Falha na re-sincronização de listings',
          message: error instanceof Error ? error.message : 'Erro interno',
        });
      }
    }
  );

  /**
   * POST /api/v1/sync/mercadolivre/metrics
   * POST /api/v1/sync/mercadolivre/performance (alias)
   * 
   * Dispara sincronização manual das métricas de performance dos anúncios do Mercado Livre.
   * Query params:
   *   - days: Número de dias para buscar (default: 30, max: 90)
   * 
   * Busca métricas agregadas do endpoint /items/{id} e persiste em listing_metrics_daily
   * com flag de origem (ml_items_aggregate, listing_aggregates, estimate).
   */
  // Alias para compatibilidade
  app.post(
    '/mercadolivre/performance',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Redirecionar para a mesma lógica de /metrics
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        const query = MetricsSyncQuerySchema.parse(request.query);
        const daysBack = query.days;

        app.log.info({ 
          requestId,
          userId,
          tenantId,
          days: daysBack,
        }, 'Requisição de sync de performance recebida');

        const syncService = new MercadoLivreSyncService(tenantId);
        const result = await syncService.syncListingMetricsDaily(daysBack);

        const hasAuthRevoked = result.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') || 
          err.includes('Reconecte sua conta')
        );

        if (hasAuthRevoked) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        if (result.success) {
          app.log.info({
            requestId,
            userId,
            tenantId,
            listingsProcessed: result.listingsProcessed,
            rowsUpserted: result.rowsUpserted,
            min_date: result.min_date,
            max_date: result.max_date,
            duration: result.duration,
          }, 'Sync de performance concluído com sucesso');

          return reply.status(200).send({
            message: 'Sincronização de performance concluída com sucesso',
            data: {
              listingsProcessed: result.listingsProcessed,
              rowsUpserted: result.rowsUpserted,
              min_date: result.min_date,
              max_date: result.max_date,
              duration: `${result.duration}ms`,
            },
          });
        } else {
          app.log.error({
            requestId,
            userId,
            tenantId,
            errors: result.errors,
          }, 'Erro no sync de performance');

          return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Erro ao sincronizar métricas',
            details: result.errors,
          });
        }
      } catch (error) {
        const { tenantId, userId, requestId } = (request as RequestWithAuth & { requestId?: string }) || {};
        app.log.error({
          requestId,
          userId,
          tenantId,
          err: error,
        }, 'Erro ao processar sync de performance');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Parâmetros inválidos',
            details: error.errors,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro ao sincronizar performance';
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  app.post(
    '/mercadolivre/metrics',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        // Validar query params
        const query = MetricsSyncQuerySchema.parse(request.query);
        const daysBack = query.days;

        app.log.info({ 
          requestId,
          userId,
          tenantId,
          days: daysBack,
        }, 'Requisição de sync de métricas recebida');

        // Instanciar service e executar sync
        const syncService = new MercadoLivreSyncService(tenantId);
        const result = await syncService.syncListingMetricsDaily(daysBack);

        // Verificar se há erro de autenticação revogada
        const hasAuthRevoked = result.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') || 
          err.includes('Reconecte sua conta')
        );

        if (hasAuthRevoked) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        // Retornar resultado
        if (result.success) {
          app.log.info({
            requestId,
            userId,
            tenantId,
            listingsProcessed: result.listingsProcessed,
            metricsCreated: result.metricsCreated,
            duration: result.duration,
          }, 'Sync de métricas concluído com sucesso');

          return reply.status(200).send({
            message: 'Sincronização de métricas concluída com sucesso',
            data: {
              listingsProcessed: result.listingsProcessed,
              metricsCreated: result.metricsCreated,
              rowsUpserted: result.rowsUpserted,
              min_date: result.min_date,
              max_date: result.max_date,
              duration: `${result.duration}ms`,
            },
          });
        } else {
          app.log.warn({
            requestId,
            userId,
            tenantId,
            listingsProcessed: result.listingsProcessed,
            metricsCreated: result.metricsCreated,
            errors: result.errors,
          }, 'Sync de métricas concluído com erros');

          return reply.status(207).send({
            message: 'Sincronização de métricas concluída com erros',
            data: {
              listingsProcessed: result.listingsProcessed,
              metricsCreated: result.metricsCreated,
              duration: `${result.duration}ms`,
              errors: result.errors,
            },
          });
        }
      } catch (error: any) {
        // Capturar erros AUTH_REVOKED lançados diretamente
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        app.log.error({ requestId, userId, tenantId, err: error }, 'Erro na sincronização de métricas');
        return reply.status(500).send({
          error: 'Falha na sincronização de métricas',
          message: error instanceof Error ? error.message : 'Erro interno',
        });
      }
    }
  );

  /**
   * POST /api/v1/sync/mercadolivre/visits/backfill
   * 
   * Backfill granular de visitas por dia (30 dias) para todos os listings do tenant.
   * Processa em batches por itemId com controle de concorrência.
   * 
   * Query params:
   *   - days: Número de dias para buscar (default: 30, max: 90)
   */
  app.post(
    '/mercadolivre/visits/backfill',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        // Validar query params
        const query = MetricsSyncQuerySchema.parse(request.query);
        const days = Math.min(query.days, 90); // Max 90 dias

        app.log.info({ 
          requestId,
          userId,
          tenantId,
          days,
        }, 'Requisição de backfill de visitas recebida');

        // Instanciar service e executar backfill
        const visitsService = new MercadoLivreVisitsService(tenantId);
        const result = await visitsService.backfillVisitsGranular(days, 50, 5); // batchSize=50, concurrency=5

        // Verificar se há erro de autenticação revogada
        const hasAuthRevoked = result.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') ||
          err.includes('autenticação')
        );

        if (hasAuthRevoked) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        if (result.success) {
          app.log.info({
            requestId,
            userId,
            tenantId,
            days: result.days,
            listingsConsidered: result.listingsConsidered,
            batchesPerDay: result.batchesPerDay,
            rowsUpserted: result.rowsUpserted,
            rowsWithNull: result.rowsWithNull,
            duration: result.duration,
          }, 'Backfill de visitas concluído com sucesso');

          return reply.status(200).send({
            message: 'Backfill de visitas concluído com sucesso',
            data: {
              days: result.days,
              listingsConsidered: result.listingsConsidered,
              batchesPerDay: result.batchesPerDay,
              rowsUpserted: result.rowsUpserted,
              rowsWithNull: result.rowsWithNull,
              duration: `${result.duration}ms`,
              errors: result.errors,
            },
          });
        } else {
          app.log.warn({
            requestId,
            userId,
            tenantId,
            errors: result.errors,
          }, 'Backfill de visitas concluído com erros');

          return reply.status(207).send({
            message: 'Backfill de visitas concluído com alguns erros',
            data: {
              days: result.days,
              listingsConsidered: result.listingsConsidered,
              batchesPerDay: result.batchesPerDay,
              rowsUpserted: result.rowsUpserted,
              rowsWithNull: result.rowsWithNull,
              duration: `${result.duration}ms`,
              errors: result.errors,
            },
          });
        }
      } catch (error: any) {
        const { tenantId, userId, requestId } = (request as RequestWithAuth & { requestId?: string }) || {};
        
        // Capturar erros AUTH_REVOKED lançados diretamente
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        app.log.error({ requestId, userId, tenantId, err: error }, 'Erro no backfill de visitas');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Parâmetros inválidos',
            details: error.errors,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer backfill de visitas';
        return reply.status(500).send({
          error: 'Internal Server Error',
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
        'POST /mercadolivre/metrics - Sync de métricas diárias',
        'POST /mercadolivre/visits/backfill - Backfill granular de visitas por dia',
        'POST /mercadolivre/full - Sync completo',
        'POST /recalculate-scores - Recalcular Super Seller Score',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  done();
};
