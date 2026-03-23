/**
 * apps/api/src/routes/sync-scheduler.ts
 *
 * Endpoints exclusivos para chamadas internas do scheduler/login sync.
 * Protegidos por SCHEDULER_SERVICE_TOKEN.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ConnectionStatus, Marketplace, PrismaClient } from '@prisma/client'
import { triggerFullSync } from './mercadolivre'

const prisma = new PrismaClient()

interface SchedulerBody {
  source?: string
}

interface TenantParams {
  tenantId: string
}

interface TenantSyncResult {
  tenantId: string
  status: 'success' | 'error'
  duration: number
  error?: string
}

export async function syncSchedulerRoutes(app: FastifyInstance) {
  app.post<{ Params: TenantParams; Body: SchedulerBody }>(
    '/tenant/:tenantId/full',
    { preHandler: validateServiceToken },
    async (request, reply) => {
      const { tenantId } = request.params
      const source = request.body?.source ?? 'unknown'
      const startedAt = Date.now()

      app.log.info({ tenantId, source }, '[SchedulerSync] Sync individual iniciado')

      try {
        await syncOneTenant(tenantId)

        await prisma.marketplaceConnection.updateMany({
          where: { tenant_id: tenantId, type: Marketplace.mercadolivre },
          data: { last_synced_at: new Date() },
        })

        return reply.send({
          message: 'Sync do tenant concluído',
          tenantId,
          durationMs: Date.now() - startedAt,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        app.log.error({ tenantId, err }, '[SchedulerSync] Erro no sync individual')
        return reply.status(500).send({
          error: 'Tenant sync failed',
          tenantId,
          message: errorMsg,
        })
      }
    }
  )

  app.post<{ Body: SchedulerBody }>(
    '/all-tenants/full',
    { preHandler: validateServiceToken },
    async (request, reply) => {
      const source = request.body?.source ?? 'unknown'
      const startedAt = Date.now()

      app.log.info(`[SchedulerSync] Sync semanal iniciado. Fonte: ${source}`)

      const activeConnections = await prisma.marketplaceConnection.findMany({
        where: { status: ConnectionStatus.active, type: Marketplace.mercadolivre },
        select: { tenant_id: true },
        distinct: ['tenant_id'],
      })

      const tenantIds = activeConnections.map((c) => c.tenant_id)
      const results: TenantSyncResult[] = []

      for (const tenantId of tenantIds) {
        const tenantStart = Date.now()

        try {
          await syncOneTenant(tenantId)

          await prisma.marketplaceConnection.updateMany({
            where: { tenant_id: tenantId, type: Marketplace.mercadolivre },
            data: { last_synced_at: new Date() },
          })

          results.push({
            tenantId,
            status: 'success',
            duration: Date.now() - tenantStart,
          })
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          app.log.error({ tenantId, err }, '[SchedulerSync] Erro no tenant')
          results.push({
            tenantId,
            status: 'error',
            duration: Date.now() - tenantStart,
            error: errorMsg,
          })
        }

        if (tenantIds.indexOf(tenantId) < tenantIds.length - 1) {
          await sleep(2000)
        }
      }

      const successCount = results.filter((r) => r.status === 'success').length
      const errorCount = results.filter((r) => r.status === 'error').length
      const totalDurationMs = Date.now() - startedAt

      return reply.send({
        message: 'Sync semanal concluído',
        summary: {
          total: tenantIds.length,
          success: successCount,
          errors: errorCount,
          durationMs: totalDurationMs,
        },
        results,
      })
    }
  )
}

async function validateServiceToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const serviceToken = process.env.SCHEDULER_SERVICE_TOKEN

  if (!serviceToken) {
    request.log.error('[SchedulerSync] SCHEDULER_SERVICE_TOKEN não configurado!')
    return reply.status(503).send({ error: 'Scheduler não configurado' })
  }

  const authHeader = request.headers.authorization
  const providedToken = authHeader?.replace('Bearer ', '')

  if (!providedToken || providedToken !== serviceToken) {
    request.log.warn('[SchedulerSync] Token inválido na requisição de sync')
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

async function syncOneTenant(tenantId: string): Promise<void> {
  const connection = await prisma.marketplaceConnection.findFirst({
    where: {
      tenant_id: tenantId,
      status: ConnectionStatus.active,
      type: Marketplace.mercadolivre,
    },
    select: { id: true },
  })

  if (!connection) {
    throw new Error('Sem conexão ativa para este tenant')
  }

  await triggerFullSync(tenantId)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
