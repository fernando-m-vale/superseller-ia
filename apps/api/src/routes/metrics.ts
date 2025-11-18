import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { healthScore } from '@superseller/core';
import { MetricsSummaryQuerySchema } from '../schemas';

type ListingDailyMetric = any;


interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const prisma = new PrismaClient();

export const metricsRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/metrics/summary', async (req) => {
    const query = MetricsSummaryQuerySchema.parse(req.query);
    const tenantId = (req as RequestWithTenant).tenantId;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - query.days);
    cutoffDate.setHours(0, 0, 0, 0);

    const whereClause: {
      tenant_id: string;
      date: { gte: Date };
      listing?: { marketplace: 'shopee' | 'mercadolivre' };
    } = {
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

    const totalImpressions = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.impressions, 0);
    const totalClicks = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.clicks, 0);
    const totalVisits = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.visits, 0);
    const totalOrders = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.orders, 0);
    const totalRevenue = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + Number(m.gmv), 0);

    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCVR = totalVisits > 0 ? totalOrders / totalVisits : 0;

    const listingMetricsMap = new Map<string, ListingDailyMetric[]>();
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

    return {
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
    };
  });

  done();
};
