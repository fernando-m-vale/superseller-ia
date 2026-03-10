import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  listingMetricsDaily: {
    groupBy: vi.fn(),
  },
  listingVisitsHistory: {
    createMany: vi.fn(),
  },
  listingOrdersHistory: {
    createMany: vi.fn(),
  },
  listingPriceHistory: {
    createMany: vi.fn(),
  },
  listingPromotionHistory: {
    createMany: vi.fn(),
  },
  listing: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  orderItem: {
    findMany: vi.fn(),
  },
};

const visitsServiceMock = {
  syncVisitsByRange: vi.fn(),
};

const ordersServiceMock = {
  syncOrders: vi.fn(),
};

const syncServiceMock = {
  syncOrdersMetricsDaily: vi.fn(),
  fetchItemsDetails: vi.fn(),
  upsertListings: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
  Marketplace: {
    mercadolivre: 'mercadolivre',
  },
  ConnectionStatus: {
    active: 'active',
  },
}));

vi.mock('../services/MercadoLivreVisitsService', () => ({
  MercadoLivreVisitsService: vi.fn(() => visitsServiceMock),
}));

vi.mock('../services/MercadoLivreOrdersService', () => ({
  MercadoLivreOrdersService: vi.fn(() => ordersServiceMock),
}));

vi.mock('../services/MercadoLivreSyncService', () => ({
  MercadoLivreSyncService: vi.fn(() => syncServiceMock),
}));

describe('MarketplaceDataSyncWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executa sync_visits e persiste snapshot de histórico', async () => {
    visitsServiceMock.syncVisitsByRange.mockResolvedValue({
      success: true,
      listingsProcessed: 2,
      rowsUpserted: 6,
      min_date: '2026-03-01',
      max_date: '2026-03-03',
      errors: [],
      duration: 100,
      visits_status: 'ok',
      failures_summary: {},
      listingIds: ['listing-1', 'listing-2'],
    });

    prismaMock.listingMetricsDaily.groupBy.mockResolvedValue([
      { listing_id: 'listing-1', _sum: { visits: 33 } },
      { listing_id: 'listing-2', _sum: { visits: 12 } },
    ]);

    const { handleSyncVisits } = await import('../jobs/handlers/MarketplaceDataSyncWorker');

    await handleSyncVisits('tenant-1', { periodDays: 3 });

    expect(visitsServiceMock.syncVisitsByRange).toHaveBeenCalledTimes(1);
    expect(prismaMock.listingVisitsHistory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ listing_id: 'listing-1', visits: 33, source: 'sync_visits' }),
          expect.objectContaining({ listing_id: 'listing-2', visits: 12, source: 'sync_visits' }),
        ]),
      }),
    );
    expect(prismaMock.listing.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['listing-1', 'listing-2'] } },
      data: { last_synced_at: expect.any(Date) },
    });
  });

  it('executa sync_orders, materializa métricas e mantém histórico', async () => {
    ordersServiceMock.syncOrders.mockResolvedValue({
      success: true,
      ordersProcessed: 4,
      ordersCreated: 2,
      ordersUpdated: 2,
      totalGMV: 1200,
      duration: 120,
      errors: [],
    });

    prismaMock.orderItem.findMany.mockResolvedValue([
      { listing_id: 'listing-1' },
      { listing_id: 'listing-2' },
    ]);

    prismaMock.listingMetricsDaily.groupBy.mockResolvedValue([
      { listing_id: 'listing-1', _sum: { orders: 3, gmv: 900 } },
      { listing_id: 'listing-2', _sum: { orders: 1, gmv: 300 } },
    ]);

    const { handleSyncOrders } = await import('../jobs/handlers/MarketplaceDataSyncWorker');

    await handleSyncOrders('tenant-1', { daysBack: 7 });

    expect(ordersServiceMock.syncOrders).toHaveBeenCalledWith(7);
    expect(syncServiceMock.syncOrdersMetricsDaily).toHaveBeenCalledTimes(1);
    expect(prismaMock.listingOrdersHistory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ listing_id: 'listing-1', orders: 3, source: 'sync_orders' }),
          expect.objectContaining({ listing_id: 'listing-2', orders: 1, source: 'sync_orders' }),
        ]),
      }),
    );
    expect(prismaMock.listing.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['listing-1', 'listing-2'] } },
      data: { last_synced_at: expect.any(Date) },
    });
  });

  it('executa sync_price e persiste histórico de preço sem quebrar upsert', async () => {
    prismaMock.listing.findMany
      .mockResolvedValueOnce([
        { id: 'listing-1', listing_id_ext: 'MLB1' },
        { id: 'listing-2', listing_id_ext: 'MLB2' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'listing-1',
          price: 100,
          price_final: 90,
          original_price: 120,
          discount_percent: 25,
          promotion_type: 'PERCENTAGE',
          has_promotion: true,
          promotions_json: [{ id: 'promo-1' }],
        },
        {
          id: 'listing-2',
          price: 200,
          price_final: 200,
          original_price: null,
          discount_percent: null,
          promotion_type: null,
          has_promotion: false,
          promotions_json: [],
        },
      ]);

    syncServiceMock.fetchItemsDetails.mockResolvedValue([
      { id: 'MLB1', title: 'Item 1' },
      { id: 'MLB2', title: 'Item 2' },
    ]);
    syncServiceMock.upsertListings.mockResolvedValue({ created: 0, updated: 2 });

    const { handleSyncPrice } = await import('../jobs/handlers/MarketplaceDataSyncWorker');

    await handleSyncPrice('tenant-1', { forcePromoPrices: true });

    expect(syncServiceMock.fetchItemsDetails).toHaveBeenCalledWith(['MLB1', 'MLB2'], true);
    expect(syncServiceMock.upsertListings).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      false,
    );
    expect(prismaMock.listingPriceHistory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ listing_id: 'listing-1', discount_percent: 25, source: 'sync_price' }),
          expect.objectContaining({ listing_id: 'listing-2', discount_percent: null, source: 'sync_price' }),
        ]),
      }),
    );
  });
});
