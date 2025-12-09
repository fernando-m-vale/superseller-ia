import { FastifyPluginCallback } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
  
  // GET /api/v1/listings
  app.get('/', { preHandler: authGuard }, async (req, reply) => {
    try {
      // @ts-ignore - tenantId é injetado pelo authGuard
      const tenantId = req.user?.tenantId || req.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized: No tenant context' });
      }

      const items = await prisma.listing.findMany({
        where: { tenant_id: tenantId },
        orderBy: { updated_at: 'desc' },
        take: 100, // Limite seguro para não travar
      });

      return reply.send({ items });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch listings' });
    }
  });

  done();
};