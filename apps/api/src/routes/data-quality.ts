import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const prisma = new PrismaClient();

const CreateQualityCheckSchema = z.object({
  checkDate: z.string().datetime(),
  status: z.enum(['pass', 'warning', 'critical']),
  missingDays: z.number().int().min(0).default(0),
  outlierCount: z.number().int().min(0).default(0),
  totalListings: z.number().int().min(0),
  listingsChecked: z.number().int().min(0),
  issuesFound: z.record(z.unknown()).optional(),
});

async function performDataQualityCheck(tenantId: string): Promise<{
  status: 'pass' | 'warning' | 'critical';
  missingDays: number;
  outlierCount: number;
  totalListings: number;
  listingsChecked: number;
  issuesFound: Record<string, unknown>;
}> {
  const listings = await prisma.listing.findMany({
    where: { tenant_id: tenantId },
    include: {
      listing_metrics_daily: {
        orderBy: { date: 'desc' },
        take: 30,
      },
    },
  });

  const totalListings = listings.length;
  let listingsChecked = 0;
  let missingDays = 0;
  let outlierCount = 0;
  const issuesFound: Record<string, unknown> = {
    missingMetrics: [],
    outliers: [],
  };

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const listing of listings) {
    listingsChecked++;
    
    const metricsCount = listing.listing_metrics_daily.length;
    const expectedDays = 30;
    const missing = expectedDays - metricsCount;
    
    if (missing > 7) {
      missingDays += missing;
      (issuesFound.missingMetrics as Array<{ listingId: string; missing: number }>).push({
        listingId: listing.id,
        missing,
      });
    }

    for (const metric of listing.listing_metrics_daily) {
      const ctr = Number(metric.ctr);
      const conversion = metric.conversion ? Number(metric.conversion) : null;
      const gmv = Number(metric.gmv);

      if (ctr > 0.5 || (conversion !== null && conversion > 0.5) || gmv > 100000) {
        outlierCount++;
        const outlierMetric = ctr > 0.5 ? 'ctr' : (conversion !== null && conversion > 0.5) ? 'conversion' : 'gmv';
        (issuesFound.outliers as Array<{ listingId: string; date: Date; metric: string }>).push({
          listingId: listing.id,
          date: metric.date,
          metric: outlierMetric,
        });
      }
    }
  }

  let status: 'pass' | 'warning' | 'critical' = 'pass';
  if (missingDays > 50 || outlierCount > 20) {
    status = 'critical';
  } else if (missingDays > 20 || outlierCount > 10) {
    status = 'warning';
  }

  return {
    status,
    missingDays,
    outlierCount,
    totalListings,
    listingsChecked,
    issuesFound,
  };
}

export const dataQualityRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/data/quality', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const { startDate, endDate, limit = 30 } = req.query as { 
        startDate?: string; 
        endDate?: string; 
        limit?: number;
      };

      interface WhereClause {
        tenant_id: string;
        check_date?: {
          gte?: Date;
          lte?: Date;
        };
      }

      const where: WhereClause = { tenant_id: tenantId };

      if (startDate || endDate) {
        where.check_date = {};
        if (startDate) where.check_date.gte = new Date(startDate);
        if (endDate) where.check_date.lte = new Date(endDate);
      }

      const checks = await prisma.dataQualityCheck.findMany({
        where,
        orderBy: { check_date: 'desc' },
        take: Number(limit),
      });

      const latest = checks[0];

      const summary = await prisma.dataQualityCheck.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId },
        _count: true,
      });

      return reply.send({
        checks: checks.map(c => ({
          id: c.id,
          checkDate: c.check_date,
          status: c.status,
          missingDays: c.missing_days,
          outlierCount: c.outlier_count,
          totalListings: c.total_listings,
          listingsChecked: c.listings_checked,
          issuesFound: c.issues_found,
          createdAt: c.created_at,
        })),
        latest: latest ? {
          checkDate: latest.check_date,
          status: latest.status,
          missingDays: latest.missing_days,
          outlierCount: latest.outlier_count,
          totalListings: latest.total_listings,
          listingsChecked: latest.listings_checked,
        } : null,
        summary: summary.map(s => ({
          status: s.status,
          count: s._count,
        })),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/data/quality/check', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;

      const result = await performDataQualityCheck(tenantId);

      const check = await prisma.dataQualityCheck.create({
        data: {
          tenant_id: tenantId,
          check_date: new Date(),
          status: result.status,
          missing_days: result.missingDays,
          outlier_count: result.outlierCount,
          total_listings: result.totalListings,
          listings_checked: result.listingsChecked,
          issues_found: result.issuesFound as Prisma.InputJsonValue,
        },
      });

      app.log.info(
        { checkId: check.id, status: check.status, tenantId },
        'Data quality check completed'
      );

      return reply.status(201).send({
        id: check.id,
        checkDate: check.check_date,
        status: check.status,
        missingDays: check.missing_days,
        outlierCount: check.outlier_count,
        totalListings: check.total_listings,
        listingsChecked: check.listings_checked,
        issuesFound: check.issues_found,
        createdAt: check.created_at,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/data/quality/log', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const body = CreateQualityCheckSchema.parse(req.body);

      const check = await prisma.dataQualityCheck.create({
        data: {
          tenant_id: tenantId,
          check_date: new Date(body.checkDate),
          status: body.status,
          missing_days: body.missingDays,
          outlier_count: body.outlierCount,
          total_listings: body.totalListings,
          listings_checked: body.listingsChecked,
          issues_found: body.issuesFound ? (body.issuesFound as Prisma.InputJsonValue) : undefined,
        },
      });

      return reply.status(201).send({
        id: check.id,
        checkDate: check.check_date,
        status: check.status,
        missingDays: check.missing_days,
        outlierCount: check.outlier_count,
        totalListings: check.total_listings,
        listingsChecked: check.listings_checked,
        issuesFound: check.issues_found,
        createdAt: check.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request data', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  done();
};
