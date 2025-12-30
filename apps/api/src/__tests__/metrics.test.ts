import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Metrics Summary Logic', () => {
  beforeAll(async () => {
    const tenantCount = await prisma.tenant.count();
    if (tenantCount === 0) {
      throw new Error('Database must be seeded before running tests. Run: pnpm --filter api db:seed');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should aggregate metrics for demo-tenant over 7 days', async () => {
    const tenantId = 'demo-tenant';
    const days = 7;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const metrics = await prisma.listingMetricsDaily.findMany({
      where: {
        tenant_id: tenantId,
        date: { gte: cutoffDate },
      },
    });

    expect(metrics.length).toBeGreaterThan(0);

    const totalImpressions = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.impressions, 0);
    const totalVisits = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + (m.visits ?? 0), 0);
    const totalOrders = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.orders, 0);
    const totalRevenue = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + Number(m.gmv), 0);

    expect(totalImpressions).toBeGreaterThan(0);
    expect(totalVisits).toBeGreaterThan(0);
    expect(totalOrders).toBeGreaterThan(0);
    expect(totalRevenue).toBeGreaterThan(0);
  });

  it('should calculate correct CTR and CVR averages', async () => {
    const tenantId = 'demo-tenant';
    const days = 7;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const metrics = await prisma.listingMetricsDaily.findMany({
      where: {
        tenant_id: tenantId,
        date: { gte: cutoffDate },
      },
    });

    const totalImpressions = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.impressions, 0);
    const totalClicks = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.clicks, 0);
    const totalVisits = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + (m.visits ?? 0), 0);
    const totalOrders = metrics.reduce((sum: number, m: typeof metrics[0]) => sum + m.orders, 0);

    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCVR = totalVisits > 0 ? totalOrders / totalVisits : 0;

    expect(avgCTR).toBeGreaterThan(0);
    expect(avgCTR).toBeLessThanOrEqual(1);
    expect(avgCVR).toBeGreaterThan(0);
    expect(avgCVR).toBeLessThanOrEqual(1);
  });

  it('should filter metrics by marketplace when specified', async () => {
    const tenantId = 'demo-tenant';
    const days = 7;
    const marketplace = 'shopee';
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const metrics = await prisma.listingMetricsDaily.findMany({
      where: {
        tenant_id: tenantId,
        date: { gte: cutoffDate },
        listing: { marketplace },
      },
      include: {
        listing: true,
      },
    });

    expect(metrics.length).toBeGreaterThan(0);
    
    for (const metric of metrics) {
      expect(metric.listing.marketplace).toBe(marketplace);
    }
  });

  it('should group metrics by listing correctly', async () => {
    const tenantId = 'demo-tenant';
    const days = 7;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const metrics = await prisma.listingMetricsDaily.findMany({
      where: {
        tenant_id: tenantId,
        date: { gte: cutoffDate },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const listingMetricsMap = new Map<string, typeof metrics>();

    for (const metric of metrics) {
      if (!listingMetricsMap.has(metric.listing_id)) {
        listingMetricsMap.set(metric.listing_id, []);
      }
      listingMetricsMap.get(metric.listing_id)!.push(metric);
    }

    expect(listingMetricsMap.size).toBeGreaterThan(0);
    
    for (const [, listingMetrics] of listingMetricsMap.entries()) {
      expect(listingMetrics.length).toBeGreaterThan(0);
      expect(listingMetrics.length).toBeLessThanOrEqual(days);
    }
  });

  it('should return metrics ordered by date ascending', async () => {
    const tenantId = 'demo-tenant';
    const days = 7;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const metrics = await prisma.listingMetricsDaily.findMany({
      where: {
        tenant_id: tenantId,
        date: { gte: cutoffDate },
      },
      orderBy: {
        date: 'asc',
      },
    });

    for (let i = 1; i < metrics.length; i++) {
      const prevDate = new Date(metrics[i - 1].date);
      const currDate = new Date(metrics[i].date);
      expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
    }
  });
});
