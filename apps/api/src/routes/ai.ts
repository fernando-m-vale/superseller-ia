import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { recommendActions } from '@superseller/ai';
import Redis from 'ioredis';
import { z } from 'zod';

type ListingDailyMetric = any;

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const AIRecommendationsQuerySchema = z.object({
  marketplace: z.enum(['shopee', 'mercadolivre', 'amazon', 'magalu']).optional(),
  days: z.coerce.number().int().min(1).max(90).default(7),
});

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (err) {
  console.warn('Prisma client initialization failed:', err);
  prisma = null;
}

let redis: Redis | null = null;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
  });
  
  redis.on('error', (err) => {
    console.warn('Redis connection error:', err.message);
  });
} catch (err) {
  console.warn('Redis not available, caching disabled:', err);
  redis = null;
}

export const aiRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/ai/recommendations', async (req, reply) => {
    const startTime = Date.now();
    const tenantId = (req as RequestWithTenant).tenantId;
    
    try {
      const query = AIRecommendationsQuerySchema.parse(req.query);
      const { marketplace, days } = query;
      
      const cacheKey = `ai:recommendations:${tenantId}:${marketplace || 'all'}:${days}`;
      
      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const inferenceTime = Date.now() - startTime;
            app.log.info({
              tenantId,
              marketplace,
              days,
              inferenceTime,
              cached: true,
            }, 'AI recommendations served from cache');
            
            return JSON.parse(cached);
          }
        } catch (cacheErr) {
          app.log.warn({ error: cacheErr }, 'Cache read error, proceeding without cache');
        }
      }
      
      if (!prisma) {
        app.log.warn('Prisma client not available, returning empty recommendations');
        return {
          tenantId,
          generatedAt: new Date().toISOString(),
          items: [],
          modelVersion: 'v1.0',
          inferenceTime: Date.now() - startTime,
        };
      }

      const metricsData = await prisma.listingMetricsDaily.findMany({
        where: {
          tenant_id: tenantId,
          ...(marketplace && {
            listing: {
              marketplace: marketplace,
            },
          }),
        },
        include: {
          listing: {
            select: {
              id: true,
              marketplace: true,
              title: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        take: 1000,
      });
      
      const metrics: ListingDailyMetric[] = metricsData.map((m) => ({
        console.log("[AI] has OPENAI_API_KEY?", !!process.env.OPENAI_API_KEY),
        listingId: m.listing_id,
        date: m.date.toISOString().split('T')[0],
        impressions: m.impressions,
        clicks: m.clicks,
        ctr: parseFloat(m.ctr.toString()),
        visits: m.visits,
        conversion: parseFloat(m.conversion.toString()),
        orders: m.orders,
        gmv: parseFloat(m.gmv.toString()),
      }));
      
      const actions = recommendActions({
        metrics,
        windowDays: days,
        minDays: 3,
      });
      
      const inferenceTime = Date.now() - startTime;
      
      const response = {
        tenantId,
        generatedAt: new Date().toISOString(),
        items: actions,
        modelVersion: 'v1.0',
        inferenceTime,
      };
      
      if (redis && actions.length > 0) {
        try {
          await redis.setex(cacheKey, 300, JSON.stringify(response));
        } catch (cacheErr) {
          app.log.warn({ error: cacheErr }, 'Cache write error');
        }
      }
      
      app.log.info({
        tenantId,
        marketplace,
        days,
        inferenceTime,
        recommendationsCount: actions.length,
        cached: false,
      }, 'AI recommendations generated');
      
      return response;
    } catch (error) {
      app.log.error({
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Error generating AI recommendations');
      
      reply.code(500).send({
        error: 'Failed to generate recommendations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
  
  done();
};
