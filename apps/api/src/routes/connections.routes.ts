import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

export async function connectionsRoutes(app: FastifyInstance) {
  // GET /auth/connections — listar todas as conexões do tenant
  app.get('/connections', { preHandler: [authGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;

    const connections = await prisma.marketplaceConnection.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        type: true,
        provider_account_id: true,
        nickname: true,
        status: true,
        last_synced_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { active_connection_id: true },
    });

    return reply.send({
      connections,
      activeConnectionId: tenant?.active_connection_id ?? null,
      isViewingAll: tenant?.active_connection_id === null,
    });
  });

  // PUT /auth/connections/active — trocar conta ativa (null = ver todas)
  app.put('/connections/active', { preHandler: [authGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const { connectionId } = (request.body ?? {}) as { connectionId: string | null };

    if (connectionId) {
      const conn = await prisma.marketplaceConnection.findFirst({
        where: { id: connectionId, tenant_id: tenantId },
      });
      if (!conn) return reply.status(404).send({ error: 'Conexão não encontrada' });
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { active_connection_id: connectionId ?? null },
    });

    return reply.send({ ok: true, activeConnectionId: connectionId ?? null });
  });

  // DELETE /auth/connections/:id — remover uma conexão
  app.delete('/connections/:id', { preHandler: [authGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const conn = await prisma.marketplaceConnection.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!conn) return reply.status(404).send({ error: 'Conexão não encontrada' });

    const count = await prisma.marketplaceConnection.count({ where: { tenant_id: tenantId } });
    if (count <= 1) {
      return reply.status(400).send({ error: 'Não é possível remover a única conta conectada' });
    }

    await prisma.marketplaceConnection.delete({ where: { id } });

    // Se era a conta ativa, limpar active_connection_id
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { active_connection_id: true },
    });
    if (tenant?.active_connection_id === id) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { active_connection_id: null },
      });
    }

    return reply.send({ ok: true });
  });
}
