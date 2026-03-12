import { describe, expect, it } from 'vitest';
import { VisualAnalysisNormalizer } from '../services/visual/VisualAnalysisNormalizer';

describe('VisualAnalysisNormalizer', () => {
  const normalizer = new VisualAnalysisNormalizer();

  it('faz clamp de score e limita improvements', () => {
    const result = normalizer.normalize({
      rawResponse: {
        visualScore: 140,
        visualSummary: 'Imagem clara, mas com alguns ruídos de composição e texto demais para clique rápido.',
        clarity: { score: 110, verdict: 'forte', reason: 'Produto bem legível.' },
        contrast: { score: -5, verdict: 'medio', reason: 'Fundo razoável.' },
        visualPollution: { score: 70, verdict: 'medio', reason: 'Há alguns elementos competindo.' },
        excessiveText: { score: 10, verdict: 'fraco', reason: 'Muito texto sobreposto.' },
        differentiation: { score: 80, verdict: 'forte', reason: 'Imagem foge do padrão comum.' },
        clickability: { score: 90, verdict: 'forte', reason: 'Chama clique rapidamente.' },
        mainImprovements: ['a', 'b', 'c', 'd', 'e', 'f'],
      },
      mainImageUrl: 'https://example.com/main.jpg',
      imageSource: 'pictures_json_first',
      imageHash: 'hash-1',
    });

    expect(result.visual_score).toBe(100);
    expect(result.clarity.score).toBe(100);
    expect(result.contrast.score).toBe(0);
    expect(result.main_improvements).toHaveLength(5);
    expect(result.clickability?.score).toBe(90);
    expect(result.meta?.image_hash).toBe('hash-1');
  });

  it('retorna fallback seguro em schema invalido e mantem compatibilidade do payload atual', () => {
    const result = normalizer.normalize({
      rawResponse: {
        visualScore: 'invalido',
      },
      mainImageUrl: 'https://example.com/main.jpg',
      imageSource: 'thumbnail_url',
      imageHash: 'hash-2',
    });

    expect(result.visual_score).toBe(0);
    expect(result.summary).toContain('Analise visual indisponivel');
    expect(result.clarity.assessment).toBeTruthy();
    expect(result.visual_pollution.assessment).toBeTruthy();
    expect(result.main_improvements.length).toBeGreaterThan(0);
    expect(result.meta?.status).toBe('invalid_output');
  });
});
