/**
 * Testes do registry de prompts
 */

import { describe, it, expect } from 'vitest';
import { getPrompt, getAvailableVersions, type PromptVersion } from '../src/prompts/registry';

describe('Prompt Registry', () => {
  it('deve retornar prompt ml-expert-v21', () => {
    const prompt = getPrompt('ml-expert-v21');
    
    expect(prompt).toBeDefined();
    expect(prompt.version).toBe('ml-expert-v21');
    expect(prompt.systemPrompt).toBeTruthy();
    expect(prompt.systemPrompt.length).toBeGreaterThan(100);
    expect(typeof prompt.buildUserPrompt).toBe('function');
  });

  it('deve retornar prompt ml-sales-v22', () => {
    const prompt = getPrompt('ml-sales-v22');
    
    expect(prompt).toBeDefined();
    expect(prompt.version).toBe('ml-sales-v22');
    expect(prompt.systemPrompt).toBeTruthy();
    expect(prompt.systemPrompt.length).toBeGreaterThan(100);
    expect(typeof prompt.buildUserPrompt).toBe('function');
  });

  it('deve lançar erro para versão inválida', () => {
    expect(() => {
      getPrompt('invalid-version' as PromptVersion);
    }).toThrow('not found in registry');
  });

  it('deve listar todas as versões disponíveis', () => {
    const versions = getAvailableVersions();
    
    expect(versions).toContain('ml-expert-v21');
    expect(versions).toContain('ml-sales-v22');
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it('deve construir user prompt corretamente', () => {
    const prompt = getPrompt('ml-expert-v21');
    
    const mockInput = {
      listing: {
        title: 'Test Product',
        price_base: 60,
        price_final: 32,
        has_promotion: true,
        discount_percent: 47,
        description_length: 500,
      },
      media: {
        imageCount: 6,
        hasClips: null,
      },
      dataQuality: {
        visits_status: 'ok' as const,
        performanceAvailable: true,
        warnings: [],
      },
    };

    const mockScoreResult = {
      metrics_30d: {
        visits: 100,
        orders: 5,
        conversionRate: 0.05,
        ctr: 0.02,
        revenue: 160,
      },
    };

    const mockMeta = {
      periodDays: 30,
    };

    const userPrompt = prompt.buildUserPrompt({
      input: mockInput,
      scoreResult: mockScoreResult,
      meta: mockMeta,
    });

    expect(userPrompt).toBeTruthy();
    expect(userPrompt.length).toBeGreaterThan(100);
    expect(userPrompt).toContain('Test Product');
    expect(userPrompt).toContain('60');
    expect(userPrompt).toContain('32');
    expect(userPrompt).toContain('47');
  });
});
