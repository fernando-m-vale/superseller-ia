/**
 * apps/api/src/lib/freshness-check.ts
 *
 * Antes de rodar a análise de IA, verifica se os dados do listing
 * foram atualizados nas últimas 24h.
 */

import { ConnectionStatus, ListingStatus, Marketplace, PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()

const FRESHNESS_THRESHOLD_HOURS = 24

export interface FreshnessResult {
  wasFresh: boolean
  refreshed: boolean
  skipped: boolean
  ageHours: number
  error?: string
}

export async function ensureListingFreshness(
  listingId: string,
  tenantId: string
): Promise<FreshnessResult> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, tenant_id: tenantId },
    select: {
      id: true,
      listing_id_ext: true,
      updated_at: true,
      status: true,
    },
  })

  if (!listing) {
    return { wasFresh: false, refreshed: false, skipped: false, ageHours: 0, error: 'Listing não encontrado' }
  }

  if (listing.status !== ListingStatus.active) {
    return { wasFresh: true, refreshed: false, skipped: true, ageHours: 0 }
  }

  const ageHours =
    (Date.now() - new Date(listing.updated_at).getTime()) / (1000 * 60 * 60)

  if (ageHours <= FRESHNESS_THRESHOLD_HOURS) {
    console.info(
      `[Freshness] Listing ${listing.listing_id_ext} está fresco (${ageHours.toFixed(1)}h). OK.`
    )
    return { wasFresh: true, refreshed: false, skipped: false, ageHours }
  }

  console.info(
    `[Freshness] Listing ${listing.listing_id_ext} desatualizado (${ageHours.toFixed(1)}h > ${FRESHNESS_THRESHOLD_HOURS}h). Rodando force-refresh.`
  )

  try {
    await refreshSingleListing(listing.listing_id_ext, tenantId)
    console.info(`[Freshness] Refresh concluído para ${listing.listing_id_ext}.`)
    return { wasFresh: false, refreshed: true, skipped: false, ageHours }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.warn(
      `[Freshness] Refresh falhou para ${listing.listing_id_ext}: ${errorMsg}. Prosseguindo com análise dos dados existentes.`
    )
    return { wasFresh: false, refreshed: false, skipped: false, ageHours, error: errorMsg }
  }
}

async function refreshSingleListing(
  listingIdExt: string,
  tenantId: string
): Promise<void> {
  const connection = await prisma.marketplaceConnection.findFirst({
    where: {
      tenant_id: tenantId,
      type: Marketplace.mercadolivre,
      status: ConnectionStatus.active,
    },
    select: { access_token: true, refresh_token: true, expires_at: true },
  })

  if (!connection?.access_token) {
    throw new Error('Tenant sem token de acesso ao Mercado Livre')
  }

  const tokenIsExpired =
    connection.expires_at &&
    new Date(connection.expires_at).getTime() < Date.now() + 5 * 60 * 1000

  if (tokenIsExpired) {
    throw new Error(
      'Token do Mercado Livre expirado. Usuário precisa reconectar a conta.'
    )
  }

  const mlResponse = await axios.get(
    `https://api.mercadolibre.com/items/${listingIdExt}`,
    {
      headers: { Authorization: `Bearer ${connection.access_token}` },
      timeout: 15000,
    }
  )

  const item = mlResponse.data
  const normalizedStatus = normalizeMLStatus(item.status)

  await prisma.listing.updateMany({
    where: { listing_id_ext: listingIdExt, tenant_id: tenantId },
    data: {
      title: item.title,
      price: item.price ?? 0,
      stock: item.available_quantity ?? 0,
      status: normalizedStatus,
      updated_at: new Date(),
    },
  })
}

function normalizeMLStatus(mlStatus: string): ListingStatus {
  switch (mlStatus) {
    case 'active':
      return ListingStatus.active
    case 'paused':
      return ListingStatus.paused
    case 'closed':
    case 'inactive':
    case 'under_review':
    default:
      return ListingStatus.deleted
  }
}
