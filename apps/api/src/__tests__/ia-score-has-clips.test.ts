/**
 * IAScoreService - clip não altera score seller-facing de mídia
 *
 * Valida que o cálculo seller-facing de mídia considera apenas a galeria.
 *
 * Cenários:
 * - has_clips não deve mudar o score exibido
 * - has_video legado também não deve influenciar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma antes de importar o service
vi.mock('@prisma/client', () => {
  const mockFindFirst = vi.fn();
  const mockFindMany = vi.fn();
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      listing: { findFirst: mockFindFirst },
      listingMetricsDaily: { findMany: mockFindMany },
    })),
    __mockFindFirst: mockFindFirst,
    __mockFindMany: mockFindMany,
  };
});

import { IAScoreService } from '../services/IAScoreService';

// Obter referências aos mocks
const { __mockFindFirst: mockFindFirst, __mockFindMany: mockFindMany } = await import('@prisma/client') as any;

/**
 * Helper: cria um listing mock com campos obrigatórios
 */
function createMockListing(overrides: {
  has_clips?: boolean | null;
  has_video?: boolean | null;
  pictures_count?: number | null;
  is_free_shipping?: boolean | null;
  is_full_eligible?: boolean | null;
  reviews_count?: number | null;
  rating_average?: number | null;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
  warranty?: string | null;
}) {
  return {
    id: 'test-listing-id',
    tenant_id: 'test-tenant',
    marketplace: 'mercadolivre',
    listing_id_ext: 'MLB1234567890',
    title: 'Produto Teste com título longo o suficiente',
    description: 'Descrição detalhada do produto que tem mais de 200 caracteres. '.repeat(5),
    status: 'active',
    category: 'MLB1234',
    price: 100,
    original_price: null,
    price_base: null,
    price_effective: null,
    has_promotion: false,
    discount_percent: null,
    stock: 10,
    pictures_count: overrides.pictures_count ?? 8,
    has_video: overrides.has_video ?? null,
    has_clips: overrides.has_clips ?? null,
    variations_count: 0,
    is_free_shipping: overrides.is_free_shipping ?? null,
    is_full_eligible: overrides.is_full_eligible ?? null,
    reviews_count: overrides.reviews_count ?? null,
    rating_average: overrides.rating_average ?? null,
    brand: overrides.brand ?? null,
    model: overrides.model ?? null,
    gtin: overrides.gtin ?? null,
    warranty: overrides.warranty ?? null,
    visits_last_7d: 100,
    sales_last_7d: 5,
    created_at: new Date(),
    updated_at: new Date(),
    // Campos extras para evitar erros do Prisma mock
    thumbnail_url: null,
    pictures_json: null,
    health_score: null,
    super_seller_score: null,
    score_breakdown: null,
    seller_id: null,
    promotion_checked_at: null,
    price_final: null,
    access_status: 'accessible',
    access_blocked_code: null,
    access_blocked_reason: null,
  };
}

describe('IAScoreService - mídia seller-facing sem clip', () => {
  const tenantId = 'test-tenant';

  beforeEach(() => {
    vi.clearAllMocks();
    // Sem métricas diárias (usar fallback)
    mockFindMany.mockResolvedValue([]);
  });

  it('Listing COM clip (has_clips=true): midia score depende só das fotos', async () => {
    const listing = createMockListing({ has_clips: true, has_video: true, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    expect(result.score.breakdown.midia).toBe(10);
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('Listing SEM clip (has_clips=false): midia score segue igual com fotos fortes', async () => {
    const listing = createMockListing({ has_clips: false, has_video: false, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    expect(result.score.breakdown.midia).toBe(10);
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('Listing com clip desconhecido (has_clips=null): midia score também não muda', async () => {
    const listing = createMockListing({ has_clips: null, has_video: null, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    expect(result.score.breakdown.midia).toBe(10);
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('DIVERGÊNCIA: has_video=true mas has_clips=false → score seller-facing permanece igual', async () => {
    const listing = createMockListing({ has_clips: false, has_video: true, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    expect(result.score.breakdown.midia).toBe(10);
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('DIVERGÊNCIA: has_video=false mas has_clips=true → score seller-facing permanece igual', async () => {
    const listing = createMockListing({ has_clips: true, has_video: false, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    expect(result.score.breakdown.midia).toBe(10);
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('Listing com poucas fotos: midia score reflete só a galeria', async () => {
    const listing = createMockListing({ has_clips: false, has_video: false, pictures_count: 4 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    expect(result.score.breakdown.midia).toBe(5);
    expect(result.score.potential_gain.midia).toContain('+10');
    expect(result.score.potential_gain.midia?.toLowerCase()).not.toContain('clip');
  });

  it('incorpora logística real, prova social e atributos comerciais no score', async () => {
    const listing = createMockListing({
      has_clips: true,
      pictures_count: 8,
      is_free_shipping: true,
      is_full_eligible: true,
      reviews_count: 40,
      rating_average: 4.9,
      brand: 'Acme',
      model: 'Turbo X',
      gtin: '7890000000001',
      warranty: '12 meses',
    });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    expect(result.score.breakdown.cadastro).toBe(20);
    expect(result.score.breakdown.competitividade).toBe(10);
  });
});
