/**
 * DIA 08: Helpers para locks e cooldowns
 * 
 * Locks:
 * - tenant:${tenantId} - lock por tenant
 * - listing:${listingId} - lock por listing
 * 
 * Stale TTL:
 * - Tenant lock: 20 min
 * - Listing lock: 15 min
 */

import { PrismaClient, SyncJobStatus } from '@prisma/client';

const prisma = new PrismaClient();

const STALE_TTL_TENANT_MS = 20 * 60 * 1000; // 20 minutos
const STALE_TTL_LISTING_MS = 15 * 60 * 1000; // 15 minutos

export interface LockCheckResult {
  isLocked: boolean;
  isStale: boolean;
  reason?: string;
}

/**
 * Verifica se existe lock ativo para uma chave
 */
export async function checkLock(lockKey: string): Promise<LockCheckResult> {
  const runningJob = await prisma.syncJob.findFirst({
    where: {
      lock_key: lockKey,
      status: SyncJobStatus.running,
    },
    select: {
      started_at: true,
    },
    orderBy: {
      started_at: 'desc',
    },
  });

  if (!runningJob || !runningJob.started_at) {
    return { isLocked: false, isStale: false };
  }

  const now = new Date();
  const startedAt = runningJob.started_at;
  const elapsed = now.getTime() - startedAt.getTime();

  // Determinar TTL baseado no tipo de lock
  const staleTTL = lockKey.startsWith('tenant:')
    ? STALE_TTL_TENANT_MS
    : STALE_TTL_LISTING_MS;

  const isStale = elapsed > staleTTL;

  if (isStale) {
    // Log em dev ou com x-debug
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === '1') {
      console.warn(`[LOCKS] Stale lock detectado: ${lockKey} (${Math.round(elapsed / 1000)}s)`);
    }
  }

  return {
    isLocked: true,
    isStale,
    reason: isStale ? 'stale_lock' : 'lock_running',
  };
}

/**
 * Verifica cooldown para auto-sync (24h)
 */
export function checkAutoSyncCooldown(lastAutoSyncAt: Date | null): {
  inCooldown: boolean;
  retryAfterSeconds?: number;
} {
  if (!lastAutoSyncAt) {
    return { inCooldown: false };
  }

  const now = new Date();
  const elapsed = now.getTime() - lastAutoSyncAt.getTime();
  const cooldownMs = 24 * 60 * 60 * 1000; // 24 horas

  if (elapsed < cooldownMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
    return { inCooldown: true, retryAfterSeconds };
  }

  return { inCooldown: false };
}

/**
 * Verifica cooldown para manual sync (15 min)
 */
export function checkManualSyncCooldown(lastManualSyncAt: Date | null): {
  inCooldown: boolean;
  retryAfterSeconds?: number;
} {
  if (!lastManualSyncAt) {
    return { inCooldown: false };
  }

  const now = new Date();
  const elapsed = now.getTime() - lastManualSyncAt.getTime();
  const cooldownMs = 15 * 60 * 1000; // 15 minutos

  if (elapsed < cooldownMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
    return { inCooldown: true, retryAfterSeconds };
  }

  return { inCooldown: false };
}

/**
 * Verifica cooldown para listing sync (10 min)
 */
export function checkListingSyncCooldown(lastSyncedAt: Date | null): {
  inCooldown: boolean;
  retryAfterSeconds?: number;
} {
  if (!lastSyncedAt) {
    return { inCooldown: false };
  }

  const now = new Date();
  const elapsed = now.getTime() - lastSyncedAt.getTime();
  const cooldownMs = 10 * 60 * 1000; // 10 minutos

  if (elapsed < cooldownMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
    return { inCooldown: true, retryAfterSeconds };
  }

  return { inCooldown: false };
}
