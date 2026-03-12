import { describe, expect, it, vi } from 'vitest';
import { VisualAnalysisOrchestrator } from '../services/visual/VisualAnalysisOrchestrator';
import { VisualAnalysisRepository } from '../services/visual/VisualAnalysisRepository';
import { VisualAssetResolver } from '../services/visual/VisualAssetResolver';
import { VisualSignalsBuilder } from '../services/visual/VisualSignalsBuilder';
import { VisualAnalysisLLMService } from '../services/visual/VisualAnalysisLLMService';
import { VisualAnalysisNormalizer } from '../services/visual/VisualAnalysisNormalizer';

describe('VisualAnalysisOrchestrator', () => {
  const listing = {
    tenantId: 'tenant-1',
    listingId: 'listing-1',
    title: 'Fone Bluetooth',
    category: 'MLB123',
    pictures_json: [{ secure_url: 'https://example.com/main.jpg' }],
    thumbnail_url: null,
    pictures_count: 1,
  };

  it('cache hit retorna analise existente', async () => {
    const repository = {
      findLatestByCacheKey: vi.fn().mockResolvedValue({
        visual_score: 88,
        summary: 'Em cache.',
        clarity: { score: 88, assessment: 'ok' },
        contrast: { score: 88, assessment: 'ok' },
        visual_pollution: { score: 88, assessment: 'ok' },
        excessive_text: { score: 88, assessment: 'ok' },
        differentiation: { score: 88, assessment: 'ok' },
        clickability: { score: 88, assessment: 'ok' },
        criteria: undefined,
        main_improvements: ['melhoria'],
        main_image_url: 'https://example.com/main.jpg',
        analyzed_at: new Date().toISOString(),
        model: 'gpt-4o',
        meta: {
          status: 'success',
          cache_hit: false,
          prompt_version: 'visual-v2',
          model: 'gpt-4o',
          analyzed_at: new Date().toISOString(),
          image_hash: 'hash-1',
          image_source: 'pictures_json_first',
        },
      }),
      save: vi.fn(),
    } as unknown as VisualAnalysisRepository;

    const llmService = {
      analyze: vi.fn(),
    } as unknown as VisualAnalysisLLMService;

    const orchestrator = new VisualAnalysisOrchestrator(
      repository,
      new VisualAssetResolver(),
      new VisualSignalsBuilder(),
      llmService,
      new VisualAnalysisNormalizer(),
    );

    const result = await orchestrator.analyzeListing(listing);

    expect(result.visual_score).toBe(88);
    expect(result.meta?.cache_hit).toBe(true);
    expect(vi.mocked((llmService as any).analyze)).not.toHaveBeenCalled();
  });

  it('cache miss chama LLM e persiste', async () => {
    const repository = {
      findLatestByCacheKey: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as VisualAnalysisRepository;

    const llmService = {
      analyze: vi.fn().mockResolvedValue({
        visualScore: 84,
        visualSummary: 'Produto bem legível.',
        clarity: { score: 90, verdict: 'forte', reason: 'Produto em destaque.' },
        contrast: { score: 80, verdict: 'medio', reason: 'Contraste adequado.' },
        visualPollution: { score: 70, verdict: 'medio', reason: 'Poucos elementos.' },
        excessiveText: { score: 60, verdict: 'medio', reason: 'Texto nao domina.' },
        differentiation: { score: 75, verdict: 'medio', reason: 'Boa diferenciacao.' },
        clickability: { score: 85, verdict: 'forte', reason: 'Bom potencial de clique.' },
        mainImprovements: ['reduzir texto'],
      }),
    } as unknown as VisualAnalysisLLMService;

    const orchestrator = new VisualAnalysisOrchestrator(
      repository,
      new VisualAssetResolver(),
      new VisualSignalsBuilder(),
      llmService,
      new VisualAnalysisNormalizer(),
    );

    const result = await orchestrator.analyzeListing(listing);

    expect(result.visual_score).toBe(84);
    expect(result.meta?.cache_hit).toBe(false);
    expect(vi.mocked((llmService as any).analyze)).toHaveBeenCalledTimes(1);
    expect(vi.mocked((repository as any).save)).toHaveBeenCalledTimes(1);
  });

  it('mudanca de prompt version força reprocessamento via cache key diferente', async () => {
    const repository = {
      findLatestByCacheKey: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as VisualAnalysisRepository;

    const llmService = {
      analyze: vi.fn().mockResolvedValue({
        visualScore: 70,
        visualSummary: 'Teste.',
        clarity: { score: 70, verdict: 'medio', reason: 'Teste.' },
        contrast: { score: 70, verdict: 'medio', reason: 'Teste.' },
        visualPollution: { score: 70, verdict: 'medio', reason: 'Teste.' },
        excessiveText: { score: 70, verdict: 'medio', reason: 'Teste.' },
        differentiation: { score: 70, verdict: 'medio', reason: 'Teste.' },
        clickability: { score: 70, verdict: 'medio', reason: 'Teste.' },
        mainImprovements: ['teste'],
      }),
    } as unknown as VisualAnalysisLLMService;

    const orchestrator = new VisualAnalysisOrchestrator(
      repository,
      new VisualAssetResolver(),
      new VisualSignalsBuilder(),
      llmService,
      new VisualAnalysisNormalizer(),
    );

    await orchestrator.analyzeListing(listing);

    expect(vi.mocked((repository as any).findLatestByCacheKey).mock.calls[0][0].promptVersion).toBe('visual-v2');
  });

  it('ausencia de imagem nao chama LLM', async () => {
    const repository = {
      findLatestByCacheKey: vi.fn(),
      save: vi.fn(),
    } as unknown as VisualAnalysisRepository;

    const llmService = {
      analyze: vi.fn(),
    } as unknown as VisualAnalysisLLMService;

    const orchestrator = new VisualAnalysisOrchestrator(
      repository,
      new VisualAssetResolver(),
      new VisualSignalsBuilder(),
      llmService,
      new VisualAnalysisNormalizer(),
    );

    const result = await orchestrator.analyzeListing({
      ...listing,
      pictures_json: null,
      thumbnail_url: null,
      pictures_count: 0,
    });

    expect(result.meta?.status).toBe('missing_image');
    expect(vi.mocked((llmService as any).analyze)).not.toHaveBeenCalled();
  });
});
