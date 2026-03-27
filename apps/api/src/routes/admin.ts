import { FastifyPluginCallback } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sendWaitlistInviteEmail } from '../lib/email';

const prisma = new PrismaClient();

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@superselleria.com.br';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

function requireAdmin(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET) as { role?: string };
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

function getAdminToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  return authHeader.substring(7);
}

export const adminRoutes: FastifyPluginCallback = (app, _, done) => {
  // POST /admin/login
  app.post('/login', async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return reply.status(400).send({ error: 'email and password required' });
    }
    if (body.email !== ADMIN_EMAIL) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    if (!ADMIN_PASSWORD) {
      return reply.status(500).send({ error: 'ADMIN_PASSWORD not configured' });
    }
    const valid = await bcrypt.compare(body.password, ADMIN_PASSWORD).catch(() => false)
      || body.password === ADMIN_PASSWORD; // plain text fallback for dev
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '8h' });
    return reply.send({ token });
  });

  // GET /admin/users
  app.get('/users', async (req, reply) => {
    if (!requireAdmin(getAdminToken(req.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const users = await prisma.user.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            plan: true,
            plan_status: true,
            trial_ends_at: true,
            trial_used: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    return reply.send({ users });
  });

  // GET /admin/waitlist
  app.get('/waitlist', async (req, reply) => {
    if (!requireAdmin(getAdminToken(req.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const entries = await prisma.waitlist.findMany({
      include: { invites: { orderBy: { created_at: 'desc' }, take: 1 } },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ entries });
  });

  // POST /admin/waitlist/:id/approve — approve + create invite + send email
  app.post('/waitlist/:id/approve', async (req, reply) => {
    if (!requireAdmin(getAdminToken(req.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };
    const waitlistId = parseInt(id, 10);
    if (isNaN(waitlistId)) return reply.status(400).send({ error: 'Invalid id' });

    const entry = await prisma.waitlist.findUnique({ where: { id: waitlistId } });
    if (!entry) return reply.status(404).send({ error: 'Not found' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invite] = await prisma.$transaction([
      prisma.waitlistInvite.create({
        data: { waitlist_id: waitlistId, expires_at: expiresAt },
      }),
      prisma.waitlist.update({
        where: { id: waitlistId },
        data: { approved: true, approved_at: new Date() },
      }),
    ]);

    // Send invite email
    try {
      await sendWaitlistInviteEmail(entry.email, invite.token);
    } catch (err) {
      app.log.error({ err }, 'Failed to send waitlist invite email');
    }

    return reply.send({ ok: true, token: invite.token });
  });

  // PATCH /admin/users/:id/plan — change tenant plan
  app.patch('/users/:id/plan', async (req, reply) => {
    if (!requireAdmin(getAdminToken(req.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };
    const body = z.object({
      plan: z.enum(['free', 'pro']),
      plan_status: z.enum(['active', 'trialing', 'past_due', 'canceled']).optional(),
    }).parse(req.body);

    await prisma.tenant.update({
      where: { id },
      data: {
        plan: body.plan,
        plan_status: body.plan_status ?? 'active',
      },
    });

    return reply.send({ ok: true });
  });

  done();
};
