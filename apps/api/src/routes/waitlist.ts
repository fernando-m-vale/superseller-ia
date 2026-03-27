import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { sendWaitlistInviteEmail } from '../lib/email';

const prisma = new PrismaClient();

const WaitlistSchema = z.object({
  email: z.string().email(),
  store_name: z.string().optional(),
  store_url: z.string().url().optional().or(z.literal('')),
  gmv_range: z.string().optional(),
  listings_count: z.string().optional(),
  marketplace: z.string().optional(),
});

export async function waitlistRoutes(app: FastifyInstance) {
  // POST /waitlist — inscrever na lista de espera
  app.post('/', async (request, reply) => {
    try {
      const body = WaitlistSchema.parse(request.body);

      const entry = await prisma.waitlist.upsert({
        where: { email: body.email },
        update: {
          store_name: body.store_name,
          store_url: body.store_url || null,
          gmv_range: body.gmv_range,
          listings_count: body.listings_count,
          marketplace: body.marketplace,
        },
        create: {
          email: body.email,
          store_name: body.store_name,
          store_url: body.store_url || null,
          gmv_range: body.gmv_range,
          listings_count: body.listings_count,
          marketplace: body.marketplace,
        },
      });

      return reply.status(201).send({ ok: true, id: entry.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      app.log.error({ error }, 'Waitlist registration error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /waitlist/count — quantas pessoas na lista (público)
  app.get('/count', async (_request, reply) => {
    const count = await prisma.waitlist.count();
    return reply.send({ count });
  });

  // POST /waitlist/:id/invite — envia convite por e-mail (protegido por x-admin-key)
  app.post('/:id/invite', async (request, reply) => {
    const adminKey = request.headers['x-admin-key'];
    const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';
    if (!ADMIN_SECRET || adminKey !== ADMIN_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
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

    try {
      await sendWaitlistInviteEmail(entry.email, invite.token);
    } catch (err) {
      app.log.error({ err }, 'Failed to send waitlist invite email');
    }

    return reply.send({ ok: true, token: invite.token });
  });

  // GET /waitlist/validate-invite/:token — valida se o token é válido (chamado pelo /register)
  app.get('/validate-invite/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const invite = await prisma.waitlistInvite.findUnique({ where: { token } });
    if (!invite) return reply.status(404).send({ valid: false, reason: 'not_found' });
    if (invite.used) return reply.status(410).send({ valid: false, reason: 'already_used' });
    if (invite.expires_at < new Date()) return reply.status(410).send({ valid: false, reason: 'expired' });
    return reply.send({ valid: true });
  });
}
