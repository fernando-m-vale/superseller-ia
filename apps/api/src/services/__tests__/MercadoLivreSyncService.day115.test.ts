import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    listing: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    listingContentHistory: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
  Marketplace: {
    mercadolivre: 'mercadolivre',
  },
  ConnectionStatus: {
    active: 'active',
  },
  ListingStatus: {
    active: 'active',
    paused: 'paused',
    closed: 'closed',
  },
  OrderStatus: {},
  ListingAccessStatus: {
    accessible: 'accessible',
    unauthorized: 'unauthorized',
    blocked_by_policy: 'blocked_by_policy',
  },
}));

vi.mock('../ScoreCalculator', () => ({
  ScoreCalculator: {
    calculate: vi.fn(() => ({
      total: 82,
      cadastro: 20,
      trafego: 32,
      disponibilidade: 30,
      details: { source: 'test' },
    })),
  },
}));

vi.mock('../../utils/ml-video-extractor', () => ({
  extractHasVideoFromMlItem: vi.fn(() => ({
    hasVideo: false,
    isDetectable: true,
    evidence: [],
    clipsEvidence: [],
  })),
  classifyMlClipStatus: vi.fn(() => ({
    clipStatus: 'not_detected',
    reason: 'test',
    signals: [],
  })),
}));

import { MercadoLivreSyncService } from '../MercadoLivreSyncService';

describe('MercadoLivreSyncService - DIA 11.5', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.listing.findUnique.mockResolvedValue(null);
    prismaMock.listing.create.mockResolvedValue({ id: 'listing-1' });
    prismaMock.listing.update.mockResolvedValue({ id: 'listing-1' });
    prismaMock.listingContentHistory.create.mockResolvedValue({ id: 'history-1' });
  });

  it('persiste shipping, atributos comerciais, pricing semântico e snapshot de conteúdo', async () => {
    const service = new MercadoLivreSyncService('tenant-1');
    (service as any).fetchItemSellerId = vi.fn().mockResolvedValue({
      sellerId: 'seller-1',
      isUnauthorized: false,
    });

    await service.upsertListings([
      {
        id: 'MLB123',
        title: 'Notebook Gamer Acme Turbo X',
        price: 899.9,
        available_quantity: 5,
        permalink: 'https://example.com/item',
        thumbnail: 'https://img.example.com/thumb.jpg',
        status: 'active',
        category_id: 'MLB1234',
        listing_type_id: 'gold_special',
        condition: 'new',
        warranty: '12 meses',
        quality_grade: 'good',
        sub_status: ['warning'],
        descriptions: [{ id: 'desc-1', plain_text: 'Descricao completa do produto' }],
        pictures: [{ id: 'pic-1', secure_url: 'https://img.example.com/main.jpg' }],
        attributes: [
          { id: 'BRAND', value_name: 'Acme' },
          { id: 'MODEL', value_name: 'Turbo X' },
          { id: 'GTIN', value_name: '7890000000001' },
        ],
        shipping: {
          free_shipping: true,
          mode: 'me2',
          logistic_type: 'fulfillment',
        },
        tags: ['fulfillment'],
        original_price: 999.9,
        sale_price: 899.9,
        promotions: [
          {
            id: 'promo-1',
            type: 'PRICE_DISCOUNT',
            discount_percent: 10,
            start_date: '2026-03-10T12:00:00.000Z',
            end_date: '2026-03-20T12:00:00.000Z',
          },
        ],
        questions: { total: 6 },
        reviews: { total: 24, rating_average: 4.7 },
        seller_reputation: { level: '5_green' },
      },
    ] as any[]);

    expect(prismaMock.listing.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listing_id_ext: 'MLB123',
          tenant_id: 'tenant-1',
          is_free_shipping: true,
          shipping_mode: 'me2',
          logistic_type: 'fulfillment',
          is_full_eligible: true,
          listing_type_id: 'gold_special',
          brand: 'Acme',
          model: 'Turbo X',
          gtin: '7890000000001',
          condition: 'new',
          warranty: '12 meses',
          quality_grade: 'good',
          moderation_status: 'active',
          moderation_sub_status: 'warning',
          price_base: 999.9,
          price_effective: 899.9,
          promo_id: 'promo-1',
          has_promotion: true,
          discount_percent: 10,
          price: 899.9,
          questions_count: 6,
          reviews_count: 24,
          rating_average: 4.7,
        }),
        select: { id: true },
      }),
    );

    expect(prismaMock.listingContentHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: 'tenant-1',
          listing_id: 'listing-1',
          title: 'Notebook Gamer Acme Turbo X',
          pictures_count: 1,
          main_image_url: 'https://img.example.com/main.jpg',
          has_clips: null,
          category_id: 'MLB1234',
          brand: 'Acme',
          model: 'Turbo X',
          gtin: '7890000000001',
          is_free_shipping: true,
          shipping_mode: 'me2',
          is_full_eligible: true,
          description_hash: expect.any(String),
        }),
      }),
    );
  });
});
