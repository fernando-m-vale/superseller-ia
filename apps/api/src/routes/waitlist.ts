import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

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
}
