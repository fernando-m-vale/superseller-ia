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
      // IMPORTANTE: Usar o mesmo período para totais E gráfico para consistência
      const periodDays = query.days;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - periodDays);
      cutoffDate.setHours(0, 0, 0, 0);

      app.log.info(`[METRICS] Buscando pedidos para tenant ${tenantId}, período ${periodDays} dias, desde ${cutoffDate.toISOString()}`);

      // Primeiro, contar TODOS os pedidos do tenant (sem filtro de status) para debug
      const totalOrdersInDb = await prisma.order.count({
        where: { tenant_id: tenantId },
      });
      app.log.info(`[METRICS] Total de pedidos no banco para este tenant: ${totalOrdersInDb}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ordersWhereClause: any = {
        tenant_id: tenantId,
        order_date: { gte: cutoffDate },
        // GMV inclui pedidos pagos, enviados e entregues
        status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
      };

      if (query.marketplace) {
        ordersWhereClause.marketplace = query.marketplace;
      }

      // Buscar todos os pedidos do período para totais E série
      const allOrders = await prisma.order.findMany({
        where: ordersWhereClause,
        select: {
          order_date: true,
          total_amount: true,
          status: true,
        },
        orderBy: { order_date: 'asc' },
      });

      app.log.info(`[METRICS] Pedidos encontrados com filtro de status (paid/shipped/delivered): ${allOrders.length}`);

      // Se não encontrou com filtro de status, buscar sem filtro para debug
      if (allOrders.length === 0 && totalOrdersInDb > 0) {
        const ordersWithoutStatusFilter = await prisma.order.findMany({
          where: {
            tenant_id: tenantId,
            order_date: { gte: cutoffDate },
          },
          select: {
            status: true,
            order_date: true,
            total_amount: true,
          },
          take: 10,
        });
        app.log.info(`[METRICS] Amostra de pedidos sem filtro de status: ${JSON.stringify(ordersWithoutStatusFilter.map(o => ({ status: o.status, date: o.order_date, amount: o.total_amount })))}`);
      }

      // Calcular totais a partir dos mesmos dados da série (consistência)
      const totalOrders = allOrders.length;
      const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Agrupar por dia para série temporal
      const salesSeriesMap = new Map<string, { date: string; revenue: number; orders: number }>();
      
      for (const order of allOrders) {
        const dateStr = order.order_date.toISOString().split('T')[0];
        const existing = salesSeriesMap.get(dateStr) || { date: dateStr, revenue: 0, orders: 0 };
        existing.revenue += Number(order.total_amount);
        existing.orders += 1;
        salesSeriesMap.set(dateStr, existing);
      }

      const salesSeries = Array.from(salesSeriesMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      // Buscar visitas agregadas por dia (ignorar NULL na soma)
      const visitsByDay = await prisma.listingMetricsDaily.groupBy({
        by: ['date'],
        where: {
          tenant_id: tenantId,
          date: { gte: cutoffDate },
          visits: { not: null }, // Ignorar NULL na agregação
          ...(query.marketplace ? {
            listing: { marketplace: query.marketplace },
          } : {}),
        },
        _sum: {
          visits: true,
        },
        orderBy: {
          date: 'asc',
        },
      });

      // Criar mapa de visitas por dia (YYYY-MM-DD) -> soma(visits)
      const visitsMap = new Map<string, number>();
      for (const dayData of visitsByDay) {
        const dateStr = dayData.date.toISOString().split('T')[0];
        visitsMap.set(dateStr, Number(dayData._sum.visits) || 0);
      }

      // Contar dias com visitas vs total de dias no período
      const totalDaysInPeriod = periodDays;
      const filledDays = visitsByDay.length;

      // Combinar salesSeries com visits (adicionar visits a cada dia)
      const combinedSeries = salesSeries.map((day) => ({
        ...day,
        visits: visitsMap.get(day.date) ?? null, // null quando não há visitas disponíveis
      }));

      // Adicionar dias que têm visitas mas não têm vendas
      for (const [dateStr, visits] of visitsMap.entries()) {
        if (!salesSeries.find(s => s.date === dateStr)) {
          combinedSeries.push({
            date: dateStr,
            revenue: 0,
            orders: 0,
            visits: visits,
          });
        }
      }

      // Ordenar por data
      combinedSeries.sort((a, b) => a.date.localeCompare(b.date));

      // Top 3 produtos por receita (últimos 30 dias)
      const topListings = await prisma.orderItem.groupBy({
        by: ['listing_id_ext'],
        where: {
          order: {
            tenant_id: tenantId,
            order_date: { gte: cutoffDate },
            status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
          },
        },
        _sum: {
          total_price: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            total_price: 'desc',
          },
        },
        take: 3,
      });

      // Buscar detalhes dos listings
      const topListingsWithDetails = await Promise.all(
        topListings.map(async (item) => {
          const listing = await prisma.listing.findFirst({
            where: {
              tenant_id: tenantId,
              listing_id_ext: item.listing_id_ext,
            },
            select: {
              id: true,
              title: true,
              listing_id_ext: true,
            },
          });

          return {
            title: listing?.title || 'Produto desconhecido',
            revenue: Number(item._sum.total_price) || 0,
            orders: item._count.id,
          };
        })
      );

      app.log.info(`[METRICS] Retornando: totalOrders=${totalOrders}, totalRevenue=${totalRevenue}, salesSeries.length=${salesSeries.length}`);

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
