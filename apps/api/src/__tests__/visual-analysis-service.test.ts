import { describe, expect, it } from 'vitest';
import { VisualAnalysisService } from '../services/VisualAnalysisService';

describe('VisualAnalysisService', () => {
  it('resolve a imagem principal priorizando secure_url de pictures_json', () => {
    const service = new VisualAnalysisService(null);

    const mainImageUrl = service.resolveMainImageUrl({
      thumbnail_url: 'https://example.com/thumb.jpg',
      pictures_json: [
        { secure_url: 'https://example.com/main.jpg' },
        { secure_url: 'https://example.com/second.jpg' },
      ],
    });

    expect(mainImageUrl).toBe('https://example.com/main.jpg');
  });

  it('gera score visual e melhorias a partir de uma imagem valida', async () => {
    const service = new VisualAnalysisService({
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    visual_score: 84,
                    summary: 'O produto aparece com boa leitura e contraste forte.',
                    clarity: { score: 90, assessment: 'O produto esta nitido e facil de identificar.' },
                    contrast: { score: 88, assessment: 'O item se destaca bem do fundo.' },
                    visual_pollution: { score: 76, assessment: 'Ha poucos elementos competindo com o produto.' },
                    excessive_text: { score: 82, assessment: 'O texto nao domina a composicao.' },
                    differentiation: { score: 78, assessment: 'A imagem foge do padrao totalmente generico.' },
                    main_improvements: ['reduzir texto', 'simplificar fundo'],
                  }),
                },
              },
            ],
          }),
        },
      },
    });

    const result = await service.analyzeMainImage({
      title: 'Fone Bluetooth Gamer',
      category: 'Eletronicos',
      mainImageUrl: 'https://example.com/main.jpg',
    });

    expect(result.visual_score).toBe(84);
    expect(result.summary).toContain('boa leitura');
    expect(result.main_improvements).toEqual(['reduzir texto', 'simplificar fundo']);
    expect(result.main_image_url).toBe('https://example.com/main.jpg');
  });

  it('mantem sugestoes coerentes no fallback quando a resposta da IA e invalida', async () => {
    const service = new VisualAnalysisService({
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: '{"visual_score":"invalido"}',
                },
              },
            ],
          }),
        },
      },
    });

    const result = await service.analyzeMainImage({
      title: 'Luminaria de Mesa',
      category: 'Casa',
      mainImageUrl: 'https://example.com/lamp.jpg',
    });

    expect(result.visual_score).toBe(0);
    expect(result.main_improvements[0]).toContain('imagem principal');
    expect(result.summary).toContain('Analise visual indisponivel');
  });
});
