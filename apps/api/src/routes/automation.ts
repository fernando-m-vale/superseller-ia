import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const prisma = new PrismaClient();

const CreateRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  ctrThreshold: z.number().min(0).max(1).optional(),
  cvrThreshold: z.number().min(0).max(1).optional(),
  revenueImpactMin: z.number().min(0).optional(),
  dryRun: z.boolean().default(true),
});

const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ctrThreshold: z.number().min(0).max(1).optional(),
  cvrThreshold: z.number().min(0).max(1).optional(),
  revenueImpactMin: z.number().min(0).optional(),
  dryRun: z.boolean().optional(),
});

interface ActionCandidate {
  id: string;
  listingId: string;
  type: string;
  ctr?: number;
  cvr?: number;
  revenueImpact?: number;
}

function evaluateRule(rule: {
  ctr_threshold: { toNumber(): number } | null;
  cvr_threshold: { toNumber(): number } | null;
  revenue_impact_min: { toNumber(): number } | null;
}, action: ActionCandidate): boolean {
  if (rule.ctr_threshold !== null && action.ctr !== undefined) {
    const threshold = rule.ctr_threshold.toNumber();
    if (action.ctr >= threshold) {
      return false;
    }
  }

  if (rule.cvr_threshold !== null && action.cvr !== undefined) {
    const threshold = rule.cvr_threshold.toNumber();
    if (action.cvr >= threshold) {
      return false;
    }
  }

  if (rule.revenue_impact_min !== null && action.revenueImpact !== undefined) {
    const threshold = rule.revenue_impact_min.toNumber();
    if (action.revenueImpact < threshold) {
      return false;
    }
  }

  return true;
}

export const automationRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/automation/rules', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;

      const rules = await prisma.autoApproveRule.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
      });

      return reply.send({
        items: rules.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
          ctrThreshold: r.ctr_threshold?.toNumber() ?? null,
          cvrThreshold: r.cvr_threshold?.toNumber() ?? null,
          revenueImpactMin: r.revenue_impact_min?.toNumber() ?? null,
          dryRun: r.dry_run,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        total: rules.length,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/automation/rules', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const body = CreateRuleSchema.parse(req.body);

      const rule = await prisma.autoApproveRule.create({
        data: {
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          ctr_threshold: body.ctrThreshold,
          cvr_threshold: body.cvrThreshold,
          revenue_impact_min: body.revenueImpactMin,
          dry_run: body.dryRun,
        },
      });

      app.log.info({ ruleId: rule.id, tenantId, dryRun: rule.dry_run }, 'Auto-approve rule created');

      return reply.status(201).send({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        status: rule.status,
        ctrThreshold: rule.ctr_threshold?.toNumber() ?? null,
        cvrThreshold: rule.cvr_threshold?.toNumber() ?? null,
        revenueImpactMin: rule.revenue_impact_min?.toNumber() ?? null,
        dryRun: rule.dry_run,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request data', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.patch('/automation/rules/:id', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const { id } = req.params as { id: string };
      const body = UpdateRuleSchema.parse(req.body);

      const rule = await prisma.autoApproveRule.update({
        where: { id, tenant_id: tenantId },
        data: {
          name: body.name,
          description: body.description,
          status: body.status,
          ctr_threshold: body.ctrThreshold,
          cvr_threshold: body.cvrThreshold,
          revenue_impact_min: body.revenueImpactMin,
          dry_run: body.dryRun,
        },
      });

      app.log.info({ ruleId: rule.id, tenantId, changes: body }, 'Auto-approve rule updated');

      return reply.send({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        status: rule.status,
        ctrThreshold: rule.ctr_threshold?.toNumber() ?? null,
        cvrThreshold: rule.cvr_threshold?.toNumber() ?? null,
        revenueImpactMin: rule.revenue_impact_min?.toNumber() ?? null,
        dryRun: rule.dry_run,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request data', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.delete('/automation/rules/:id', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const { id } = req.params as { id: string };

      await prisma.autoApproveRule.delete({
        where: { id, tenant_id: tenantId },
      });

      app.log.info({ ruleId: id, tenantId }, 'Auto-approve rule deleted');

      return reply.status(204).send();
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/automation/evaluate', async (req, reply) => {
    try {
      const tenantId = (req as RequestWithTenant).tenantId;
      const { actions } = req.body as { actions: ActionCandidate[] };

      const rules = await prisma.autoApproveRule.findMany({
        where: { tenant_id: tenantId, status: 'active' },
      });

      if (rules.length === 0) {
        return reply.send({
          autoApproved: [],
          manualReview: actions.map(a => a.id),
          dryRun: false,
        });
      }

      const autoApproved: string[] = [];
      const manualReview: string[] = [];
      const isDryRun = rules.some(r => r.dry_run);

      for (const action of actions) {
        let shouldAutoApprove = false;

        for (const rule of rules) {
          if (evaluateRule(rule, action)) {
            shouldAutoApprove = true;
            app.log.info(
              { actionId: action.id, ruleId: rule.id, dryRun: rule.dry_run },
              'Action matched auto-approve rule'
            );
            break;
          }
        }

        if (shouldAutoApprove) {
          if (isDryRun) {
            app.log.info({ actionId: action.id }, 'Action would be auto-approved (dry-run mode)');
          }
          autoApproved.push(action.id);
        } else {
          manualReview.push(action.id);
        }
      }

      return reply.send({
        autoApproved,
        manualReview,
        dryRun: isDryRun,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  done();
};
