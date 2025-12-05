import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { healthScore } from '@superseller/core';
import { z } from 'zod';

interface RequestWithTenant extends FastifyRequest {
  tenantId?: string;
}

const prisma = new PrismaClient();

// Schema para query params
const SummaryQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(7),
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
});

export const metricsRoutes: FastifyPluginCallback = (app, _, done) => {
  
  // GET /api/v1/metrics/summary?days=7
  // Retorna resumo de métricas para o Dashboard
  app.get('/summary', async (req, reply) => {
    try {
      const query = SummaryQuerySchema.parse(req.query);
      const tenantId = (req as RequestWithTenant).tenantId;

      // Se não tem tenantId (não autenticado), retorna mock vazio
      if (!tenantId) {
        return reply.send({
          totalRevenue: 0,
          totalOrders: 0,
          averageTicket: 0,
          totalVisits: 0,
          conversionRate: 0,
          series: [],
        });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - query.days);
      cutoffDate.setHours(0, 0, 0, 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = {
        tenant_id: tenantId,
        date: { gte: cutoffDate },
      };

      if (query.marketplace) {
        whereClause.listing = { marketplace: query.marketplace };
      }

      const metrics = await prisma.listingMetricsDaily.findMany({
        where: whereClause,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              marketplace: true,
            },
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      // Se não há métricas, retorna mock vazio
      if (metrics.length === 0) {
        return reply.send({
          totalRevenue: 0,
          totalOrders: 0,
          averageTicket: 0,
          totalVisits: 0,
          conversionRate: 0,
          series: [],
        });
      }

      // Calcular totais
      const totalVisits = metrics.reduce((sum, m) => sum + m.visits, 0);
      const totalOrders = metrics.reduce((sum, m) => sum + m.orders, 0);
      const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.gmv), 0);

      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const conversionRate = totalVisits > 0 ? (totalOrders / totalVisits) * 100 : 0;

      // Agrupar métricas por data para série temporal
      const seriesMap = new Map<string, {
        date: string;
        revenue: number;
        orders: number;
        visits: number;
      }>();

      for (const metric of metrics) {
        const dateStr = metric.date.toISOString().split('T')[0];
        const existing = seriesMap.get(dateStr) || {
          date: dateStr,
          revenue: 0,
          orders: 0,
          visits: 0,
        };

        existing.revenue += Number(metric.gmv);
        existing.orders += metric.orders;
        existing.visits += metric.visits;

        seriesMap.set(dateStr, existing);
      }

      const series = Array.from(seriesMap.values()).sort((a, b) => 
        a.date.localeCompare(b.date)
      );

      return reply.send({
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        averageTicket: Math.round(averageTicket * 100) / 100,
        totalVisits,
        conversionRate: Math.round(conversionRate * 100) / 100,
        series,
      });
    } catch (error) {
      app.log.error(error);
      
      // Em caso de erro, retorna mock vazio para não quebrar o frontend
      return reply.send({
        totalRevenue: 0,
        totalOrders: 0,
        averageTicket: 0,
        totalVisits: 0,
        conversionRate: 0,
        series: [],
      });
    }
  });

  // GET /api/v1/metrics/detailed (rota existente renomeada)
  app.get('/detailed', async (req, reply) => {
    try {
      const query = SummaryQuerySchema.parse(req.query);
      const tenantId = (req as RequestWithTenant).tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - query.days);
      cutoffDate.setHours(0, 0, 0, 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = {
        tenant_id: tenantId,
        date: { gte: cutoffDate },
      };

      if (query.marketplace) {
        whereClause.listing = { marketplace: query.marketplace };
      }

      const metrics = await prisma.listingMetricsDaily.findMany({
        where: whereClause,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              marketplace: true,
            },
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
      const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
      const totalVisits = metrics.reduce((sum, m) => sum + m.visits, 0);
      const totalOrders = metrics.reduce((sum, m) => sum + m.orders, 0);
      const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.gmv), 0);

      const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
      const avgCVR = totalVisits > 0 ? totalOrders / totalVisits : 0;

      // Calcular health score por listing
      type ListingMetric = {
        date: string;
        impressions: number;
        visits: number;
        orders: number;
        revenue: number;
      };

      const listingMetricsMap = new Map<string, ListingMetric[]>();
      const listingInfoMap = new Map<string, { id: string; title: string }>();

      for (const metric of metrics) {
        if (!listingMetricsMap.has(metric.listing_id)) {
          listingMetricsMap.set(metric.listing_id, []);
          listingInfoMap.set(metric.listing_id, {
            id: metric.listing.id,
            title: metric.listing.title,
          });
        }

        listingMetricsMap.get(metric.listing_id)!.push({
          date: metric.date.toISOString().split('T')[0],
          impressions: metric.impressions,
          visits: metric.visits,
          orders: metric.orders,
          revenue: Number(metric.gmv),
        });
      }

      let bestListing: { id: string; title: string; healthScore: number } | null = null;
      let maxHealthScore = -1;

      for (const [listingId, listingMetrics] of listingMetricsMap.entries()) {
        const score = healthScore(listingMetrics, { windowDays: query.days });
        
        if (score !== null && score > maxHealthScore) {
          maxHealthScore = score;
          const info = listingInfoMap.get(listingId)!;
          bestListing = {
            id: info.id,
            title: info.title,
            healthScore: score,
          };
        }
      }

      return reply.send({
        tenantId,
        periodDays: query.days,
        totalImpressions,
        totalVisits,
        totalOrders,
        totalRevenue,
        avgCTR: Math.round(avgCTR * 10000) / 10000,
        avgCVR: Math.round(avgCVR * 10000) / 10000,
        bestListing,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch metrics' });
    }
  });

  done();
};
