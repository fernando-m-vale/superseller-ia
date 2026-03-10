import { PrismaClient, Marketplace } from '@prisma/client';
import { MercadoLivreVisitsService } from '../../services/MercadoLivreVisitsService';
import { MercadoLivreOrdersService } from '../../services/MercadoLivreOrdersService';
import { MercadoLivreSyncService } from '../../services/MercadoLivreSyncService';

const prisma = new PrismaClient();
const prismaAny = prisma as any;

type VisitsPayload = {
  periodDays?: number;
};

type OrdersPayload = {
  daysBack?: number;
};

type CatalogPayload = {
  forcePromoPrices?: boolean;
};

function buildDateRange(daysBack: number): { dateFrom: Date; dateTo: Date } {
  const dateTo = new Date();
  dateTo.setUTCHours(23, 59, 59, 999);

  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - daysBack + 1);
  dateFrom.setUTCHours(0, 0, 0, 0);

  return { dateFrom, dateTo };
}

async function touchListings(listingIds: string[]): Promise<void> {
  if (listingIds.length === 0) {
    return;
  }

  await prisma.listing.updateMany({
    where: { id: { in: listingIds } },
    data: {
      last_synced_at: new Date(),
    },
  });
}

export async function handleSyncVisits(
  tenantId: string,
  payload: VisitsPayload = {},
): Promise<void> {
  const periodDays = payload.periodDays ?? 30;
  const { dateFrom, dateTo } = buildDateRange(periodDays);
  const visitsService = new MercadoLivreVisitsService(tenantId);

  const result = await visitsService.syncVisitsByRange(tenantId, dateFrom, dateTo);

  if (!result.success && result.listingsProcessed === 0) {
    throw new Error(result.errors[0] || 'Falha ao sincronizar visitas');
  }

  if (result.listingIds.length > 0) {
    const metrics = await prisma.listingMetricsDaily.groupBy({
      by: ['listing_id'],
      where: {
        tenant_id: tenantId,
        listing_id: { in: result.listingIds },
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _sum: {
        visits: true,
      },
    });

    await prismaAny.listingVisitsHistory.createMany({
      data: metrics.map((metric) => ({
        tenant_id: tenantId,
        listing_id: metric.listing_id,
        period_days: periodDays,
        visits: metric._sum.visits ?? null,
        source: 'sync_visits',
        metadata: {
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
        },
      })),
    });
  }

  await touchListings(result.listingIds);
}

export async function handleSyncOrders(
  tenantId: string,
  payload: OrdersPayload = {},
): Promise<void> {
  const daysBack = payload.daysBack ?? 30;
  const { dateFrom, dateTo } = buildDateRange(daysBack);
  const ordersService = new MercadoLivreOrdersService(tenantId);
  const ordersResult = await ordersService.syncOrders(daysBack);

  if (!ordersResult.success && ordersResult.ordersProcessed === 0) {
    throw new Error(ordersResult.errors[0] || 'Falha ao sincronizar pedidos');
  }

  const listingIds = await prisma.orderItem.findMany({
    where: {
      listing_id: { not: null },
      order: {
        tenant_id: tenantId,
        marketplace: Marketplace.mercadolivre,
        order_date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    },
    select: {
      listing_id: true,
    },
    distinct: ['listing_id'],
  });

  const normalizedListingIds = listingIds
    .map((item) => item.listing_id)
    .filter((listingId): listingId is string => Boolean(listingId));

  if (normalizedListingIds.length > 0) {
    const syncService = new MercadoLivreSyncService(tenantId);
    await syncService.syncOrdersMetricsDaily(tenantId, dateFrom, dateTo, normalizedListingIds);

    const metrics = await prisma.listingMetricsDaily.groupBy({
      by: ['listing_id'],
      where: {
        tenant_id: tenantId,
        listing_id: { in: normalizedListingIds },
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _sum: {
        orders: true,
        gmv: true,
      },
    });

    await prismaAny.listingOrdersHistory.createMany({
      data: metrics.map((metric) => ({
        tenant_id: tenantId,
        listing_id: metric.listing_id,
        date_from: dateFrom,
        date_to: dateTo,
        orders: metric._sum.orders ?? 0,
        gmv: metric._sum.gmv ?? 0,
        source: 'sync_orders',
        metadata: {
          daysBack,
        },
      })),
    });
  }

  await touchListings(normalizedListingIds);
}

async function syncCatalogData(
  tenantId: string,
  source: 'sync_promotions' | 'sync_price',
  payload: CatalogPayload = {},
): Promise<void> {
  const syncService = new MercadoLivreSyncService(tenantId);
  const listings = await prisma.listing.findMany({
    where: {
      tenant_id: tenantId,
      marketplace: Marketplace.mercadolivre,
    },
    select: {
      id: true,
      listing_id_ext: true,
    },
  });

  const chunks: string[][] = [];
  for (let i = 0; i < listings.length; i += 20) {
    chunks.push(listings.slice(i, i + 20).map((listing) => listing.listing_id_ext));
  }

  for (const chunk of chunks) {
    const items = await syncService.fetchItemsDetails(chunk, payload.forcePromoPrices ?? true);
    await syncService.upsertListings(items, undefined, false);
  }

  const refreshedListings = await prisma.listing.findMany({
    where: {
      tenant_id: tenantId,
      marketplace: Marketplace.mercadolivre,
      listing_id_ext: { in: listings.map((listing) => listing.listing_id_ext) },
    },
    select: {
      id: true,
      price: true,
      price_final: true,
      original_price: true,
      discount_percent: true,
      promotion_type: true,
      has_promotion: true,
      promotions_json: true,
    } as any,
  }) as unknown as Array<{
    id: string;
    price: number;
    price_final: number | null;
    original_price: number | null;
    discount_percent: number | null;
    promotion_type: string | null;
    has_promotion: boolean;
    promotions_json: unknown;
  }>;

  if (source === 'sync_price') {
    await prismaAny.listingPriceHistory.createMany({
      data: refreshedListings.map((listing) => ({
        tenant_id: tenantId,
        listing_id: listing.id,
        price: listing.price,
        price_final: listing.price_final,
        original_price: listing.original_price,
        discount_percent: listing.discount_percent,
        promotion_type: listing.promotion_type,
        source,
      })),
    });
  } else {
    await prismaAny.listingPromotionHistory.createMany({
      data: refreshedListings.map((listing) => ({
        tenant_id: tenantId,
        listing_id: listing.id,
        has_promotion: listing.has_promotion,
        promotion_type: listing.promotion_type,
        discount_percent: listing.discount_percent,
        original_price: listing.original_price,
        price_final: listing.price_final,
        promotions_json: listing.promotions_json,
        source,
      })),
    });
  }

  await touchListings(refreshedListings.map((listing) => listing.id));
}

export async function handleSyncPromotions(
  tenantId: string,
  payload: CatalogPayload = {},
): Promise<void> {
  await syncCatalogData(tenantId, 'sync_promotions', payload);
}

export async function handleSyncPrice(
  tenantId: string,
  payload: CatalogPayload = {},
): Promise<void> {
  await syncCatalogData(tenantId, 'sync_price', payload);
}
