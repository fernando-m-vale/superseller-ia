/**
 * apps/api/src/lib/sync-on-login.ts
 *
 * Dispara sync completo do Mercado Livre após login do usuário.
 * Roda no máximo 1x por dia por tenant, usando MarketplaceConnection.last_synced_at.
 * Executa em background e não bloqueia a resposta do login.
 */

import { ConnectionStatus, Marketplace, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SyncResult {
  skipped: boolean
  reason?: string
}

export function triggerLoginSyncIfNeeded(
  tenantId: string,
  apiBaseUrl: string,
  serviceToken: string
): void {
  setImmediate(() => {
    runSyncForTenant(tenantId, apiBaseUrl, serviceToken).catch((err) => {
      console.error(`[LoginSync] Erro inesperado no tenant ${tenantId}:`, err)
    })
  })
}

async function runSyncForTenant(
  tenantId: string,
  apiBaseUrl: string,
  serviceToken: string
): Promise<SyncResult> {
  const connection = await prisma.marketplaceConnection.findFirst({
    where: {
      tenant_id: tenantId,
      status: ConnectionStatus.active,
      type: Marketplace.mercadolivre,
    },
    select: {
      id: true,
      last_synced_at: true,
    },
  })

  if (!connection) {
    console.info(`[LoginSync] Tenant ${tenantId} sem conexão ativa. Pulando.`)
    return { skipped: true, reason: 'no_active_connection' }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const alreadySyncedToday =
    connection.last_synced_at !== null &&
    connection.last_synced_at >= todayStart

  if (alreadySyncedToday) {
    console.info(
      `[LoginSync] Tenant ${tenantId} já sincronizou hoje às ${connection.last_synced_at!.toISOString()}. Pulando.`
    )
    return { skipped: true, reason: 'already_synced_today' }
  }

  console.info(`[LoginSync] Iniciando sync para tenant ${tenantId}`)
  const startedAt = Date.now()

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/sync/tenant/${tenantId}/full`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
        },
        body: JSON.stringify({ source: 'login_sync' }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Sync retornou ${response.status}: ${errorBody}`)
    }

    const result = (await response.json()) as {
      data?: { listings?: { itemsProcessed?: number } }
    }
    const durationMs = Date.now() - startedAt

    await prisma.marketplaceConnection.update({
      where: { id: connection.id },
      data: { last_synced_at: new Date() },
    })

    console.info(
      `[LoginSync] Sync concluído para tenant ${tenantId} em ${durationMs}ms.`,
      {
        listingsProcessed: result?.data?.listings?.itemsProcessed ?? 'n/a',
      }
    )

    return { skipped: false }
  } catch (err) {
    console.error(`[LoginSync] Erro no sync do tenant ${tenantId}:`, err)
    return { skipped: false }
  }
}
