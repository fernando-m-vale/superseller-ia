import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient, RecommendationStatus } from '@prisma/client';
import { RecommendationService } from '../services/RecommendationService';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

// Schema para query params
const ListQuerySchema = z.object({
  listingId: z.string().uuid().optional(),
  status: z.enum(['pending', 'applied', 'dismissed', 'expired']).optional(),
  type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const recommendationsRoutes: FastifyPluginCallback = (app, _, done) => {
  
  /**
   * POST /api/v1/recommendations/generate
   * 
   * Gera recomendações para todos os anúncios do tenant.
   * Útil para forçar recálculo manual.
   */
  app.post(
    '/generate',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        console.log(`[RECOMMENDATIONS-ROUTE] Gerando recomendações para tenant: ${tenantId}`);

        const service = new RecommendationService(tenantId);
        const result = await service.generateForAllListings();

        return reply.status(200).send({
          message: 'Recomendações geradas com sucesso',
          data: result,
        });
      } catch (error) {
        console.error('[RECOMMENDATIONS-ROUTE] Erro ao gerar recomendações:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha ao gerar recomendações',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/recommendations
   * 
   * Lista recomendações do tenant.
   * Query params:
   *   - listingId: Filtrar por anúncio específico
   *   - status: Filtrar por status (pending, applied, dismissed, expired)
   *   - type: Filtrar por tipo (seo, image, price, etc.)
   *   - limit: Limite de resultados (default: 50)
   */
  app.get(
    '/',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        const query = ListQuerySchema.parse(request.query);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const whereClause: any = { tenant_id: tenantId };
        
        if (query.listingId) {
          whereClause.listing_id = query.listingId;
        }
        // If no status filter is provided, default to showing pending recommendations
        // This ensures users see actionable items by default
        if (query.status) {
          whereClause.status = query.status;
        } else {
          whereClause.status = RecommendationStatus.pending;
        }
        if (query.type) {
          whereClause.type = query.type;
        }

        const recommendations = await prisma.recommendation.findMany({
          where: whereClause,
          orderBy: [
            { priority: 'desc' },
            { created_at: 'desc' },
          ],
          take: query.limit,
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                listing_id_ext: true,
                marketplace: true,
                super_seller_score: true,
              },
            },
          },
        });

        // Mapear para camelCase
        const items = recommendations.map(rec => ({
          id: rec.id,
          listingId: rec.listing_id,
          listing: rec.listing ? {
            id: rec.listing.id,
            title: rec.listing.title,
            listingIdExt: rec.listing.listing_id_ext,
            marketplace: rec.listing.marketplace,
            superSellerScore: rec.listing.super_seller_score,
          } : null,
          type: rec.type,
          status: rec.status,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          impactEstimate: rec.impact_estimate,
          scoreImpact: rec.score_impact,
          ruleTrigger: rec.rule_trigger,
          createdAt: rec.created_at,
          appliedAt: rec.applied_at,
          dismissedAt: rec.dismissed_at,
        }));

        return reply.send({
          items,
          total: items.length,
        });
      } catch (error) {
        console.error('[RECOMMENDATIONS-ROUTE] Erro ao listar recomendações:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha ao listar recomendações',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/recommendations/summary
   * 
   * Resumo de recomendações do tenant.
   */
  app.get(
    '/summary',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        const service = new RecommendationService(tenantId);
        const summary = await service.getSummary();

        return reply.send(summary);
      } catch (error) {
        console.error('[RECOMMENDATIONS-ROUTE] Erro ao buscar resumo:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha ao buscar resumo',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/recommendations/listing/:listingId
   * 
   * Busca recomendações de um anúncio específico.
   */
  app.get<{ Params: { listingId: string } }>(
    '/listing/:listingId',
    { preHandler: authGuard },
    async (request, reply) => {
      try {
        const { tenantId } = request as unknown as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        const { listingId } = request.params;

        const recommendations = await prisma.recommendation.findMany({
          where: {
            tenant_id: tenantId,
            listing_id: listingId,
            status: RecommendationStatus.pending,
          },
          orderBy: { priority: 'desc' },
        });

        // Mapear para camelCase
        const items = recommendations.map(rec => ({
          id: rec.id,
          type: rec.type,
          status: rec.status,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          impactEstimate: rec.impact_estimate,
          scoreImpact: rec.score_impact,
          ruleTrigger: rec.rule_trigger,
          createdAt: rec.created_at,
        }));

        return reply.send({ items });
      } catch (error) {
        console.error('[RECOMMENDATIONS-ROUTE] Erro ao buscar recomendações do listing:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha ao buscar recomendações',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * PATCH /api/v1/recommendations/:id/apply
   * 
   * Marca uma recomendação como aplicada.
   */
  app.patch<{ Params: { id: string } }>(
    '/:id/apply',
    { preHandler: authGuard },
    async (request, reply) => {
      try {
        const { tenantId } = request as unknown as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        const { id } = request.params;

        // Verificar se pertence ao tenant
        const existing = await prisma.recommendation.findFirst({
          where: { id, tenant_id: tenantId },
        });

        if (!existing) {
          return reply.status(404).send({ error: 'Recomendação não encontrada' });
        }

        const service = new RecommendationService(tenantId);
        const updated = await service.markAsApplied(id);

        return reply.send({
          message: 'Recomendação marcada como aplicada',
          data: {
            id: updated.id,
            status: updated.status,
            appliedAt: updated.applied_at,
          },
        });
      } catch (error) {
        console.error('[RECOMMENDATIONS-ROUTE] Erro ao aplicar recomendação:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha ao aplicar recomendação',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * PATCH /api/v1/recommendations/:id/dismiss
   * 
   * Marca uma recomendação como ignorada.
   */
  app.patch<{ Params: { id: string } }>(
    '/:id/dismiss',
    { preHandler: authGuard },
    async (request, reply) => {
      try {
        const { tenantId } = request as unknown as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ 
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado' 
          });
        }

        const { id } = request.params;

        // Verificar se pertence ao tenant
        const existing = await prisma.recommendation.findFirst({
          where: { id, tenant_id: tenantId },
        });

        if (!existing) {
          return reply.status(404).send({ error: 'Recomendação não encontrada' });
        }

        const service = new RecommendationService(tenantId);
        const updated = await service.markAsDismissed(id);

        return reply.send({
          message: 'Recomendação ignorada',
          data: {
            id: updated.id,
            status: updated.status,
            dismissedAt: updated.dismissed_at,
          },
        });
      } catch (error) {
        console.error('[RECOMMENDATIONS-ROUTE] Erro ao ignorar recomendação:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        return reply.status(500).send({
          error: 'Falha ao ignorar recomendação',
          message: errorMessage,
        });
      }
    }
  );

  done();
};

