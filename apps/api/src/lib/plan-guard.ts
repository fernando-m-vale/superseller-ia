import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const APP_URL = process.env.APP_URL ?? 'https://app.superselleria.com.br';

export const FREE_LIMITS = {
  maxAiAnalysesPerMonth: 3,
  maxMarketplaces: 1,
  maxConnections: 1,   // máximo de contas ML no Free
  historyDays: 7,
  autoSync: false,
  readyCopy: false,
};

export type Plan = 'free' | 'pro';

export function getEffectivePlan(tenant: {
  plan: string;
  plan_status: string;
  trial_ends_at?: Date | null;
  plan_expires_at?: Date | null;
}): Plan {
  const now = new Date();

  // Trial ativo → Pro
  if (
    tenant.plan_status === 'trialing' &&
    tenant.trial_ends_at &&
    tenant.trial_ends_at > now
  ) {
    return 'pro';
  }

  // Pro ativo
  if (tenant.plan === 'pro' && tenant.plan_status === 'active') {
    return 'pro';
  }

  // Grace period de 3 dias para past_due
  if (tenant.plan_status === 'past_due' && tenant.plan_expires_at) {
    const grace = new Date(tenant.plan_expires_at.getTime() + 3 * 24 * 60 * 60 * 1000);
    if (grace > now) return 'pro';
  }

  return 'free';
}

// Auto-downgrade: se trial_ends_at < now e plan_status='trialing', rebaixa para free
// Também marca trial_used = true (anti-burla)
export async function autoDowngradeIfTrialExpired(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan_status: true, trial_ends_at: true },
  });
  if (!tenant) return;
  if (tenant.plan_status === 'trialing' && tenant.trial_ends_at && tenant.trial_ends_at < new Date()) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: 'free', plan_status: 'active', trial_used: true },
    });
  }
}

// Verifica limite de conexões para usuários Free (Free: max 2 contas ML)
export async function checkConnectionLimit(
  tenantId: string,
  prismaClient: PrismaClient,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const tenant = await prismaClient.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, plan_status: true, trial_ends_at: true, plan_expires_at: true },
  });
  if (!tenant) return { allowed: false, count: 0, limit: 0 };

  const effective = getEffectivePlan(tenant);
  if (effective === 'pro') return { allowed: true, count: 0, limit: Infinity };

  const count = await prismaClient.marketplaceConnection.count({
    where: { tenant_id: tenantId },
  });

  return {
    allowed: count < FREE_LIMITS.maxConnections,
    count,
    limit: FREE_LIMITS.maxConnections,
  };
}

// Middleware — protege rotas que exigem plano Pro
export function planGuard(requiredPlan: Plan) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request as any).tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, plan_status: true, trial_ends_at: true, plan_expires_at: true },
    });

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const effective = getEffectivePlan(tenant);
    if (requiredPlan === 'pro' && effective !== 'pro') {
      return reply.status(403).send({
        error: 'plan_required',
        message: 'Esta funcionalidade requer o plano Pro.',
        upgradeUrl: `${APP_URL}/upgrade`,
      });
    }
  };
}

// Verifica limite de análises para usuários Free
export async function checkFreeAnalysisLimit(
  tenantId: string,
  prismaClient: PrismaClient,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const tenant = await prismaClient.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, plan_status: true, trial_ends_at: true, plan_expires_at: true },
  });

  if (!tenant) return { allowed: false, used: 0, limit: 0 };

  // Auto-downgrade silencioso se trial expirou
  if (tenant.plan_status === 'trialing' && tenant.trial_ends_at && tenant.trial_ends_at < new Date()) {
    await prismaClient.tenant.update({
      where: { id: tenantId },
      data: { plan: 'free', plan_status: 'active', trial_used: true },
    });
    tenant.plan = 'free';
    tenant.plan_status = 'active';
  }

  const effective = getEffectivePlan(tenant);
  if (effective === 'pro') return { allowed: true, used: 0, limit: Infinity };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const used = await prismaClient.listingAIAnalysis.count({
    where: {
      tenant_id: tenantId,
      created_at: { gte: startOfMonth },
    },
  });

  return {
    allowed: used < FREE_LIMITS.maxAiAnalysesPerMonth,
    used,
    limit: FREE_LIMITS.maxAiAnalysesPerMonth,
  };
}
