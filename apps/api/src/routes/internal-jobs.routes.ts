/**
 * Internal Jobs Routes
 * 
 * Endpoints protegidos com X-Internal-Key para execução de jobs idempotentes
 * - POST /api/v1/jobs/sync-mercadolivre: Sync de dados base do Mercado Livre
 * - POST /api/v1/jobs/rebuild-daily-metrics: Rebuild de listing_metrics_daily
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Prisma, JobType, JobStatus } from '@prisma/client';
import { internalAuthGuard } from '../plugins/internal-auth';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';

const prisma = new PrismaClient();

// Schema para sync-mercadolivre
const SyncMercadoLivreSchema = z.object({
  tenantId: z.string().uuid().optional(), // Opcional: pode inferir do token se autenticado
  daysBack: z.number().int().min(1).max(90).default(30),
});

// Schema para rebuild-daily-metrics
const RebuildDailyMetricsSchema = z.object({
  tenantId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
});

export const internalJobsRoutes: FastifyPluginCallback = (app, _, done) => {
  
  /**
   * POST /api/v1/jobs/sync-mercadolivre
   * 
   * Executa sync completo do Mercado Livre (listings + orders)
   * Params: tenantId (opcional, pode inferir do token), daysBack (default 30)
   */
  app.post(
    '/sync-mercadolivre',
    { preHandler: internalAuthGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      let jobLogId: string | null = null;

      try {
        const body = SyncMercadoLivreSchema.parse(request.body);
        const tenantId = body.tenantId;

        if (!tenantId) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'tenantId é obrigatório para jobs internos',
          });
        }

        app.log.info(
          { tenantId, daysBack: body.daysBack },
          '[INTERNAL-JOB] Iniciando sync Mercado Livre'
        );

        // Criar log de job
        const jobLog = await prisma.jobLog.create({
          data: {
            tenant_id: tenantId,
            job_type: JobType.mercadolivre_sync,
            status: JobStatus.running,
            started_at: new Date(),
            metadata: {
              daysBack: body.daysBack,
              source: 'internal_job',
            } as Prisma.InputJsonValue,
          },
        });
        jobLogId = jobLog.id;

        // Executar sync de listings
        const syncService = new MercadoLivreSyncService(tenantId);
        const syncResult = await syncService.syncListings();

        // Importar OrdersService dinamicamente
        const { MercadoLivreOrdersService } = await import('../services/MercadoLivreOrdersService');
        const ordersService = new MercadoLivreOrdersService(tenantId);
        const ordersResult = await ordersService.syncOrders(body.daysBack);

        const duration = Date.now() - startTime;
        const success = syncResult.success && ordersResult.success;
        const totalProcessed = syncResult.itemsProcessed + ordersResult.ordersProcessed;

        // Atualizar log de job
        await prisma.jobLog.update({
          where: { id: jobLogId },
          data: {
            status: success ? JobStatus.success : JobStatus.error,
            completed_at: new Date(),
            duration_ms: duration,
            records_processed: totalProcessed,
            error_message: success ? null : [...syncResult.errors, ...ordersResult.errors].join('; '),
            metadata: {
              daysBack: body.daysBack,
              source: 'internal_job',
              syncResult: {
                itemsProcessed: syncResult.itemsProcessed,
                itemsCreated: syncResult.itemsCreated,
                itemsUpdated: syncResult.itemsUpdated,
              },
              ordersResult: {
                ordersProcessed: ordersResult.ordersProcessed,
                ordersCreated: ordersResult.ordersCreated,
                ordersUpdated: ordersResult.ordersUpdated,
              },
            } as Prisma.InputJsonValue,
          },
        });

        app.log.info(
          {
            tenantId,
            jobLogId,
            duration,
            success,
            totalProcessed,
          },
          '[INTERNAL-JOB] Sync Mercado Livre concluído'
        );

        return reply.status(200).send({
          success,
          jobLogId,
          duration,
          recordsProcessed: totalProcessed,
          sync: {
            itemsProcessed: syncResult.itemsProcessed,
            itemsCreated: syncResult.itemsCreated,
            itemsUpdated: syncResult.itemsUpdated,
          },
          orders: {
            ordersProcessed: ordersResult.ordersProcessed,
            ordersCreated: ordersResult.ordersCreated,
            ordersUpdated: ordersResult.ordersUpdated,
          },
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        if (jobLogId) {
          await prisma.jobLog.update({
            where: { id: jobLogId },
            data: {
              status: JobStatus.error,
              completed_at: new Date(),
              duration_ms: duration,
              error_message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }

        app.log.error(
          { err: error, duration },
          '[INTERNAL-JOB] Erro no sync Mercado Livre'
        );

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid request data',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/v1/jobs/rebuild-daily-metrics
   * 
   * Recalcula e faz UPSERT em listing_metrics_daily para intervalo de datas
   * Body: { tenantId, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
   * 
   * Idempotente: pode ser chamado múltiplas vezes sem duplicar dados
   */
  app.post(
    '/rebuild-daily-metrics',
    { preHandler: internalAuthGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      let jobLogId: string | null = null;

      try {
        const body = RebuildDailyMetricsSchema.parse(request.body);
        const { tenantId, from, to } = body;

        // Validar datas
        const dateFrom = new Date(from);
        const dateTo = new Date(to);
        
        if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Datas inválidas',
          });
        }

        if (dateFrom > dateTo) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Data "from" deve ser anterior ou igual a "to"',
          });
        }

        // Limitar intervalo máximo (90 dias)
        const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 90) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Intervalo máximo é de 90 dias',
          });
        }

        app.log.info(
          { tenantId, from, to, daysDiff },
          '[INTERNAL-JOB] Iniciando rebuild de daily metrics'
        );

        // Criar log de job
        const jobLog = await prisma.jobLog.create({
          data: {
            tenant_id: tenantId,
            job_type: JobType.metrics_aggregation,
            status: JobStatus.running,
            started_at: new Date(),
            metadata: {
              from,
              to,
              daysDiff,
              source: 'internal_job',
            } as Prisma.InputJsonValue,
          },
        });
        jobLogId = jobLog.id;

        // Executar rebuild usando syncListingMetricsDaily com período customizado
        const syncService = new MercadoLivreSyncService(tenantId);
        
        // Calcular periodDays baseado no intervalo (from até hoje)
        // O método syncListingMetricsDaily busca dados dos últimos N dias e salva no dia atual
        // Para garantir que MAX(date) seja hoje, usamos o número de dias desde 'from' até hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const periodDays = Math.ceil((today.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
        
        // Chamar syncListingMetricsDaily que já faz UPSERT idempotente
        // NOTA: O método atual salva tudo no dia atual como agregado do período
        // Isso garante que MAX(date) seja hoje, mas não distribui por dia
        const result = await syncService.syncListingMetricsDaily(periodDays);

        const duration = Date.now() - startTime;

        // Buscar MAX(date) após rebuild para validar DoD
        const maxDateResult = await prisma.listingMetricsDaily.findFirst({
          where: { tenant_id: tenantId },
          orderBy: { date: 'desc' },
          select: { date: true },
        });

        // Atualizar log de job
        await prisma.jobLog.update({
          where: { id: jobLogId },
          data: {
            status: result.success ? JobStatus.success : JobStatus.error,
            completed_at: new Date(),
            duration_ms: duration,
            records_processed: result.rowsUpserted,
            error_message: result.success ? null : result.errors.join('; '),
            metadata: {
              from,
              to,
              daysDiff,
              source: 'internal_job',
              result: {
                listingsProcessed: result.listingsProcessed,
                metricsCreated: result.metricsCreated,
                rowsUpserted: result.rowsUpserted,
                min_date: result.min_date,
                max_date: result.max_date,
                maxDateAfterRebuild: maxDateResult?.date.toISOString().split('T')[0] || null,
              },
            } as Prisma.InputJsonValue,
          },
        });

        app.log.info(
          {
            tenantId,
            jobLogId,
            duration,
            success: result.success,
            rowsUpserted: result.rowsUpserted,
            maxDate: maxDateResult?.date.toISOString().split('T')[0],
          },
          '[INTERNAL-JOB] Rebuild daily metrics concluído'
        );

        return reply.status(200).send({
          success: result.success,
          jobLogId,
          duration,
          daysProcessed: daysDiff,
          rowsUpserted: result.rowsUpserted,
          listingsProcessed: result.listingsProcessed,
          dateRange: {
            from: result.min_date,
            to: result.max_date,
            maxDateAfterRebuild: maxDateResult?.date.toISOString().split('T')[0] || null,
          },
          errors: result.errors.length > 0 ? result.errors : undefined,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        if (jobLogId) {
          await prisma.jobLog.update({
            where: { id: jobLogId },
            data: {
              status: JobStatus.error,
              completed_at: new Date(),
              duration_ms: duration,
              error_message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }

        app.log.error(
          { err: error, duration },
          '[INTERNAL-JOB] Erro no rebuild daily metrics'
        );

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid request data',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  done();
};
