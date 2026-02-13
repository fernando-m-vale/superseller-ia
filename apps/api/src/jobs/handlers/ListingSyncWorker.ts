/**
 * DIA 08: ListingSyncWorker
 * 
 * Handler para job LISTING_SYNC.
 * Sincroniza métricas (30d), promo e clips de um listing específico.
 */

import { PrismaClient, SyncStatus, Marketplace } from '@prisma/client';
import { MercadoLivreSyncService } from '../../services/MercadoLivreSyncService';
import { MercadoLivreVisitsService } from '../../services/MercadoLivreVisitsService';
import { MercadoLivreOrdersService } from '../../services/MercadoLivreOrdersService';

const prisma = new PrismaClient();

interface ListingSyncPayload {
  listingId: string;
  listingIdExt: string;
  periodDays: number;
}

export async function handleListingSync(
  tenantId: string,
  payload: ListingSyncPayload
): Promise<void> {
  const startTime = Date.now();
  const { listingId, listingIdExt, periodDays } = payload;

  try {
    // Marcar listing como running
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        last_sync_status: SyncStatus.running,
        last_sync_error: null,
      },
    });

    // Buscar listing para verificar marketplace
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        marketplace: true,
        tenant_id: true,
      },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} não encontrado`);
    }

    if (listing.marketplace !== Marketplace.mercadolivre) {
      // Por enquanto só suportamos ML
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          last_sync_status: SyncStatus.success,
          last_synced_at: new Date(),
          last_sync_error: null,
        },
      });
      return;
    }

    // 1. Sync de promo (reusar MercadoLivreSyncService)
    const syncService = new MercadoLivreSyncService(tenantId);
    const items = await syncService.fetchItemsDetails([listingIdExt], true); // forcePromoPrices = true
    
    if (items.length > 0) {
      // Upsert apenas este listing (sem alterar source/discovery_blocked)
      await syncService.upsertListings(items, undefined, false);
    }

    // 2. Sync de métricas (30 dias)
    // Nota: syncVisitsByRange processa todos os listings do tenant
    // Para um listing específico, vamos usar fetchVisitsTimeWindow e persistir manualmente
    const visitsService = new MercadoLivreVisitsService(tenantId);

    // Buscar visitas do item específico
    const visitsFetchResult = await visitsService.fetchVisitsTimeWindow(listingIdExt, periodDays);
    
    if (visitsFetchResult.ok && visitsFetchResult.visits.length > 0) {
      // Persistir visitas no banco (upsert em listing_metrics_daily)
      for (const visit of visitsFetchResult.visits) {
        const visitDate = new Date(visit.date + 'T00:00:00Z');
        
        await prisma.listingMetricsDaily.upsert({
          where: {
            tenant_id_listing_id_date: {
              tenant_id: tenantId,
              listing_id: listingId,
              date: visitDate,
            },
          },
          update: {
            visits: visit.visits,
            source: 'ml_visits_period',
            period_days: periodDays,
          },
          create: {
            tenant_id: tenantId,
            listing_id: listingId,
            date: visitDate,
            visits: visit.visits,
            orders: 0,
            gmv: 0,
            source: 'ml_visits_period',
            period_days: periodDays,
          },
        });
      }

      // Sync orders (para preencher orders/gmv nas métricas)
      // Calcular range de datas
      const dateTo = new Date();
      dateTo.setUTCHours(23, 59, 59, 999);
      const dateFrom = new Date(dateTo);
      dateFrom.setUTCDate(dateFrom.getUTCDate() - periodDays);
      dateFrom.setUTCHours(0, 0, 0, 0);

      await syncService.syncOrdersMetricsDaily(
        tenantId,
        dateFrom,
        dateTo,
        [listingId]
      );
    }

    // 3. Clips já são sincronizados pelo upsertListings acima (via ml-video-extractor)

    const duration = Date.now() - startTime;

    // Marcar como sucesso
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        last_sync_status: SyncStatus.success,
        last_synced_at: new Date(),
        last_sync_error: null,
      },
    });

    // Log em dev ou com x-debug
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === '1') {
      console.log(`[LISTING_SYNC] Concluído listingId=${listingId} listingIdExt=${listingIdExt} duration=${duration}ms`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const duration = Date.now() - startTime;

    // Tratar erros específicos (403/429 não devem apagar dados antigos)
    let syncStatus = SyncStatus.error;
    let errorToSave = errorMessage;

    if (error instanceof Error) {
      // Se for erro de permissão/rate limit, manter dados antigos
      if (errorMessage.includes('403') || errorMessage.includes('429') || errorMessage.includes('FORBIDDEN')) {
        errorToSave = `Erro de acesso (${errorMessage}). Dados anteriores mantidos.`;
      }
    }

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        last_sync_status: syncStatus,
        last_sync_error: errorToSave,
      },
    });

    console.error(`[LISTING_SYNC] Erro listingId=${listingId} duration=${duration}ms`, error);
    throw error;
  }
}
