import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ListingFilterSchema } from '../schemas';
import { calculateListingHealth } from '../services/listing-health';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
  // GET /api/v1/listings - Lista anúncios do tenant (requer autenticação)
  app.get('/', { preHandler: authGuard }, async (req, reply) => {
    try {
      const q = ListingFilterSchema.parse(req.query);
      const tenantId = req.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

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
            stock: true,
            listing_id_ext: true,
            created_at: true,
          },
        }),
      ]);

      return {
        items: items.map((item: typeof items[0]) => {
          const health = calculateListingHealth({
            title: item.title,
            status: item.status,
            stock: item.stock,
            price: item.price,
          });
          return {
            id: item.id,
            title: item.title,
            marketplace: item.marketplace,
            status: item.status,
            price: Number(item.price),
            stock: item.stock,
            sku: item.listing_id_ext,
            createdAt: item.created_at.toISOString(),
            healthScore: health.score,
            healthIssues: health.issues,
          };
        }),
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


  // GET /api/v1/listings/:id/metrics - Métricas de um listing específico
  app.get('/:id/metrics', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    
    // TODO: retornar série temporal do listing
    return { listingId: id, tenantId, series: [] };
  });


done();
};
