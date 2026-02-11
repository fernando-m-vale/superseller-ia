import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import { MercadoLivreOrdersService } from '../services/MercadoLivreOrdersService';
import { MercadoLivreVisitsService } from '../services/MercadoLivreVisitsService';
import { ScoreCalculator } from '../services/ScoreCalculator';
import { authGuard } from '../plugins/auth';
import { getBooleanEnv, getNumberEnv } from '../utils/env-parser';

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

// Schema para validar query params de refresh (orders + metrics)
const RefreshQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(30),
  force: z.coerce.boolean().optional().default(false),
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
   * 
   * Se o discovery de listings falhar com 403 (PolicyAgent), usa fallback via orders
   * para popular listings sem falhar o sync completo.
   */
  app.post(
    '/mercadolivre/full',
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

        app.log.info({ requestId, userId, tenantId }, 'Requisição de sync COMPLETO recebida');

        const syncService = new MercadoLivreSyncService(tenantId);
        let listingsResult: {
          success: boolean;
          itemsProcessed: number;
          itemsCreated: number;
          itemsUpdated: number;
          duration: number;
          errors: string[];
          source?: string;
          discoveryBlocked?: boolean;
        };
        let discoveryBlocked = false;

        // 1. Tentar sync de listings via discovery
        try {
          listingsResult = await syncService.syncListings();
          
          // Verificar se houve erro 403 no discovery
          const has403Error = listingsResult.errors.some(err => 
            err.includes('403') || err.includes('PolicyAgent')
          );
          
          if (has403Error || (listingsResult.itemsProcessed === 0 && listingsResult.errors.length > 0)) {
            discoveryBlocked = true;
            app.log.warn({ 
              requestId, 
              tenantId, 
              discoveryBlocked: true,
              originalErrors: listingsResult.errors,
            }, 'Discovery bloqueado (403). Usando fallback via orders...');
            
            // Usar fallback via orders
            const fallbackResult = await syncService.syncListingsFromOrders(30);
            listingsResult = {
              success: fallbackResult.success,
              itemsProcessed: fallbackResult.itemsProcessed,
              itemsCreated: fallbackResult.itemsCreated,
              itemsUpdated: fallbackResult.itemsUpdated,
              duration: fallbackResult.duration,
              errors: fallbackResult.errors.length > 0 
                ? ['Discovery blocked; used orders fallback', ...fallbackResult.errors]
                : ['Discovery blocked; used orders fallback'],
              source: 'orders_fallback',
              discoveryBlocked: true,
            };
            
            app.log.info({
              requestId,
              tenantId,
              discoveryBlocked: true,
              fallbackItemsCreated: fallbackResult.itemsCreated,
              fallbackItemsUpdated: fallbackResult.itemsUpdated,
              uniqueItemIds: fallbackResult.uniqueItemIds,
            }, 'Fallback via orders concluído');
          }
        } catch (discoveryError) {
          // Se o erro for 403, usar fallback
          if (MercadoLivreSyncService.isDiscoveryBlockedError(discoveryError)) {
            discoveryBlocked = true;
            app.log.warn({ 
              requestId, 
              tenantId, 
              discoveryBlocked: true,
              err: discoveryError,
            }, 'Discovery bloqueado (403 exception). Usando fallback via orders...');
            
            const fallbackResult = await syncService.syncListingsFromOrders(30);
            listingsResult = {
              success: fallbackResult.success,
              itemsProcessed: fallbackResult.itemsProcessed,
              itemsCreated: fallbackResult.itemsCreated,
              itemsUpdated: fallbackResult.itemsUpdated,
              duration: fallbackResult.duration,
              errors: ['Discovery blocked; used orders fallback', ...fallbackResult.errors],
              source: 'orders_fallback',
              discoveryBlocked: true,
            };
          } else {
            // Re-throw outros erros
            throw discoveryError;
          }
        }

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

        // Considerar sucesso mesmo com fallback (desde que não haja outros erros)
        const listingsSuccess = listingsResult.success || (discoveryBlocked && listingsResult.itemsCreated > 0);
        const allSuccess = listingsSuccess && ordersResult.success;

        app.log.info({
          requestId,
          tenantId,
          discoveryBlocked,
          listingsSuccess,
          ordersSuccess: ordersResult.success,
          allSuccess,
          listingsItemsCreated: listingsResult.itemsCreated,
          listingsItemsUpdated: listingsResult.itemsUpdated,
          ordersProcessed: ordersResult.ordersProcessed,
        }, 'Sync COMPLETO finalizado');

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
              source: listingsResult.source || 'discovery',
              discoveryBlocked,
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
      } catch (error: unknown) {
        // Capturar erros AUTH_REVOKED lançados diretamente
        const err = error as { code?: string; message?: string };
        if (err.code === 'AUTH_REVOKED' || err.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        app.log.error({ requestId, userId, tenantId, err: error }, 'Erro na sincronização completa');
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

        // Calcular range de datas (dateFrom até today)
        // Para periodDays=30, queremos 30 dias incluindo hoje: hoje-29 até hoje
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const dateFrom = new Date(today);
        dateFrom.setUTCDate(dateFrom.getUTCDate() - (daysBack - 1)); // Incluir hoje no range (hoje-29 para 30 dias)
        
        const dateTo = new Date(today); // Incluir hoje no range

        const syncService = new MercadoLivreSyncService(tenantId);
        const result = await syncService.syncListingMetricsDaily(tenantId, dateFrom, dateTo, daysBack);

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

  /**
   * POST /api/v1/sync/mercadolivre/refresh?days=7|30&force=false
   * 
   * Executa refresh completo: sincroniza orders do ML e depois reconstrói métricas diárias.
   * Fluxo:
   * 1. Sincroniza orders do Mercado Livre para o banco (dateFrom até dateTo)
   * 2. Reconstrói métricas diárias usando orders + order_items do banco
   * 
   * Retorna resultado consolidado com ordersSynced, metricsRowsUpserted, etc.
   */
  app.post(
    '/mercadolivre/refresh',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };
      const startTime = Date.now();

      try {
        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        // Validar query params
        const query = RefreshQuerySchema.parse(request.query);
        const daysBack = query.days;
        const force = query.force;

        app.log.info({ 
          requestId,
          userId,
          tenantId,
          days: daysBack,
          force,
        }, 'Requisição de refresh (orders + metrics) recebida');

        // Calcular range de datas (dateFrom até dateTo inclusive)
        const dateToUtc = new Date();
        dateToUtc.setUTCHours(0, 0, 0, 0);
        
        const dateFromUtc = new Date(dateToUtc);
        dateFromUtc.setUTCDate(dateFromUtc.getUTCDate() - (daysBack - 1)); // Incluir hoje no range

        // 1. Sincronizar orders do Mercado Livre
        app.log.info({ tenantId, dateFrom: dateFromUtc.toISOString(), dateTo: dateToUtc.toISOString() }, 'Iniciando sync de orders...');
        const ordersService = new MercadoLivreOrdersService(tenantId);
        
        let ordersResult;
        try {
          ordersResult = await ordersService.syncOrdersByRange(dateFromUtc, dateToUtc);
        } catch (ordersError: any) {
          // Não engolir erros da API do ML - propagar com status code apropriado
          const statusCode = ordersError.statusCode || 500;
          const mlErrorBody = ordersError.mlErrorBody || null;
          
          app.log.error({
            tenantId,
            statusCode,
            mlErrorBody,
            error: ordersError.message,
          }, 'Erro ao sincronizar orders do ML');

          // Se for 401/403, marcar conexão como reauth_required
          if (statusCode === 401 || statusCode === 403) {
            const { markConnectionReauthRequired } = await import('../utils/mark-connection-reauth');
            await markConnectionReauthRequired({
              tenantId,
              statusCode,
              errorMessage: mlErrorBody?.message || `ML API Error ${statusCode}`,
            });

            return reply.status(409).send({
              error: 'CONNECTION_EXPIRED',
              message: 'Conexão com Mercado Livre expirou. Reconecte.',
              code: 'CONNECTION_EXPIRED',
              mlError: {
                status: statusCode,
                message: mlErrorBody?.message || 'Unauthorized',
              },
            });
          }

          // Se for 400 (ex: limit > 51), não interromper refresh de metrics/visits
          // Continuar com ordersResult vazio e permitir que metrics/visits executem
          if (statusCode === 400) {
            app.log.warn({
              tenantId,
              statusCode,
              mlErrorBody,
              error: ordersError.message,
            }, 'Erro 400 ao sincronizar orders (ex: limit > 51). Continuando com metrics/visits...');
            
            // Criar ordersResult vazio para não interromper o fluxo
            ordersResult = {
              success: false,
              ordersProcessed: 0,
              ordersCreated: 0,
              ordersUpdated: 0,
              totalGMV: 0,
              errors: [`Erro 400 ao buscar orders: ${ordersError.message}`],
              duration: 0,
              fetched: 0,
              inRangeCount: 0,
              fallbackUsed: false,
              fallbackFetched: 0,
            };
          } else {
            // Retornar 502 Bad Gateway para outros erros da API do ML (5xx, etc)
            return reply.status(502).send({
              error: 'ML API Error',
              message: `Erro ao buscar orders do Mercado Livre: ${ordersError.message}`,
              mlError: {
                status: statusCode,
                message: mlErrorBody?.message || ordersError.message,
                body: mlErrorBody, // Sanitizado (sem token)
              },
            });
          }
        }

        app.log.info({
          tenantId,
          ordersProcessed: ordersResult.ordersProcessed,
          ordersCreated: ordersResult.ordersCreated,
          ordersUpdated: ordersResult.ordersUpdated,
          fetched: ordersResult.fetched,
          inRangeCount: ordersResult.inRangeCount,
          fallbackUsed: ordersResult.fallbackUsed,
        }, 'Sync de orders concluído');

        // 2. Reconciliar status de listings antes de sync (corrige paused→active no ML)
        app.log.info({ tenantId }, 'Reconciliando status de listings com Mercado Livre...');
        const syncService = new MercadoLivreSyncService(tenantId);
        const reconcileResult = await syncService.reconcileListingStatus(true); // Apenas listings não-active
        app.log.info({
          tenantId,
          reconcileCandidates: reconcileResult.candidates,
          reconcileChecked: reconcileResult.checked,
          reconcileUpdated: reconcileResult.updated,
          reconcileBlockedByPolicy: reconcileResult.blockedByPolicy,
          reconcileUnauthorized: reconcileResult.unauthorized,
          reconcileSkipped: reconcileResult.skipped,
          errors: reconcileResult.errors.length,
          detailsSample: reconcileResult.details.slice(0, 5), // Amostra dos primeiros 5
        }, 'Reconciliação de status concluída');

        // 3. Reconstruir métricas diárias usando orders + order_items do banco
        app.log.info({ tenantId, dateFrom: dateFromUtc.toISOString(), dateTo: dateToUtc.toISOString() }, 'Iniciando rebuild de métricas...');
        const metricsResult = await syncService.syncListingMetricsDaily(tenantId, dateFromUtc, dateToUtc, daysBack);

        // Verificar se há erro de autenticação revogada no metrics também
        const hasAuthRevokedMetrics = metricsResult.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') || 
          err.includes('Reconecte sua conta')
        );

        if (hasAuthRevokedMetrics) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        // 4. Sincronizar visitas do Mercado Livre
        app.log.info({ tenantId, dateFrom: dateFromUtc.toISOString(), dateTo: dateToUtc.toISOString() }, 'Iniciando sync de visitas...');
        const visitsService = new MercadoLivreVisitsService(tenantId);
        const visitsResult = await visitsService.syncVisitsByRange(tenantId, dateFromUtc, dateToUtc);

        // Verificar se há erro de autenticação revogada no visits também
        const hasAuthRevokedVisits = visitsResult.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') || 
          err.includes('Reconecte sua conta') ||
          err.includes('401') ||
          err.includes('403')
        );

        if (hasAuthRevokedVisits) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        // 5. HOTFIX DIA 05: Materializar orders/gmv em listing_metrics_daily
        // Reutilizar os mesmos listingIds processados em visits
        app.log.info({ 
          tenantId, 
          dateFrom: dateFromUtc.toISOString(), 
          dateTo: dateToUtc.toISOString(),
          listingIdsCount: visitsResult.listingIds.length,
        }, 'Iniciando materialização de orders/gmv...');
        
        const ordersMetricsResult = await syncService.syncOrdersMetricsDaily(
          tenantId,
          dateFromUtc,
          dateToUtc,
          visitsResult.listingIds
        );

        const totalDuration = Date.now() - startTime;

        app.log.info({
          requestId,
          userId,
          tenantId,
          reconcileCandidates: reconcileResult.candidates,
          reconcileChecked: reconcileResult.checked,
          reconcileUpdated: reconcileResult.updated,
          reconcileBlockedByPolicy: reconcileResult.blockedByPolicy,
          reconcileUnauthorized: reconcileResult.unauthorized,
          ordersProcessed: ordersResult.ordersProcessed,
          ordersCreated: ordersResult.ordersCreated,
          metricsRowsUpserted: metricsResult.rowsUpserted,
          visitsListingsProcessed: visitsResult.listingsProcessed,
          visitsRowsUpserted: visitsResult.rowsUpserted,
          ordersMetricsListingsProcessed: ordersMetricsResult.listingsProcessed,
          ordersMetricsRowsUpserted: ordersMetricsResult.rowsUpserted,
          totalDuration,
        }, 'Refresh completo concluído');

        // Nunca retornar success:true com fetched=0 se houver erro HTTP da API
        // Se houver erro HTTP (statusCode), não considerar success
        const hasHttpError = ordersResult.errors.some(err => 
          err.includes('ML API Error') || err.includes('401') || err.includes('403') || err.includes('400')
        );
        const ordersSuccess = !hasHttpError && ordersResult.success && 
          (ordersResult.fetched !== undefined ? ordersResult.fetched > 0 : ordersResult.ordersProcessed > 0) &&
          ordersResult.errors.length === 0;

        // Retornar resultado consolidado
        return reply.status(200).send({
          message: ordersSuccess ? 'Refresh concluído com sucesso' : 'Refresh concluído com avisos',
          data: {
            reconcile: {
              candidates: reconcileResult.candidates,
              checked: reconcileResult.checked,
              listingsUpdated: reconcileResult.updated,
              blockedByPolicy: reconcileResult.blockedByPolicy,
              unauthorized: reconcileResult.unauthorized,
              skipped: reconcileResult.skipped,
              errors: reconcileResult.errors.length > 0 ? reconcileResult.errors : undefined,
              details: reconcileResult.details.slice(0, 20), // Amostra dos primeiros 20 para não sobrecarregar response
            },
            orders: {
              fetched: ordersResult.fetched ?? 0,
              processed: ordersResult.ordersProcessed,
              created: ordersResult.ordersCreated,
              updated: ordersResult.ordersUpdated,
              inRangeCount: ordersResult.inRangeCount ?? ordersResult.ordersProcessed,
              fallbackUsed: ordersResult.fallbackUsed ?? false,
              fallbackFetched: ordersResult.fallbackFetched ?? 0,
              totalGMV: ordersResult.totalGMV,
              success: ordersSuccess,
              errors: ordersResult.errors.length > 0 ? ordersResult.errors : undefined,
            },
            metrics: {
              listingsProcessed: metricsResult.listingsProcessed,
              rowsUpserted: metricsResult.rowsUpserted,
              min_date: metricsResult.min_date,
              max_date: metricsResult.max_date,
              success: metricsResult.success,
              errors: metricsResult.errors.length > 0 ? metricsResult.errors : undefined,
            },
            visits: {
              listingsProcessed: visitsResult.listingsProcessed,
              rowsUpserted: visitsResult.rowsUpserted,
              min_date: visitsResult.min_date,
              max_date: visitsResult.max_date,
              success: visitsResult.success,
              visits_status: visitsResult.visits_status,
              failures_summary: visitsResult.failures_summary,
              errors: visitsResult.errors.length > 0 ? visitsResult.errors : undefined,
            },
            ordersMetrics: {
              listingsProcessed: ordersMetricsResult.listingsProcessed,
              rowsUpserted: ordersMetricsResult.rowsUpserted,
              min_date: ordersMetricsResult.min_date,
              max_date: ordersMetricsResult.max_date,
              success: ordersMetricsResult.success,
              errors: ordersMetricsResult.errors.length > 0 ? ordersMetricsResult.errors : undefined,
            },
            duration: `${totalDuration}ms`,
            ordersDuration: `${ordersResult.duration}ms`,
            metricsDuration: `${metricsResult.duration}ms`,
            visitsDuration: `${visitsResult.duration}ms`,
          },
        });
      } catch (error) {
        const { tenantId, userId, requestId } = (request as RequestWithAuth & { requestId?: string }) || {};
        app.log.error({
          requestId,
          userId,
          tenantId,
          err: error,
        }, 'Erro ao processar refresh');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Parâmetros inválidos',
            details: error.errors,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro ao processar refresh';
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
        // Calcular range de datas (dateFrom até today)
        // Para periodDays=30, queremos 30 dias incluindo hoje: hoje-29 até hoje
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const dateFrom = new Date(today);
        dateFrom.setUTCDate(dateFrom.getUTCDate() - (daysBack - 1)); // Incluir hoje no range (hoje-29 para 30 dias)
        
        const dateTo = new Date(today); // Incluir hoje no range

        const syncService = new MercadoLivreSyncService(tenantId);
        const result = await syncService.syncListingMetricsDaily(tenantId, dateFrom, dateTo, daysBack);

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
   * POST /api/v1/sync/mercadolivre/visits?days=7|30
   * 
   * Sincroniza visitas do Mercado Livre por range de dias
   * 
   * Query params:
   * - days: número de dias para buscar (7 ou 30, padrão: 7)
   */
  app.post(
    '/mercadolivre/visits',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      
      try {
        const { tenantId, userId, requestId } = (request as RequestWithAuth & { requestId?: string }) || {};

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        // Validar query params
        const query = MetricsSyncQuerySchema.parse(request.query);
        const daysBack = query.days;

        // Calcular range de datas (UTC midnight)
        const dateToUtc = new Date();
        dateToUtc.setUTCHours(0, 0, 0, 0);
        
        const dateFromUtc = new Date(dateToUtc);
        dateFromUtc.setUTCDate(dateFromUtc.getUTCDate() - (daysBack - 1)); // Incluir hoje no range
        
        // Ajustar dateToUtc para end of day para filtros de API
        const dateToUtcEndOfDay = new Date(dateToUtc);
        dateToUtcEndOfDay.setUTCHours(23, 59, 59, 999);

        app.log.info({ 
          requestId, 
          userId, 
          tenantId, 
          days: daysBack,
          dateFrom: dateFromUtc.toISOString(), 
          dateTo: dateToUtcEndOfDay.toISOString(),
        }, 'Requisição de sync de visitas recebida');

        // Sincronizar visitas
        const visitsService = new MercadoLivreVisitsService(tenantId);
        const visitsResult = await visitsService.syncVisitsByRange(tenantId, dateFromUtc, dateToUtcEndOfDay);

        // Verificar se há erro de autenticação revogada
        const hasAuthRevoked = visitsResult.errors.some(err => 
          err.includes('AUTH_REVOKED') || 
          err.includes('Conexão expirada') || 
          err.includes('Reconecte sua conta') ||
          err.includes('401') ||
          err.includes('403')
        );

        if (hasAuthRevoked) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        const duration = Date.now() - startTime;

        app.log.info({
          requestId,
          userId,
          tenantId,
          days: daysBack,
          listingsProcessed: visitsResult.listingsProcessed,
          rowsUpserted: visitsResult.rowsUpserted,
          visits_status: visitsResult.visits_status,
          failures_summary: visitsResult.failures_summary,
          min_date: visitsResult.min_date,
          max_date: visitsResult.max_date,
          duration,
        }, 'Sync de visitas concluído');

        const responseStatus = visitsResult.errors.length > 0 ? 207 : 200;
        const responseMessage = visitsResult.errors.length > 0 
          ? 'Sync de visitas concluído com avisos/erros' 
          : 'Sync de visitas concluído com sucesso';

        return reply.status(responseStatus).send({
          message: responseMessage,
          success: visitsResult.success,
          listingsProcessed: visitsResult.listingsProcessed,
          rowsUpserted: visitsResult.rowsUpserted,
          min_date: visitsResult.min_date,
          max_date: visitsResult.max_date,
          visits_status: visitsResult.visits_status,
          failures_summary: visitsResult.failures_summary,
          duration: `${duration}ms`,
          errors: visitsResult.errors.length > 0 ? visitsResult.errors : undefined,
        });
      } catch (error) {
        const { tenantId, userId, requestId } = (request as RequestWithAuth & { requestId?: string }) || {};
        app.log.error({
          requestId,
          userId,
          tenantId,
          err: error,
        }, 'Erro ao processar sync de visitas');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Parâmetros inválidos',
            details: error.errors,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro ao sincronizar visitas';
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
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
   * POST /api/v1/sync/mercadolivre/listings/:listingIdExt/force-refresh
   * 
   * Força refresh de um anúncio específico, atualizando todos os campos incluindo promoção.
   * Útil para corrigir anúncios que não foram processados corretamente.
   * 
   * Query params:
   * - forcePromoPrices (boolean, opcional): Se true, ignora TTL e força busca de /prices mesmo se promotion_checked_at recente.
   *   Por padrão, respeita TTL para evitar rate limits.
   */
  app.post(
    '/mercadolivre/listings/:listingIdExt/force-refresh',
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

        const listingIdExt = (request.params as { listingIdExt: string }).listingIdExt;
        if (!listingIdExt) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'listingIdExt é obrigatório',
          });
        }

        // Parse query param forcePromoPrices (opcional, default false)
        const query = request.query as { forcePromoPrices?: string };
        const forcePromoPrices = query.forcePromoPrices === 'true' || query.forcePromoPrices === '1';

        app.log.info({ 
          requestId,
          userId,
          tenantId,
          listingIdExt,
        }, 'Requisição de force refresh de listing recebida');

        // Verificar se o listing existe e pertence ao tenant
        const existing = await prisma.listing.findFirst({
          where: {
            tenant_id: tenantId,
            listing_id_ext: listingIdExt,
            marketplace: 'mercadolivre',
          },
        });

        if (!existing) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Listing ${listingIdExt} não encontrado para este tenant`,
          });
        }

        // Instanciar service e buscar item do ML
        // Passar forcePromoPrices para ignorar TTL se solicitado
        const syncService = new MercadoLivreSyncService(tenantId);
        const items = await syncService.fetchItemsDetails([listingIdExt], forcePromoPrices);

        if (items.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Item ${listingIdExt} não encontrado no Mercado Livre`,
          });
        }

        const enrichmentMeta = items[0]._enrichmentMeta ?? { 
          endpointUsed: 'none' as const, 
          statusCode: 0, 
          payloadSize: 0,
          reason: undefined
        };

        // Aplicar mesma lógica de persistência do sync
        const { updated } = await syncService.upsertListings(items, 'force_refresh', false);

        // Buscar listing atualizado
        const updatedListing = await prisma.listing.findFirst({
          where: {
            tenant_id: tenantId,
            listing_id_ext: listingIdExt,
          },
          select: {
            id: true,
            listing_id_ext: true,
            title: true,
            price: true,
            original_price: true,
            price_final: true,
            has_promotion: true,
            discount_percent: true,
            promotion_type: true,
            updated_at: true,
          },
        });

        app.log.info({
          requestId,
          userId,
          tenantId,
          listingIdExt,
          updated,
          endpointUsed: enrichmentMeta.endpointUsed,
          statusCode: enrichmentMeta.statusCode,
          payloadSize: enrichmentMeta.payloadSize,
          has_promotion: updatedListing?.has_promotion,
          price_final: updatedListing?.price_final,
          original_price: updatedListing?.original_price,
          discount_percent: updatedListing?.discount_percent,
        }, 'Force refresh concluído');

        // Obter configuração de preços promocionais para observabilidade
        const useMlPricesForPromo = getBooleanEnv('USE_ML_PRICES_FOR_PROMO', false);
        const promoPricesTtlHours = getNumberEnv('PROMO_PRICES_TTL_HOURS', 12);

        // Determinar se aplicou preços promocionais
        const applied = enrichmentMeta.endpointUsed === 'prices';
        const reason = enrichmentMeta.reason || (applied ? undefined : (useMlPricesForPromo ? 'ttl_not_expired' : 'flag_off'));

        return reply.status(200).send({
          message: 'Force refresh concluído com sucesso',
          data: {
            listingIdExt,
            updated: updated > 0,
            listing: updatedListing,
            config: {
              useMlPricesForPromo,
              promoPricesTtlHours,
              forcePromoPrices,
            },
            enrichment: {
              endpointUsed: enrichmentMeta.endpointUsed,
              statusCode: enrichmentMeta.statusCode,
              payloadSize: enrichmentMeta.payloadSize,
              applied,
              appliedValues: applied ? {
                original_price: updatedListing?.original_price ?? null,
                price_final: updatedListing?.price_final ?? null,
                discount_percent: updatedListing?.discount_percent ?? null,
              } : undefined,
              reason,
            },
          },
        });
      } catch (error: any) {
        const { tenantId, userId, requestId } = (request as RequestWithAuth & { requestId?: string }) || {};
        
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        app.log.error({ requestId, userId, tenantId, err: error }, 'Erro no force refresh');
        return reply.status(500).send({
          error: 'Falha no force refresh',
          message: error instanceof Error ? error.message : 'Erro interno',
        });
      }
    }
  );

  /**
   * POST /api/v1/sync/mercadolivre/listings/backfill-promotions?limit=200
   * 
   * Reprocessa os últimos limit listings do tenant e persiste promoção/price_final/original_price.
   * Útil para corrigir anúncios que foram gravados antes da correção do parser de promoção.
   */
  app.post(
    '/mercadolivre/listings/backfill-promotions',
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
        const limit = request.query && typeof request.query === 'object' && 'limit' in request.query
          ? Math.min(Number(request.query.limit) || 200, 500)
          : 200;

        app.log.info({ 
          requestId,
          userId,
          tenantId,
          limit,
        }, 'Requisição de backfill de promoções recebida');

        // Buscar últimos listings do tenant (ordenar por updated_at desc)
        const listings = await prisma.listing.findMany({
          where: {
            tenant_id: tenantId,
            marketplace: 'mercadolivre',
          },
          take: limit,
          orderBy: {
            updated_at: 'desc',
          },
          select: {
            id: true,
            listing_id_ext: true,
          },
        });

        app.log.info({
          requestId,
          tenantId,
          listingsFound: listings.length,
        }, 'Listings encontrados para backfill');

        if (listings.length === 0) {
          return reply.status(200).send({
            message: 'Nenhum listing encontrado para backfill',
            data: {
              listingsProcessed: 0,
              listingsUpdated: 0,
            },
          });
        }

        // Instanciar service
        const syncService = new MercadoLivreSyncService(tenantId);
        
        // Processar em lotes de 20 (limite da API do ML)
        const chunks = [];
        for (let i = 0; i < listings.length; i += 20) {
          chunks.push(listings.slice(i, i + 20));
        }

        let totalProcessed = 0;
        let totalUpdated = 0;
        const errors: string[] = [];

        for (const chunk of chunks) {
          try {
            const itemIds = chunk.map(l => l.listing_id_ext);
            const items = await syncService.fetchItemsDetails(itemIds);
            
            // Aplicar lógica de persistência
            const { updated } = await syncService.upsertListings(items, 'backfill_promotions', false);
            
            totalProcessed += items.length;
            totalUpdated += updated;

            // Log para cada listing
            for (const item of items) {
              const listing = await prisma.listing.findFirst({
                where: {
                  tenant_id: tenantId,
                  listing_id_ext: item.id,
                },
                select: {
                  price: true,
                  price_final: true,
                  original_price: true,
                  has_promotion: true,
                  discount_percent: true,
                },
              });

              app.log.info({
                listing_id_ext: item.id,
                price: listing?.price,
                price_final: listing?.price_final,
                original_price: listing?.original_price,
                has_promotion: listing?.has_promotion,
                discount_percent: listing?.discount_percent,
              }, '[BACKFILL-PROMOTIONS] Listing processado');
            }
          } catch (chunkError) {
            const errorMsg = chunkError instanceof Error ? chunkError.message : 'Erro desconhecido';
            errors.push(`Lote com ${chunk.length} itens: ${errorMsg}`);
            app.log.error({ 
              requestId,
              tenantId,
              chunkSize: chunk.length,
              error: errorMsg,
            }, '[BACKFILL-PROMOTIONS] Erro no lote');
          }
        }

        app.log.info({
          requestId,
          userId,
          tenantId,
          totalProcessed,
          totalUpdated,
          errorsCount: errors.length,
        }, 'Backfill de promoções concluído');

        return reply.status(errors.length > 0 ? 207 : 200).send({
          message: errors.length > 0 
            ? 'Backfill concluído com alguns erros' 
            : 'Backfill concluído com sucesso',
          data: {
            listingsProcessed: totalProcessed,
            listingsUpdated: totalUpdated,
            errors: errors.length > 0 ? errors : undefined,
          },
        });
      } catch (error: any) {
        const { tenantId, userId, requestId } = (request as RequestWithAuth & { requestId?: string }) || {};
        
        if (error.code === 'AUTH_REVOKED' || error.message?.includes('Conexão expirada')) {
          return reply.status(401).send({
            error: 'AUTH_REVOKED',
            message: 'Conexão expirada. Reconecte sua conta.',
            code: 'AUTH_REVOKED',
          });
        }

        app.log.error({ requestId, userId, tenantId, err: error }, 'Erro no backfill de promoções');
        return reply.status(500).send({
          error: 'Falha no backfill de promoções',
          message: error instanceof Error ? error.message : 'Erro interno',
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
        'POST /mercadolivre/visits - Sync de visitas por range',
        'POST /mercadolivre/visits/backfill - Backfill granular de visitas por dia',
        'POST /mercadolivre/full - Sync completo',
        'POST /mercadolivre/listings/from-orders - Sync de listings via orders (fallback)',
        'POST /mercadolivre/listings/:listingIdExt/force-refresh - Force refresh de um listing',
        'POST /mercadolivre/listings/backfill-promotions - Backfill de promoções',
        'POST /recalculate-scores - Recalcular Super Seller Score',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  done();
};
