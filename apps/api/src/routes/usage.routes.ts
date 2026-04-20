import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authGuard } from '../plugins/auth';
import { checkFreeAnalysisLimit } from '../lib/plan-guard';

const prisma = new PrismaClient();

export async function usageRoutes(app: FastifyInstance) {
  // GET /api/v1/usage/summary — uso de análises do tenant no mês corrente
  app.get('/summary', { preHandler: [authGuard] }, async (request, reply) => {
    const tenantId = (request as any).tenantId;

    const result = await checkFreeAnalysisLimit(tenantId, prisma);

    return reply.send({
      analysesThisMonth: result.used,
      // null = ilimitado (plano pro)
      analysesLimit: result.limit === Infinity ? null : result.limit,
      allowed: result.allowed,
    });
  });
}
