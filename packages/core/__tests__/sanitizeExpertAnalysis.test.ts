import { describe, it, expect } from 'vitest';
import { sanitizeExpertAnalysis } from '../src/sanitizeExpertAnalysis';

describe('sanitizeExpertAnalysis', () => {
  it('should return the same object when no AI-generated fields have emojis/markdown', () => {
    const input = {
      verdict: 'Titulo fraco',
      title_fix: {
        problem: 'Titulo curto',
        impact: 'Baixa visibilidade',
        before: 'Produto X',
        after: 'Produto X Premium Original',
      },
      description_fix: {
        diagnostic: 'Descricao vazia',
        optimized_copy: 'Descricao otimizada sem emojis',
      },
      price_fix: {
        diagnostic: 'Preco adequado',
        action: 'Manter preco atual',
      },
      image_plan: [
        { image: 1, action: 'Foto principal com fundo branco' },
      ],
      algorithm_hacks: [
        { hack: 'Envio full', how_to_apply: 'Ativar no painel', signal_impacted: 'Relevancia' },
      ],
      final_action_plan: ['Atualizar titulo', 'Melhorar fotos'],
      meta: { version: 'ml-expert-v22', model: 'gpt-4o' },
    };

    const result = sanitizeExpertAnalysis(input);
    expect(result.verdict).toBe('Titulo fraco');
    expect(result.title_fix?.after).toBe('Produto X Premium Original');
    expect(result.description_fix?.optimized_copy).toBe('Descricao otimizada sem emojis');
    expect(result.meta).toEqual({ version: 'ml-expert-v22', model: 'gpt-4o' });
  });

  it('should strip emojis from all AI-generated text fields', () => {
    const input = {
      verdict: '🔥 Anuncio fraco!',
      title_fix: {
        problem: '❌ Titulo ruim',
        impact: '⚠️ Perda de cliques',
        before: 'Produto X',
        after: '✅ Produto X Premium',
      },
      description_fix: {
        diagnostic: '🚨 Descricao vazia',
        optimized_copy: '🎯 Produto premium com garantia 💪',
      },
      price_fix: {
        diagnostic: '💰 Preco alto',
        action: '📉 Reduzir preco',
      },
      image_plan: [
        { image: 1, action: '📸 Foto profissional' },
      ],
      algorithm_hacks: [
        { hack: '🚀 Envio full', how_to_apply: '✨ Ativar envio', signal_impacted: '📊 Relevancia' },
      ],
      final_action_plan: ['1. ✅ Atualizar titulo', '2. 🖼️ Melhorar fotos'],
    };

    const result = sanitizeExpertAnalysis(input);
    expect(result.verdict).toBe('Anuncio fraco!');
    expect(result.title_fix?.problem).toBe('Titulo ruim');
    expect(result.title_fix?.impact).toBe('Perda de cliques');
    expect(result.title_fix?.after).toBe('Produto X Premium');
    expect(result.title_fix?.before).toBe('Produto X');
    expect(result.description_fix?.diagnostic).toBe('Descricao vazia');
    expect(result.description_fix?.optimized_copy).toBe('Produto premium com garantia');
    expect(result.price_fix?.diagnostic).toBe('Preco alto');
    expect(result.price_fix?.action).toBe('Reduzir preco');
    expect(result.image_plan?.[0]?.action).toBe('Foto profissional');
    expect(result.algorithm_hacks?.[0]?.hack).toBe('Envio full');
    expect(result.algorithm_hacks?.[0]?.how_to_apply).toBe('Ativar envio');
    expect(result.algorithm_hacks?.[0]?.signal_impacted).toBe('Relevancia');
    expect(result.final_action_plan?.[0]).toBe('1. Atualizar titulo');
    expect(result.final_action_plan?.[1]).toBe('2. Melhorar fotos');
  });

  it('should strip markdown from description_fix.optimized_copy', () => {
    const input = {
      description_fix: {
        diagnostic: 'Descricao com **negrito**',
        optimized_copy: '**Produto Premium**\n\n## Caracteristicas\n\n- Item 1\n- [Link](http://example.com)',
      },
    };

    const result = sanitizeExpertAnalysis(input);
    expect(result.description_fix?.optimized_copy).toBe('Produto Premium\n\nCaracteristicas\n\n- Item 1\n- Link');
    expect(result.description_fix?.diagnostic).toBe('Descricao com negrito');
  });

  it('should not mutate the original object', () => {
    const input = {
      verdict: '🔥 Original',
      title_fix: { after: '✅ Titulo' },
    };

    const result = sanitizeExpertAnalysis(input);
    expect(input.verdict).toBe('🔥 Original');
    expect(input.title_fix.after).toBe('✅ Titulo');
    expect(result.verdict).toBe('Original');
    expect(result.title_fix?.after).toBe('Titulo');
  });

  it('should handle null/undefined input gracefully', () => {
    expect(sanitizeExpertAnalysis(null as any)).toBeNull();
    expect(sanitizeExpertAnalysis(undefined as any)).toBeUndefined();
  });

  it('should handle empty analysis object', () => {
    const result = sanitizeExpertAnalysis({});
    expect(result).toEqual({});
  });

  it('should preserve meta field without sanitizing', () => {
    const input = {
      meta: {
        version: 'ml-expert-v22',
        model: 'gpt-4o',
        analyzed_at: '2026-01-01T00:00:00Z',
        prompt_version: 'ml-expert-v22',
      },
    };

    const result = sanitizeExpertAnalysis(input);
    expect(result.meta).toEqual(input.meta);
  });

  it('should sanitize multiple algorithm_hacks', () => {
    const input = {
      algorithm_hacks: [
        { hack: '🚀 Hack 1', how_to_apply: '**Bold** text', signal_impacted: 'CTR' },
        { hack: '💡 Hack 2', how_to_apply: '## Header', signal_impacted: '🎯 Conversao' },
      ],
    };

    const result = sanitizeExpertAnalysis(input);
    expect(result.algorithm_hacks?.[0]?.hack).toBe('Hack 1');
    expect(result.algorithm_hacks?.[0]?.how_to_apply).toBe('Bold text');
    expect(result.algorithm_hacks?.[1]?.hack).toBe('Hack 2');
    expect(result.algorithm_hacks?.[1]?.how_to_apply).toBe('Header');
    expect(result.algorithm_hacks?.[1]?.signal_impacted).toBe('Conversao');
  });

  it('should replace decorative bullets with hyphens', () => {
    const input = {
      description_fix: {
        optimized_copy: '• Item 1\n• Item 2\n► Item 3',
      },
    };

    const result = sanitizeExpertAnalysis(input);
    expect(result.description_fix?.optimized_copy).toBe('- Item 1\n- Item 2\n- Item 3');
  });
});
