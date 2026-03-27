import { PrismaClient } from '@prisma/client';
import {
  sendTrialMidpointEmail,
  sendTrialExpiringEmail,
  sendTrialExpiredEmail,
} from '../lib/email';

const prisma = new PrismaClient();

/**
 * Envia emails de trial baseados em janelas de tempo de 24h.
 * Roda a cada 24h. Janelas:
 *  - Midpoint (dia 7):  trial_ends_at BETWEEN (now+7 00:00) AND (now+7 23:59)
 *  - Expiring (dia 2):  trial_ends_at BETWEEN (now+2 00:00) AND (now+2 23:59)
 *  - Expired  (dia 0):  trial_ends_at BETWEEN (now-1 00:00) AND (now-1 23:59) — acaba de expirar
 */
export async function runTrialEmailJob(): Promise<void> {
  const now = new Date();

  function windowStart(offsetDays: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function windowEnd(offsetDays: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // ── Midpoint (day 7 remaining) ────────────────────────────────────────────
  const midpointTenants = await prisma.tenant.findMany({
    where: {
      plan_status: 'trialing',
      trial_ends_at: { gte: windowStart(7), lte: windowEnd(7) },
    },
    include: { users: { where: { role: 'owner' }, take: 1 } },
  });

  for (const tenant of midpointTenants) {
    const owner = tenant.users[0];
    if (!owner || !tenant.trial_ends_at) continue;
    try {
      await sendTrialMidpointEmail(owner.email, tenant.name, tenant.trial_ends_at);
    } catch (err) {
      console.error(`[TrialEmailJob] midpoint error for tenant ${tenant.id}:`, err);
    }
  }

  // ── Expiring (2 days left) ────────────────────────────────────────────────
  const expiringTenants = await prisma.tenant.findMany({
    where: {
      plan_status: 'trialing',
      trial_ends_at: { gte: windowStart(2), lte: windowEnd(2) },
    },
    include: { users: { where: { role: 'owner' }, take: 1 } },
  });

  for (const tenant of expiringTenants) {
    const owner = tenant.users[0];
    if (!owner || !tenant.trial_ends_at) continue;
    try {
      await sendTrialExpiringEmail(owner.email, tenant.name, tenant.trial_ends_at);
    } catch (err) {
      console.error(`[TrialEmailJob] expiring error for tenant ${tenant.id}:`, err);
    }
  }

  // ── Expired (yesterday) ───────────────────────────────────────────────────
  const expiredTenants = await prisma.tenant.findMany({
    where: {
      plan_status: 'active',
      plan: 'free',
      trial_used: true,
      trial_ends_at: { gte: windowStart(-1), lte: windowEnd(-1) },
    },
    include: { users: { where: { role: 'owner' }, take: 1 } },
  });

  for (const tenant of expiredTenants) {
    const owner = tenant.users[0];
    if (!owner) continue;
    try {
      await sendTrialExpiredEmail(owner.email, tenant.name);
    } catch (err) {
      console.error(`[TrialEmailJob] expired error for tenant ${tenant.id}:`, err);
    }
  }

  console.log(`[TrialEmailJob] done — midpoint: ${midpointTenants.length}, expiring: ${expiringTenants.length}, expired: ${expiredTenants.length}`);
}

export function scheduleTrialEmailJob(): void {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
  // Run immediately on startup, then every 24h
  runTrialEmailJob().catch((err) =>
    console.error('[TrialEmailJob] initial run error:', err),
  );
  setInterval(() => {
    runTrialEmailJob().catch((err) =>
      console.error('[TrialEmailJob] scheduled run error:', err),
    );
  }, INTERVAL_MS);
}
