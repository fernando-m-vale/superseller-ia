import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const prisma = new PrismaClient();

const CreateMetricSchema = z.object({
  modelVersion: z.string().default('v1.1'),
  mae: z.number().min(0),
  rmse: z.number().min(0),
  rSquared: z.number().min(-1).max(1),
  trainingDate: z.string().datetime(),
  samplesCount: z.number().int().min(0),
  featuresUsed: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
});

export const aiMetricsRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/ai/metrics', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const { modelVersion, limit = 10 } = req.query as { 
        modelVersion?: string; 
        limit?: number;
      };

      interface WhereClause {
        tenant_id: string;
        model_version?: string;
      }

      const where: WhereClause = { tenant_id: tenantId };
      if (modelVersion) {
        where.model_version = modelVersion;
      }

      const metrics = await prisma.aiModelMetric.findMany({
        where,
        orderBy: { training_date: 'desc' },
        take: Number(limit),
      });

      const latest = metrics[0];

      const avgMetrics = await prisma.aiModelMetric.aggregate({
        where: { tenant_id: tenantId },
        _avg: {
          mae: true,
          rmse: true,
          r_squared: true,
        },
        _count: true,
      });

      return reply.send({
        metrics: metrics.map(m => ({
          id: m.id,
          modelVersion: m.model_version,
          mae: Number(m.mae),
          rmse: Number(m.rmse),
          rSquared: Number(m.r_squared),
          trainingDate: m.training_date,
          samplesCount: m.samples_count,
          featuresUsed: m.features_used,
          metadata: m.metadata,
          createdAt: m.created_at,
        })),
        latest: latest ? {
          modelVersion: latest.model_version,
          mae: Number(latest.mae),
          rmse: Number(latest.rmse),
          rSquared: Number(latest.r_squared),
          trainingDate: latest.training_date,
          samplesCount: latest.samples_count,
        } : null,
        summary: {
          totalModels: avgMetrics._count,
          avgMae: avgMetrics._avg.mae ? Number(avgMetrics._avg.mae) : null,
          avgRmse: avgMetrics._avg.rmse ? Number(avgMetrics._avg.rmse) : null,
          avgRSquared: avgMetrics._avg.r_squared ? Number(avgMetrics._avg.r_squared) : null,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/ai/metrics', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const body = CreateMetricSchema.parse(req.body);

      const metric = await prisma.aiModelMetric.create({
        data: {
          tenant_id: tenantId,
          model_version: body.modelVersion,
          mae: body.mae,
          rmse: body.rmse,
          r_squared: body.rSquared,
          training_date: new Date(body.trainingDate),
          samples_count: body.samplesCount,
          features_used: body.featuresUsed,
          metadata: body.metadata ? (body.metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      app.log.info(
        { metricId: metric.id, modelVersion: metric.model_version, tenantId },
        'AI model metric recorded'
      );

      return reply.status(201).send({
        id: metric.id,
        modelVersion: metric.model_version,
        mae: Number(metric.mae),
        rmse: Number(metric.rmse),
        rSquared: Number(metric.r_squared),
        trainingDate: metric.training_date,
        samplesCount: metric.samples_count,
        featuresUsed: metric.features_used,
        metadata: metric.metadata,
        createdAt: metric.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request data', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/ai/health', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;

      const latestMetric = await prisma.aiModelMetric.findFirst({
        where: { tenant_id: tenantId },
        orderBy: { training_date: 'desc' },
      });

      if (!latestMetric) {
        return reply.send({
          status: 'no_data',
          message: 'No AI model metrics available',
          health: null,
        });
      }

      const mae = Number(latestMetric.mae);
      const rmse = Number(latestMetric.rmse);
      const rSquared = Number(latestMetric.r_squared);

      let healthStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      let healthScore = 0;

      if (rSquared >= 0.8 && mae < 0.1 && rmse < 0.15) {
        healthStatus = 'excellent';
        healthScore = 95;
      } else if (rSquared >= 0.6 && mae < 0.2 && rmse < 0.25) {
        healthStatus = 'good';
        healthScore = 75;
      } else if (rSquared >= 0.4 && mae < 0.3 && rmse < 0.35) {
        healthStatus = 'fair';
        healthScore = 55;
      } else {
        healthStatus = 'poor';
        healthScore = 30;
      }

      const daysSinceTraining = Math.floor(
        (Date.now() - latestMetric.training_date.getTime()) / (1000 * 60 * 60 * 24)
      );

      return reply.send({
        status: healthStatus,
        score: healthScore,
        modelVersion: latestMetric.model_version,
        metrics: {
          mae,
          rmse,
          rSquared,
        },
        trainingDate: latestMetric.training_date,
        daysSinceTraining,
        samplesCount: latestMetric.samples_count,
        recommendations: daysSinceTraining > 30 
          ? ['Consider retraining the model with recent data']
          : healthStatus === 'poor'
          ? ['Model performance is below optimal', 'Review training data quality']
          : [],
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  done();
};
