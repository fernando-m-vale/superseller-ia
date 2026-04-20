import { FastifyPluginCallback } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { triggerLoginSyncIfNeeded } from '../lib/sync-on-login';
import { getEffectivePlan } from '../lib/plan-guard';
import { sendWelcomeEmail } from '../lib/email';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

// Accept either tenantName or storeName for flexibility
// The UI shows "Store Name" but the API field is tenantName
const RawRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantName: z.string().min(1).optional(),
  storeName: z.string().min(1).optional(),
  inviteToken: z.string().optional(),
}).refine((data) => data.tenantName || data.storeName, {
  message: 'tenantName or storeName is required',
  path: ['tenantName'],
});

// Transform to normalize the field name
const RegisterSchema = RawRegisterSchema.transform((data) => ({
  email: data.email,
  password: data.password,
  tenantName: data.tenantName ?? data.storeName!,
  inviteToken: data.inviteToken,
}));

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginCallback = (app, _, done) => {
  // Rota: /api/v1/auth/register (prefixo já inclui /auth)
  app.post('/register', async (req, reply) => {
    try {
      const body = RegisterSchema.parse(req.body);

      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        return reply.status(400).send({ error: 'User already exists' });
      }

      // Validate invite token if provided
      let inviteRecord: { id: number } | null = null;
      if (body.inviteToken) {
        inviteRecord = await prisma.waitlistInvite.findUnique({
          where: { token: body.inviteToken },
          select: { id: true, used: true, expires_at: true },
        }) as { id: number; used: boolean; expires_at: Date } | null;
        if (!inviteRecord) {
          return reply.status(400).send({ error: 'Invalid invite token' });
        }
        const invite = inviteRecord as unknown as { id: number; used: boolean; expires_at: Date };
        if (invite.used || invite.expires_at < new Date()) {
          return reply.status(400).send({ error: 'Invite token expired or already used' });
        }
      }

      const passwordHash = await bcrypt.hash(body.password, 10);

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: body.tenantName,
            // Reverse Trial: começa como Pro em trialing por 14 dias
            plan: 'pro',
            plan_status: 'trialing',
            trial_ends_at: trialEndsAt,
          },
        });

        const user = await tx.user.create({
          data: {
            email: body.email,
            password_hash: passwordHash,
            tenant_id: tenant.id,
            role: 'owner',
          },
        });

        return { tenant, user };
      });

      const accessToken = jwt.sign(
        { userId: result.user.id, tenantId: result.tenant.id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: result.user.id, tenantId: result.tenant.id },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      // Mark invite as used
      if (inviteRecord) {
        await prisma.waitlistInvite.update({
          where: { id: inviteRecord.id },
          data: { used: true, used_at: new Date() },
        }).catch(() => {});
      }

      // Send welcome email in background (non-blocking)
      sendWelcomeEmail(result.user.email, result.tenant.name, trialEndsAt)
        .catch(err => console.error('[Register] Welcome email failed:', err));

      return reply.status(201).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.tenant.id,
          tenantName: result.tenant.name,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Rota: /api/v1/auth/login
  app.post('/login', async (req, reply) => {
    try {
      const body = LoginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { tenant: true },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(body.password, user.password_hash);

      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const accessToken = jwt.sign(
        { userId: user.id, tenantId: user.tenant_id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, tenantId: user.tenant_id },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      // Sync em background após login — 1x por dia por tenant
      const _apiBaseUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3001'
      const _serviceToken = process.env.SCHEDULER_SERVICE_TOKEN ?? ''
      if (_serviceToken) {
        triggerLoginSyncIfNeeded(user.tenant_id, _apiBaseUrl, _serviceToken)
      }

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant.name,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Rota: /api/v1/auth/me
  app.get('/me', async (req, reply) => {
    try {
      const authorization = req.headers.authorization;

      if (!authorization || !authorization.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const token = authorization.substring(7);

      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        tenantId: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              plan: true,
              plan_status: true,
              trial_ends_at: true,
              onboarding_completed: true,
              onboarding_step: true,
              active_connection_id: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      // Auto-downgrade silencioso se trial expirou
      if (
        user.tenant.plan_status === 'trialing' &&
        user.tenant.trial_ends_at &&
        user.tenant.trial_ends_at < new Date()
      ) {
        await prisma.tenant.update({
          where: { id: user.tenant.id },
          data: { plan: 'free', plan_status: 'active', trial_used: true },
        });
        user.tenant.plan = 'free';
        user.tenant.plan_status = 'active';
      }

      const effectivePlan = getEffectivePlan(user.tenant);
      const trialDaysLeft = user.tenant.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(user.tenant.trial_ends_at).getTime() - Date.now()) / 86400000))
        : null;

      // Buscar conexões do tenant
      const connections = await prisma.marketplaceConnection.findMany({
        where: { tenant_id: user.tenant_id },
        select: {
          id: true,
          type: true,
          provider_account_id: true,
          nickname: true,
          status: true,
          last_synced_at: true,
        },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant.name,
        },
        billing: {
          plan: effectivePlan,
          planStatus: user.tenant.plan_status,
          isTrialing: user.tenant.plan_status === 'trialing',
          trialEndsAt: user.tenant.trial_ends_at,
          trialDaysLeft,
        },
        onboarding: {
          completed: user.tenant.onboarding_completed,
          step: user.tenant.onboarding_step,
        },
        connections: {
          list: connections,
          activeConnectionId: user.tenant.active_connection_id ?? null,
          isViewingAll: user.tenant.active_connection_id === null,
          count: connections.length,
        },
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Rota: POST /api/v1/auth/onboarding — atualiza progresso do onboarding
  app.post('/onboarding', async (req, reply) => {
    try {
      const authorization = req.headers.authorization;
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const token = authorization.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; tenantId: string };

      const body = (req.body ?? {}) as { step?: number; completed?: boolean };
      const data: Record<string, unknown> = {};
      if (typeof body.step === 'number') data.onboarding_step = body.step;
      if (typeof body.completed === 'boolean') data.onboarding_completed = body.completed;

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'Provide step or completed' });
      }

      await prisma.tenant.update({
        where: { id: decoded.tenantId },
        data,
      });

      return reply.send({ ok: true });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  done();
};
