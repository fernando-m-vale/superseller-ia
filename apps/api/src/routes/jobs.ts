import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const prisma = new PrismaClient();

const CreateJobLogSchema = z.object({
  jobType: z.enum(['shopee_sync', 'mercadolivre_sync', 'amazon_sync', 'magalu_sync', 'metrics_aggregation', 'data_quality_check']),
  status: z.enum(['success', 'error', 'running']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
  recordsProcessed: z.number().int().min(0).optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const jobsRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/jobs/status', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const { jobType, limit = 50 } = req.query as { jobType?: string; limit?: number };

      interface WhereClause {
        tenant_id: string;
        job_type?: 'shopee_sync' | 'mercadolivre_sync' | 'amazon_sync' | 'magalu_sync' | 'metrics_aggregation' | 'data_quality_check';
      }

      const where: WhereClause = { tenant_id: tenantId };

      if (jobType) {
        const validJobTypes = ['shopee_sync', 'mercadolivre_sync', 'amazon_sync', 'magalu_sync', 'metrics_aggregation', 'data_quality_check'];
        if (validJobTypes.includes(jobType)) {
          where.job_type = jobType as WhereClause['job_type'];
        }
      }

      const jobs = await prisma.jobLog.findMany({
        where,
        orderBy: { started_at: 'desc' },
        take: Number(limit),
      });

      const summary = await prisma.jobLog.groupBy({
        by: ['job_type', 'status'],
        where: { tenant_id: tenantId },
        _count: true,
        _avg: {
          duration_ms: true,
        },
      });

      const lastSuccessful = await prisma.jobLog.findMany({
        where: {
          tenant_id: tenantId,
          status: 'success',
        },
        orderBy: { completed_at: 'desc' },
        distinct: ['job_type'],
        take: 10,
      });

      return reply.send({
        jobs: jobs.map(j => ({
          id: j.id,
          jobType: j.job_type,
          status: j.status,
          startedAt: j.started_at,
          completedAt: j.completed_at,
          durationMs: j.duration_ms,
          recordsProcessed: j.records_processed,
          errorMessage: j.error_message,
          metadata: j.metadata,
          createdAt: j.created_at,
        })),
        summary: summary.map(s => ({
          jobType: s.job_type,
          status: s.status,
          count: s._count,
          avgDurationMs: s._avg.duration_ms,
        })),
        lastSuccessful: lastSuccessful.map(j => ({
          jobType: j.job_type,
          completedAt: j.completed_at,
          durationMs: j.duration_ms,
          recordsProcessed: j.records_processed,
        })),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/jobs/log', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const body = CreateJobLogSchema.parse(req.body);

      const jobLog = await prisma.jobLog.create({
        data: {
          tenant_id: tenantId,
          job_type: body.jobType,
          status: body.status,
          started_at: new Date(body.startedAt),
          completed_at: body.completedAt ? new Date(body.completedAt) : null,
          duration_ms: body.durationMs,
          records_processed: body.recordsProcessed,
          error_message: body.errorMessage,
          metadata: body.metadata ? (body.metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      app.log.info(
        { jobId: jobLog.id, jobType: jobLog.job_type, status: jobLog.status },
        'Job log created'
      );

      return reply.status(201).send({
        id: jobLog.id,
        jobType: jobLog.job_type,
        status: jobLog.status,
        startedAt: jobLog.started_at,
        completedAt: jobLog.completed_at,
        durationMs: jobLog.duration_ms,
        recordsProcessed: jobLog.records_processed,
        errorMessage: jobLog.error_message,
        metadata: jobLog.metadata,
        createdAt: jobLog.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request data', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/jobs/stats', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;

      const stats = await prisma.jobLog.groupBy({
        by: ['job_type'],
        where: { tenant_id: tenantId },
        _count: true,
        _avg: {
          duration_ms: true,
        },
        _max: {
          started_at: true,
        },
      });

      const recentErrors = await prisma.jobLog.findMany({
        where: {
          tenant_id: tenantId,
          status: 'error',
        },
        orderBy: { started_at: 'desc' },
        take: 10,
      });

      return reply.send({
        stats: stats.map(s => ({
          jobType: s.job_type,
          totalRuns: s._count,
          avgDurationMs: s._avg.duration_ms,
          lastRun: s._max.started_at,
        })),
        recentErrors: recentErrors.map(e => ({
          id: e.id,
          jobType: e.job_type,
          startedAt: e.started_at,
          errorMessage: e.error_message,
        })),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  done();
};
