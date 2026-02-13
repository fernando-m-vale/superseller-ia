/**
 * DIA 08: TenantSyncOrchestrator
 * 
 * Handler para job TENANT_SYNC.
 * Enfileira LISTING_SYNC jobs para cada listing ativo do tenant.
 */

import { PrismaClient, SyncStatus, ListingStatus } from '@prisma/client';
import { getJobQueue } from '../jobQueueFactory';
import { checkListingSyncCooldown } from '../locks';

const prisma = new PrismaClient();
const MAX_LISTINGS_PER_SYNC = 200;

export async function handleTenantSync(tenantId: string): Promise<void> {
  const startTime = Date.now();
  const queue = getJobQueue();
  const requestId = `tenant-sync-${tenantId}-${Date.now()}`;
  const debug = process.env.DEBUG === '1' || process.env.DEBUG_JOB_RUNNER === '1' || process.env.NODE_ENV === 'development';

  try {
    if (debug) {
      console.log(`[TENANT_SYNC] Iniciando`, { requestId, tenantId });
    }

    // Atualizar status do tenant para running
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        last_sync_status: SyncStatus.running,
        last_sync_started_at: new Date(),
        last_sync_error: null,
      },
    });

    // Buscar listings ativos do tenant (limitar a 200)
    const listings = await prisma.listing.findMany({
      where: {
        tenant_id: tenantId,
        status: ListingStatus.active,
      },
      select: {
        id: true,
        listing_id_ext: true,
        last_synced_at: true,
      },
      take: MAX_LISTINGS_PER_SYNC,
      orderBy: {
        last_synced_at: 'asc', // Sincronizar os mais antigos primeiro
      },
    });

    let enqueuedCount = 0;
    let skippedCount = 0;

    // Enfileirar LISTING_SYNC para cada listing (respeitando cooldown)
    for (const listing of listings) {
      const cooldown = checkListingSyncCooldown(listing.last_synced_at);
      
      if (cooldown.inCooldown) {
        skippedCount++;
        continue;
      }

      await queue.enqueue({
        tenantId,
        type: 'LISTING_SYNC',
        priority: 'interactive',
        lockKey: `listing:${listing.id}:LISTING_SYNC`, // HOTFIX: incluir tipo
        payload: {
          listingId: listing.id,
          listingIdExt: listing.listing_id_ext,
          periodDays: 30, // DIA 08: ajuste confirmado - 30 dias
        },
      });

      enqueuedCount++;
    }

    const duration = Date.now() - startTime;

    // Atualizar status do tenant para success
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        last_sync_status: SyncStatus.success,
        last_sync_finished_at: new Date(),
        last_sync_error: null,
      },
    });

    // HOTFIX: Logs estruturados
    if (debug) {
      console.log(`[TENANT_SYNC] Concluído`, {
        requestId,
        tenantId,
        enqueued: enqueuedCount,
        skipped: skippedCount,
        duration: `${duration}ms`,
        status: 'success',
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const duration = Date.now() - startTime;

    // Atualizar status do tenant para error
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        last_sync_status: SyncStatus.error,
        last_sync_finished_at: new Date(),
        last_sync_error: errorMessage,
      },
    });

    console.error(`[TENANT_SYNC] Erro`, {
      requestId,
      tenantId,
      duration: `${duration}ms`,
      error: errorMessage,
    });
    throw error;
  }
}
