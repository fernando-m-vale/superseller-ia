import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const prisma = new PrismaClient();

const OutcomeSchema = z.object({
  listingId: z.string().uuid(),
  actionId: z.string(),
  actionType: z.enum(['title_optimization', 'image_audit', 'attribute_completion', 'price_adjustment', 'stock_update']),
  executedAt: z.string().datetime(),
  ctrBefore: z.number().min(0).max(1).optional(),
  ctrAfter: z.number().min(0).max(1).optional(),
  cvrBefore: z.number().min(0).max(1).optional(),
  cvrAfter: z.number().min(0).max(1).optional(),
  revenueBefore: z.number().min(0).optional(),
  revenueAfter: z.number().min(0).optional(),
});

function calculateEffectivenessScore(data: {
  ctrBefore?: number;
  ctrAfter?: number;
  cvrBefore?: number;
  cvrAfter?: number;
  revenueBefore?: number;
  revenueAfter?: number;
}): number | null {
  const improvements: number[] = [];

  if (data.ctrBefore !== undefined && data.ctrAfter !== undefined && data.ctrBefore > 0) {
    const ctrImprovement = ((data.ctrAfter - data.ctrBefore) / data.ctrBefore) * 100;
    improvements.push(ctrImprovement);
  }

  if (data.cvrBefore !== undefined && data.cvrAfter !== undefined && data.cvrBefore > 0) {
    const cvrImprovement = ((data.cvrAfter - data.cvrBefore) / data.cvrBefore) * 100;
    improvements.push(cvrImprovement);
  }

  if (data.revenueBefore !== undefined && data.revenueAfter !== undefined && data.revenueBefore > 0) {
    const revenueImprovement = ((data.revenueAfter - data.revenueBefore) / data.revenueBefore) * 100;
    improvements.push(revenueImprovement);
  }

  if (improvements.length === 0) {
    return null;
  }

  const avgImprovement = improvements.reduce((sum, val) => sum + val, 0) / improvements.length;
  
  const normalizedScore = Math.max(0, Math.min(100, 50 + avgImprovement));
  
  return Math.round(normalizedScore * 100) / 100;
}

export const outcomesRoutes: FastifyPluginCallback = (app, _, done) => {
  app.post('/ai/outcomes', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const body = OutcomeSchema.parse(req.body);

      const effectivenessScore = calculateEffectivenessScore({
        ctrBefore: body.ctrBefore,
        ctrAfter: body.ctrAfter,
        cvrBefore: body.cvrBefore,
        cvrAfter: body.cvrAfter,
        revenueBefore: body.revenueBefore,
        revenueAfter: body.revenueAfter,
      });

      const outcome = await prisma.listingActionOutcome.create({
        data: {
          tenant_id: tenantId,
          listing_id: body.listingId,
          action_id: body.actionId,
          action_type: body.actionType,
          executed_at: new Date(body.executedAt),
          ctr_before: body.ctrBefore,
          ctr_after: body.ctrAfter,
          cvr_before: body.cvrBefore,
          cvr_after: body.cvrAfter,
          revenue_before: body.revenueBefore,
          revenue_after: body.revenueAfter,
          effectiveness_score: effectivenessScore,
        },
      });

      return reply.status(201).send({
        id: outcome.id,
        effectivenessScore: effectivenessScore,
        message: 'Outcome recorded successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request data', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/ai/outcomes', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const { listingId, actionType } = req.query as { listingId?: string; actionType?: string };

      const where: {
        tenant_id: string;
        listing_id?: string;
        action_type?: 'title_optimization' | 'image_audit' | 'attribute_completion' | 'price_adjustment' | 'stock_update';
      } = { tenant_id: tenantId };
      
      if (listingId) {
        where.listing_id = listingId;
      }
      if (actionType && ['title_optimization', 'image_audit', 'attribute_completion', 'price_adjustment', 'stock_update'].includes(actionType)) {
        where.action_type = actionType as 'title_optimization' | 'image_audit' | 'attribute_completion' | 'price_adjustment' | 'stock_update';
      }

      const outcomes = await prisma.listingActionOutcome.findMany({
        where,
        orderBy: { executed_at: 'desc' },
        take: 100,
      });

      return reply.send({
        items: outcomes.map(o => ({
          id: o.id,
          listingId: o.listing_id,
          actionId: o.action_id,
          actionType: o.action_type,
          executedAt: o.executed_at,
          ctrBefore: o.ctr_before,
          ctrAfter: o.ctr_after,
          cvrBefore: o.cvr_before,
          cvrAfter: o.cvr_after,
          revenueBefore: o.revenue_before,
          revenueAfter: o.revenue_after,
          effectivenessScore: o.effectiveness_score,
          createdAt: o.created_at,
        })),
        total: outcomes.length,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  done();
};
