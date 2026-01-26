import { FastifyPluginCallback } from 'fastify';
import { PrismaClient, Marketplace } from '@prisma/client';
import { z } from 'zod';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

// Schema de validação para query params
const ListingsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
  q: z.string().optional(),
  status: z.enum(['active', 'paused', 'deleted']).optional(),
});

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
  
  // GET /api/v1/listings
  app.get('/', { preHandler: authGuard }, async (req, reply) => {
    try {
      // @ts-ignore - tenantId é injetado pelo authGuard
      const tenantId = req.user?.tenantId || req.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized: No tenant context' });
      }

      // Validar e extrair query params
      const query = ListingsQuerySchema.parse(req.query);
      const { page, pageSize, marketplace, q, status } = query;
      const skip = (page - 1) * pageSize;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = { tenant_id: tenantId };

      // Filtro de marketplace
      if (marketplace) {
        whereClause.marketplace = marketplace as Marketplace;
      }

      // Filtro de busca por título
      if (q && q.trim()) {
        whereClause.title = { contains: q.trim(), mode: 'insensitive' };
      }

      // Filtro de status
      if (status) {
        whereClause.status = status;
      }

      // Contar total para paginação
      const total = await prisma.listing.count({ where: whereClause });

      // Buscar listings com paginação
      const listings = await prisma.listing.findMany({
        where: whereClause,
        orderBy: { updated_at: 'desc' },
        skip,
        take: pageSize,
      });

      // Mapear para formato esperado pelo frontend (camelCase)
      const items = listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        marketplace: listing.marketplace,
        price: Number(listing.price),
        stock: listing.stock,
        status: listing.status,
        category: listing.category,
        healthScore: listing.health_score ?? undefined, // Score legado da API do ML
        superSellerScore: listing.super_seller_score ?? undefined, // Super Seller Score proprietário
        scoreBreakdown: listing.score_breakdown ?? undefined, // Detalhamento do score
        hasVideo: listing.has_video, // null quando não sabemos (tri-state: true/false/null)
        hasClips: listing.has_clips ?? null, // null = desconhecido/não detectável via API
        listingIdExt: listing.listing_id_ext, // ID externo do marketplace (ex: MLB3923303743)
        accessStatus: listing.access_status, // Status de acesso pela conexão atual
        accessBlockedCode: listing.access_blocked_code ?? undefined, // Código do erro que bloqueou acesso
        accessBlockedReason: listing.access_blocked_reason ?? undefined, // Mensagem sanitizada do erro
        createdAt: listing.created_at,
        updatedAt: listing.updated_at,
      }));

      return reply.send({
        items,
        total,
        page,
        pageSize,
        tenantId,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch listings' });
    }
  });

  done();
};