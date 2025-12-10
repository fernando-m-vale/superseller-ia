import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { PrismaClient, ListingStatus, Marketplace, OrderStatus } from '@prisma/client';
import { healthScore } from '@superseller/core';
import { z } from 'zod';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

// Schema para query params
const SummaryQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(7),
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
});

const OverviewQuerySchema = z.object({
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
});

const SalesQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
});

export const metricsRoutes: FastifyPluginCallback = (app, _, done) => {

  // GET /api/v1/metrics/overview
  // Retorna dados reais de Listings para o Dashboard principal
  app.get('/overview', { preHandler: authGuard }, async (req, reply) => {
    try {
      const query = OverviewQuerySchema.parse(req.query);
      const tenantId = req.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = { tenant_id: tenantId };
      if (query.marketplace) {
        whereClause.marketplace = query.marketplace;
      }

      // Total de listings
      const totalListings = await prisma.listing.count({ where: whereClause });

      // Listings ativos
      const activeListings = await prisma.listing.count({
        where: { ...whereClause, status: ListingStatus.active },
      });

      // Listings pausados
      const pausedListings = await prisma.listing.count({
        where: { ...whereClause, status: ListingStatus.paused },
      });

      // Agregações (preço médio, health score médio, estoque total)
      const aggregations = await prisma.listing.aggregate({
        where: whereClause,
        _avg: {
          price: true,
          health_score: true,
        },
        _sum: {
          stock: true,
        },
      });

      // Breakdown por marketplace
      const marketplaceBreakdown = await prisma.listing.groupBy({
        by: ['marketplace'],
        where: { tenant_id: tenantId },
        _count: { id: true },
        _avg: { price: true, health_score: true },
      });

      const byMarketplace = marketplaceBreakdown.map((mp) => ({
        marketplace: mp.marketplace,
        count: mp._count.id,
        avgPrice: Number(mp._avg.price) || 0,
        avgHealthScore: mp._avg.health_score || 0,
      }));

      // ============ DADOS DE VENDAS (últimos 30 dias) ============
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ordersWhereClause: any = {
        tenant_id: tenantId,
        order_date: { gte: thirtyDaysAgo },
        status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
      };

      if (query.marketplace) {
        ordersWhereClause.marketplace = query.marketplace;
      }

      // Total de pedidos pagos
      const totalOrders = await prisma.order.count({ where: ordersWhereClause });

      // GMV (receita total)
      const revenueResult = await prisma.order.aggregate({
        where: ordersWhereClause,
        _sum: {
          total_amount: true,
        },
      });

      const totalRevenue = Number(revenueResult._sum.total_amount) || 0;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Série temporal para gráfico (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentOrders = await prisma.order.findMany({
        where: {
          ...ordersWhereClause,
          order_date: { gte: sevenDaysAgo },
        },
        select: {
          order_date: true,
          total_amount: true,
        },
        orderBy: { order_date: 'asc' },
      });

      // Agrupar por dia
      const salesSeriesMap = new Map<string, { date: string; revenue: number; orders: number }>();
      
      for (const order of recentOrders) {
        const dateStr = order.order_date.toISOString().split('T')[0];
        const existing = salesSeriesMap.get(dateStr) || { date: dateStr, revenue: 0, orders: 0 };
        existing.revenue += Number(order.total_amount);
        existing.orders += 1;
        salesSeriesMap.set(dateStr, existing);
      }

      const salesSeries = Array.from(salesSeriesMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      return reply.send({
        // Listings data
        totalListings,
        activeListings,
        pausedListings,
        averagePrice: Number(aggregations._avg.price) || 0,
        averageHealthScore: aggregations._avg.health_score || 0,
        totalStock: aggregations._sum.stock || 0,
        byMarketplace,
        // Sales data (últimos 30 dias)
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageTicket: Math.round(averageTicket * 100) / 100,
        salesSeries,
      });
    } catch (error) {
      app.log.error(error);
      return reply.send({
        // Listings data
        totalListings: 0,
        activeListings: 0,
        pausedListings: 0,
        averagePrice: 0,
        averageHealthScore: 0,
        totalStock: 0,
        byMarketplace: [],
        // Sales data
        totalOrders: 0,
        totalRevenue: 0,
        averageTicket: 0,
        salesSeries: [],
      });
    }
  });
  
  // GET /api/v1/metrics/summary?days=7
  // Retorna resumo de métricas para o Dashboard
  app.get('/summary', { preHandler: authGuard }, async (req, reply) => {
    try {
      const query = SummaryQuerySchema.parse(req.query);
      const tenantId = req.tenantId;

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

  // GET /api/v1/metrics/sales
  // Retorna métricas de vendas baseadas em pedidos reais
  app.get('/sales', { preHandler: authGuard }, async (req, reply) => {
    try {
      const query = SalesQuerySchema.parse(req.query);
      const tenantId = req.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - query.days);
      cutoffDate.setHours(0, 0, 0, 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = {
        tenant_id: tenantId,
        order_date: { gte: cutoffDate },
      };

      if (query.marketplace) {
        whereClause.marketplace = query.marketplace;
      }

      // Total de pedidos
      const totalOrders = await prisma.order.count({ where: whereClause });

      // Pedidos pagos (faturamento real)
      const paidOrders = await prisma.order.count({
        where: {
          ...whereClause,
          status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
        },
      });

      // GMV (Gross Merchandise Value) - soma de todos os pedidos pagos
      const gmvResult = await prisma.order.aggregate({
        where: {
          ...whereClause,
          status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
        },
        _sum: {
          total_amount: true,
        },
      });

      const totalRevenue = Number(gmvResult._sum.total_amount) || 0;
      const averageTicket = paidOrders > 0 ? totalRevenue / paidOrders : 0;

      // Pedidos cancelados
      const cancelledOrders = await prisma.order.count({
        where: {
          ...whereClause,
          status: OrderStatus.cancelled,
        },
      });

      // Taxa de cancelamento
      const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

      // Série temporal de vendas (agrupado por dia)
      const orders = await prisma.order.findMany({
        where: {
          ...whereClause,
          status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
        },
        select: {
          order_date: true,
          total_amount: true,
        },
        orderBy: {
          order_date: 'asc',
        },
      });

      // Agrupar por data
      const seriesMap = new Map<string, { date: string; revenue: number; orders: number }>();

      for (const order of orders) {
        const dateStr = order.order_date.toISOString().split('T')[0];
        const existing = seriesMap.get(dateStr) || { date: dateStr, revenue: 0, orders: 0 };
        existing.revenue += Number(order.total_amount);
        existing.orders += 1;
        seriesMap.set(dateStr, existing);
      }

      const series = Array.from(seriesMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      return reply.send({
        totalOrders,
        paidOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageTicket: Math.round(averageTicket * 100) / 100,
        cancelledOrders,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        periodDays: query.days,
        series,
      });
    } catch (error) {
      app.log.error(error);
      return reply.send({
        totalOrders: 0,
        paidOrders: 0,
        totalRevenue: 0,
        averageTicket: 0,
        cancelledOrders: 0,
        cancellationRate: 0,
        periodDays: 30,
        series: [],
      });
    }
  });

  // GET /api/v1/metrics/detailed (rota existente renomeada)
  app.get('/detailed', { preHandler: authGuard }, async (req, reply) => {
    try {
      const query = SummaryQuerySchema.parse(req.query);
      const tenantId = req.tenantId;

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
