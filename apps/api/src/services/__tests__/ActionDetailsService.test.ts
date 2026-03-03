import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListingActionDetailStatus } from '@prisma/client';
import { ActionDetailsService } from '../ActionDetailsService';

const baseAction = {
  id: 'action-1',
  listingId: 'listing-1',
  actionKey: 'seo_title_refresh',
  title: 'Atualizar título',
  description: 'Descrição curta',
  expectedImpact: 'high',
  priority: 'high',
  batchId: 'batch-1',
  listing: {
    tenant_id: 'tenant-1',
    listing_id_ext: 'MLB123',
    title: 'Produto X',
    category: 'Categoria > Sub',
    price: 100,
    price_final: 90,
    original_price: 100,
    has_promotion: true,
    discount_percent: 10,
  },
};

const generatedPayload = {
  summary: 'Resumo',
  rationale: 'Racional',
  howToSteps: ['1', '2', '3'],
  doThisNow: ['a', 'b', 'c'],
  titleSuggestions: ['t1', 't2', 't3'],
  descriptionTemplateBlocks: ['b1', 'b2'],
  benchmark: {
    available: false,
    explanation: 'Sem benchmark',
    estimationHeuristics: ['h1'],
  },
  confirmBeforeApplying: ['confirmar atributo antes'],
};

describe('ActionDetailsService', () => {
  const prismaMock = {
    listingAction: { findFirst: vi.fn() },
    listingActionDetail: { findUnique: vi.fn(), upsert: vi.fn() },
    listingMetricsDaily: { findMany: vi.fn() },
    listingAIAnalysis: { findFirst: vi.fn() },
  } as any;

  const generator = { generate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.listingAction.findFirst.mockResolvedValue(baseAction);
    prismaMock.listingMetricsDaily.findMany.mockResolvedValue([]);
    prismaMock.listingAIAnalysis.findFirst.mockResolvedValue(null);
    generator.generate.mockResolvedValue({
      details: generatedPayload,
      model: 'gpt-4o-mini',
      tokensIn: 10,
      tokensOut: 20,
    });
  });

  it('cache-hit retorna sem chamar LLM', async () => {
    prismaMock.listingActionDetail.findUnique.mockResolvedValue({
      actionId: 'action-1',
      status: ListingActionDetailStatus.READY,
      detailsJson: generatedPayload,
      updatedAt: new Date(),
    });

    const service = new ActionDetailsService(prismaMock, generator as any);
    const result = await service.getOrGenerate('tenant-1', 'listing-1', 'action-1');

    expect(result).toEqual({ state: 'ready', data: generatedPayload, cached: true });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('cache-miss gera e persiste', async () => {
    prismaMock.listingActionDetail.findUnique.mockResolvedValue(null);

    const service = new ActionDetailsService(prismaMock, generator as any);
    const result = await service.getOrGenerate('tenant-1', 'listing-1', 'action-1');

    expect(result).toEqual({ state: 'ready', data: generatedPayload, cached: false });
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(prismaMock.listingActionDetail.upsert).toHaveBeenCalled();
  });

  it('actionId de outro listing retorna 404', async () => {
    prismaMock.listingAction.findFirst.mockResolvedValue(null);

    const service = new ActionDetailsService(prismaMock, generator as any);

    await expect(service.getOrGenerate('tenant-1', 'listing-1', 'action-2')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('se LLM falha, salva FAILED', async () => {
    prismaMock.listingActionDetail.findUnique.mockResolvedValue(null);
    generator.generate.mockRejectedValue(new Error('timeout'));

    const service = new ActionDetailsService(prismaMock, generator as any);

    await expect(service.getOrGenerate('tenant-1', 'listing-1', 'action-1')).rejects.toMatchObject({ statusCode: 500 });

    const failedCall = prismaMock.listingActionDetail.upsert.mock.calls.find((call: any[]) =>
      call[0]?.update?.status === ListingActionDetailStatus.FAILED,
    );
    expect(failedCall).toBeTruthy();
  });
});
