import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ListingFilterSchema } from '../schemas';

const prisma = new PrismaClient();

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/listings', async (req, reply) => {
    try {
      const q = ListingFilterSchema.parse(req.query);
      const tenantId = (req as RequestWithTenant).tenantId || 'demo-tenant';

      const where: {
        tenant_id: string;
        marketplace?: 'shopee' | 'mercadolivre';
        title?: { contains: string; mode: 'insensitive' };
      } = {
        tenant_id: tenantId,
      };

      if (q.marketplace) {
        where.marketplace = q.marketplace;
      }

      if (q.q) {
        where.title = {
          contains: q.q,
          mode: 'insensitive',
        };
      }

      const [total, items] = await Promise.all([
        prisma.listing.count({ where }),
        prisma.listing.findMany({
          where,
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
          orderBy: {
            created_at: 'desc',
          },
          select: {
            id: true,
            title: true,
            marketplace: true,
            status: true,
            price: true,
            listing_id_ext: true,
            created_at: true,
          },
        }),
      ]);

      return {
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          marketplace: item.marketplace,
          status: item.status,
          price: Number(item.price),
          sku: item.listing_id_ext,
          createdAt: item.created_at.toISOString(),
        })),
        total,
        page: q.page,
        pageSize: q.pageSize,
        tenantId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          message: 'Validation error',
          issues: (error as { issues?: unknown }).issues,
        });
      }

      console.error('Error fetching listings:', error);
      return reply.status(500).send({
        message: 'internal_error',
        requestId: req.id,
      });
    }
  });


app.get('/listings/:id/metrics', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as RequestWithTenant).tenantId;
// TODO: retornar série temporal do listing
return { listingId: id, tenantId, series: [] };
});


done();
};
