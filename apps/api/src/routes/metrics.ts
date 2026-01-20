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
  days: z.coerce.number().min(1).max(365).default(30),
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

      // Agregações (preço médio, health score médio, super seller score médio, estoque total)
      const aggregations = await prisma.listing.aggregate({
        where: whereClause,
        _avg: {
          price: true,
          health_score: true,
          super_seller_score: true,
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
        _avg: { price: true, health_score: true, super_seller_score: true },
      });

      const byMarketplace = marketplaceBreakdown.map((mp) => ({
        marketplace: mp.marketplace,
        count: mp._count.id,
        avgPrice: Number(mp._avg.price) || 0,
        avgHealthScore: mp._avg.health_score || 0,
        avgSuperSellerScore: mp._avg.super_seller_score || 0,
      }));

      // ============ DADOS DE VENDAS (período dinâmico baseado em query.days) ============
      // IMPORTANTE: Usar listing_metrics_daily que já tem série diária real
      const periodDays = query.days;
      
      // Calcular range de datas em UTC (dateFrom até dateTo inclusive)
      // Para periodDays=30, queremos 30 dias incluindo hoje: hoje-29 até hoje
      const dateToUtc = new Date();
      dateToUtc.setUTCHours(0, 0, 0, 0);
      
      const dateFromUtc = new Date(dateToUtc);
      dateFromUtc.setUTCDate(dateFromUtc.getUTCDate() - (periodDays - 1)); // Incluir hoje no range
      
      // Gerar array de dias do range (inclusive) em formato YYYY-MM-DD (UTC)
      const dayStrings: string[] = [];
      const currentDate = new Date(dateFromUtc);
      while (currentDate <= dateToUtc) {
        const dayStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD em UTC
        dayStrings.push(dayStr);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      app.log.info(`[METRICS] Buscando métricas para tenant ${tenantId}, período ${periodDays} dias, range: ${dayStrings[0]} até ${dayStrings[dayStrings.length - 1]}`);

      // Buscar métricas diárias do período (já agregadas por dia)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metricsWhereClause: any = {
        tenant_id: tenantId,
        date: {
          gte: dateFromUtc,
          lte: dateToUtc,
        },
        ...(query.marketplace ? {
          listing: { marketplace: query.marketplace },
        } : {}),
      };

      const dailyMetrics = await prisma.listingMetricsDaily.findMany({
        where: metricsWhereClause,
        select: {
          date: true,
          orders: true,
          gmv: true,
          visits: true,
        },
        orderBy: {
          date: 'asc',
        },
      });

      // Agregar métricas por dia (somar orders e gmv de todos os listings por dia)
      const metricsByDayMap = new Map<string, { orders: number; revenue: number; visits: number | null }>();
      
      for (const metric of dailyMetrics) {
        const dateStr = metric.date.toISOString().split('T')[0]; // YYYY-MM-DD em UTC
        const existing = metricsByDayMap.get(dateStr) || { orders: 0, revenue: 0, visits: null };
        
        existing.orders += metric.orders;
        existing.revenue += Number(metric.gmv);
        
        // Para visits: somar apenas valores não-null, manter null se todos forem null
        if (metric.visits !== null) {
          existing.visits = (existing.visits ?? 0) + metric.visits;
        }
        
        metricsByDayMap.set(dateStr, existing);
      }

      // Calcular totais do período
      const totalOrders = Array.from(metricsByDayMap.values()).reduce((sum, m) => sum + m.orders, 0);
      const totalRevenue = Array.from(metricsByDayMap.values()).reduce((sum, m) => sum + m.revenue, 0);
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Montar série completa com todos os dias do range (preencher dias sem vendas)
      const combinedSeries = dayStrings.map((dayStr) => {
        const dayMetrics = metricsByDayMap.get(dayStr);
        return {
          date: dayStr,
          revenue: dayMetrics?.revenue ?? 0,
          orders: dayMetrics?.orders ?? 0,
          visits: dayMetrics?.visits ?? null, // null quando não há visitas disponíveis
        };
      });

      // Contar dias com visitas vs total de dias no período
      const totalDaysInPeriod = periodDays; // Deve ser exatamente periodDays
      const filledDays = Array.from(metricsByDayMap.values()).filter(m => m.visits !== null).length;

      // Top 3 produtos por receita (período dinâmico)
      // Usar dados de listing_metrics_daily para consistência
      const topListingsMetrics = await prisma.listingMetricsDaily.groupBy({
        by: ['listing_id'],
        where: {
          tenant_id: tenantId,
          date: {
            gte: dateFromUtc,
            lte: dateToUtc,
          },
          ...(query.marketplace ? {
            listing: { marketplace: query.marketplace },
          } : {}),
        },
        _sum: {
          gmv: true,
          orders: true,
        },
        orderBy: {
          _sum: {
            gmv: 'desc',
          },
        },
        take: 3,
      });

      // Buscar detalhes dos listings
      const topListingsWithDetails = await Promise.all(
        topListingsMetrics.map(async (item) => {
          const listing = await prisma.listing.findUnique({
            where: {
              id: item.listing_id,
            },
            select: {
              id: true,
              title: true,
              listing_id_ext: true,
            },
          });

          return {
            title: listing?.title || 'Produto desconhecido',
            revenue: Number(item._sum.gmv) || 0,
            orders: Number(item._sum.orders) || 0,
          };
        })
      );

      app.log.info(`[METRICS] Retornando: totalOrders=${totalOrders}, totalRevenue=${totalRevenue}, salesSeries.length=${combinedSeries.length}, periodDays=${periodDays}`);

      return reply.send({
        // Listings data
        totalListings,
        activeListings,
        pausedListings,
        averagePrice: Number(aggregations._avg.price) || 0,
        averageHealthScore: aggregations._avg.health_score || 0,
        averageSuperSellerScore: Math.round(aggregations._avg.super_seller_score || 0),
        totalStock: aggregations._sum.stock || 0,
        byMarketplace,
        // Sales data (período dinâmico)
        periodDays,
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageTicket: Math.round(averageTicket * 100) / 100,
        salesSeries: combinedSeries,
        visitsByDay: combinedSeries.map(day => ({
          date: day.date,
          visits: day.visits,
        })),
        visitsCoverage: {
          filledDays,
          totalDays: totalDaysInPeriod,
        },
        // Top products
        topListings: topListingsWithDetails,
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
        averageSuperSellerScore: 0,
        totalStock: 0,
        byMarketplace: [],
        // Sales data
        periodDays: 30,
        totalOrders: 0,
        topListings: [],
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

      // Calcular totais (tratando visits null como 0)
      const totalVisits = metrics.reduce((sum, m) => sum + (m.visits ?? 0), 0);
      const totalOrders = metrics.reduce((sum, m) => sum + m.orders, 0);
      const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.gmv), 0);

      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const conversionRate = totalVisits > 0 ? (totalOrders / totalVisits) * 100 : 0;

      // Agrupar métricas por data para série temporal
      const seriesMap = new Map<string, {
        date: string;
        revenue: number;
        orders: number;
        visits: number; // Tratar null como 0 para série temporal
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
        existing.visits += metric.visits ?? 0;

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

      const totalImpressions = metrics.reduce((sum, m) => sum + (m.impressions ?? 0), 0);
      const totalClicks = metrics.reduce((sum, m) => sum + (m.clicks ?? 0), 0);
      const totalVisits = metrics.reduce((sum, m) => sum + (m.visits ?? 0), 0);
      const totalOrders = metrics.reduce((sum, m) => sum + m.orders, 0);
      const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.gmv), 0);

    const avgCTR = totalImpressions > 0 && totalClicks !== null ? totalClicks / totalImpressions : null;
    const avgCVR = totalVisits > 0 ? totalOrders / totalVisits : 0;

      // Calcular health score por listing
      type ListingMetric = {
        date: string;
        impressions: number; // healthScore espera number, usar 0 quando null
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
        impressions: metric.impressions ?? 0, // healthScore espera number, usar 0 quando null
        visits: metric.visits ?? 0, // Tratar null como 0 para exibição
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
      avgCTR: avgCTR !== null ? Math.round(avgCTR * 10000) / 10000 : null,
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
