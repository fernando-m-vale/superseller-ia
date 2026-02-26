/**
 * IAScoreService - has_clips como fonte de verdade para midia score
 *
 * Valida que o cálculo de midia score e potential gain usam has_clips
 * (fonte de verdade) e NÃO has_video (legado).
 *
 * Cenários:
 * - Listing COM clip (has_clips=true): deve ganhar 10 pontos de vídeo
 * - Listing SEM clip (has_clips=false): deve perder 10 pontos de vídeo
 * - Listing com clip desconhecido (has_clips=null): deve perder 10 pontos de vídeo
 * - Divergência has_video vs has_clips: has_clips prevalece
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
    has_promotion: false,
    discount_percent: null,
    stock: 10,
    pictures_count: overrides.pictures_count ?? 8,
    has_video: overrides.has_video ?? null,
    has_clips: overrides.has_clips ?? null,
    variations_count: 0,
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

describe('IAScoreService - has_clips como fonte de verdade para midia', () => {
  const tenantId = 'test-tenant';

  beforeEach(() => {
    vi.clearAllMocks();
    // Sem métricas diárias (usar fallback)
    mockFindMany.mockResolvedValue([]);
  });

  it('Listing COM clip (has_clips=true): midia score inclui 10 pontos de vídeo', async () => {
    const listing = createMockListing({ has_clips: true, has_video: true, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    // Midia: 10 (fotos >= 6) + 10 (has_clips = true) = 20
    expect(result.score.breakdown.midia).toBe(20);
    // Potential gain: sem ganho em midia (já está no máximo)
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('Listing SEM clip (has_clips=false): midia score NÃO inclui pontos de vídeo', async () => {
    const listing = createMockListing({ has_clips: false, has_video: false, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    // Midia: 10 (fotos >= 6) + 0 (has_clips = false) = 10
    expect(result.score.breakdown.midia).toBe(10);
    // Potential gain: +10 vídeo
    expect(result.score.potential_gain.midia).toContain('+10');
  });

  it('Listing com clip desconhecido (has_clips=null): midia score NÃO inclui pontos de vídeo E NÃO mostra ganho potencial', async () => {
    const listing = createMockListing({ has_clips: null, has_video: null, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    // Midia: 10 (fotos >= 6) + 0 (has_clips = null, não é true) = 10
    expect(result.score.breakdown.midia).toBe(10);
    // Potential gain: NÃO deve mostrar ganho de clip (null = não detectável via API, limitação da API)
    // Se tem fotos suficientes, não deve mostrar ganho de clip
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('DIVERGÊNCIA: has_video=true mas has_clips=false → has_clips prevalece (0 pontos vídeo)', async () => {
    // Cenário de divergência: has_video ficou true (legado) mas has_clips é false (fonte de verdade)
    const listing = createMockListing({ has_clips: false, has_video: true, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    // has_clips=false deve prevalecer → 0 pontos de vídeo
    // Midia: 10 (fotos >= 6) + 0 (has_clips = false) = 10
    expect(result.score.breakdown.midia).toBe(10);
    expect(result.score.potential_gain.midia).toContain('+10');
  });

  it('DIVERGÊNCIA: has_video=false mas has_clips=true → has_clips prevalece (10 pontos vídeo)', async () => {
    // Cenário de divergência: has_video ficou false (legado) mas has_clips é true (fonte de verdade)
    const listing = createMockListing({ has_clips: true, has_video: false, pictures_count: 8 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    // has_clips=true deve prevalecer → 10 pontos de vídeo
    // Midia: 10 (fotos >= 6) + 10 (has_clips = true) = 20
    expect(result.score.breakdown.midia).toBe(20);
    expect(result.score.potential_gain.midia).toBeUndefined();
  });

  it('Listing SEM clip + poucas fotos: midia score reflete ambos', async () => {
    const listing = createMockListing({ has_clips: false, has_video: false, pictures_count: 4 });
    mockFindFirst.mockResolvedValue(listing);

    const service = new IAScoreService(tenantId);
    const result = await service.calculateScore('test-listing-id');

    // Midia: 5 (fotos >= 3) + 0 (has_clips = false) = 5
    expect(result.score.breakdown.midia).toBe(5);
    // Potential gain: fotos + clip
    expect(result.score.potential_gain.midia).toBeDefined();
    expect(result.score.potential_gain.midia).toContain('+10');
    expect(result.score.potential_gain.midia).toContain('clip');
  });
});
