import type { FastifyInstance } from 'fastify';
import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import { getJobQueue } from './jobQueueFactory';
import type { JobType } from './JobQueue';

const prisma = new PrismaClient();

type ScheduledJobConfig = {
  type: JobType;
  intervalMs: number;
  lockKeyPrefix: string;
  payload: Record<string, unknown>;
};

const DEFAULT_SCHEDULES: ScheduledJobConfig[] = [
  {
    type: 'SYNC_VISITS',
    intervalMs: 6 * 60 * 60 * 1000,
    lockKeyPrefix: 'tenant-sync-visits',
    payload: { periodDays: 30 },
  },
  {
    type: 'SYNC_ORDERS',
    intervalMs: 6 * 60 * 60 * 1000,
    lockKeyPrefix: 'tenant-sync-orders',
    payload: { daysBack: 30 },
  },
  {
    type: 'SYNC_PROMOTIONS',
    intervalMs: 24 * 60 * 60 * 1000,
    lockKeyPrefix: 'tenant-sync-promotions',
    payload: { forcePromoPrices: true },
  },
  {
    type: 'SYNC_PRICE',
    intervalMs: 24 * 60 * 60 * 1000,
    lockKeyPrefix: 'tenant-sync-price',
    payload: { forcePromoPrices: true },
  },
];

async function enqueueForAllTenants(app: FastifyInstance, config: ScheduledJobConfig): Promise<void> {
  const queue = getJobQueue();
  const tenants = await prisma.marketplaceConnection.findMany({
    where: {
      type: Marketplace.mercadolivre,
      status: ConnectionStatus.active,
    },
    select: {
      tenant_id: true,
    },
    distinct: ['tenant_id'],
  });

  for (const tenant of tenants) {
    const lockKey = `${config.lockKeyPrefix}:${tenant.tenant_id}:${config.type}`;
    await queue.enqueue({
      tenantId: tenant.tenant_id,
      type: config.type,
      priority: 'background',
      lockKey,
      payload: config.payload,
    });
  }

  app.log.info(
    {
      jobType: config.type,
      tenants: tenants.length,
    },
    'Recurring marketplace sync jobs enqueued',
  );
}

export function scheduleMarketplaceDataJobs(app: FastifyInstance): void {
  for (const config of DEFAULT_SCHEDULES) {
    enqueueForAllTenants(app, config).catch((error: unknown) => {
      app.log.error({ err: error, jobType: config.type }, 'Error running initial marketplace scheduler tick');
    });

    setInterval(() => {
      enqueueForAllTenants(app, config).catch((error: unknown) => {
        app.log.error({ err: error, jobType: config.type }, 'Error running scheduled marketplace sync jobs');
      });
    }, config.intervalMs);
  }
}
