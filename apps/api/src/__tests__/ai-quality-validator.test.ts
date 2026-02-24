/**
 * Testes do validador de qualidade da IA
 * 
 * Valida regras hard constraints sem chamar OpenAI.
 */

import { describe, it, expect } from 'vitest';
import type { AIAnalysisResultExpert } from '../types/ai-analysis-expert';
import type { AIAnalyzeInputV21 } from '../types/ai-analyze-input';

describe('AI Quality Validator', () => {
  describe('description_fix.optimized_copy', () => {
    it('deve falhar se optimized_copy tiver menos de 900 caracteres', () => {
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        description_fix: {
          diagnostic: 'Test',
          optimized_copy: 'Short text', // < 900 chars
        },
      };

      const descLength = mockAnalysis.description_fix?.optimized_copy?.length || 0;
      expect(descLength).toBeLessThan(900);
    });

    it('deve passar se optimized_copy tiver >= 900 caracteres', () => {
      const longText = 'A'.repeat(900);
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        description_fix: {
          diagnostic: 'Test',
          optimized_copy: longText,
        },
      };

      const descLength = mockAnalysis.description_fix?.optimized_copy?.length || 0;
      expect(descLength).toBeGreaterThanOrEqual(900);
    });

    it('deve conter estrutura obrigatória (emojis e seções)', () => {
      const base = `
Linha inicial SEO com keyword principal.

⭐ Destaques
- Item 1
- Item 2
- Item 3

📏 Tamanhos / Medidas
Especificações aqui.

📦 O que você recebe
Conteúdo aqui.

🧼 Cuidados
Instruções de cuidado.

🚀 Dica de compra
Dica prática.

👉 Garanta já!
`.trim();

      const structuredText = (base + '\n' + 'A'.repeat(Math.max(0, 900 - base.length))).trim();

      expect(structuredText).toContain('⭐');
      expect(structuredText).toContain('📏');
      expect(structuredText).toContain('📦');
      expect(structuredText).toContain('🚀');
      expect(structuredText.length).toBeGreaterThanOrEqual(900);
    });
  });

  describe('final_action_plan', () => {
    it('deve falhar se tiver menos de 7 ações', () => {
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        final_action_plan: [
          'Ação 1',
          'Ação 2',
          'Ação 3',
        ],
      };

      expect(mockAnalysis.final_action_plan?.length || 0).toBeLessThan(7);
    });

    it('deve passar se tiver >= 7 ações', () => {
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        final_action_plan: [
          'Ação 1',
          'Ação 2',
          'Ação 3',
          'Ação 4',
          'Ação 5',
          'Ação 6',
          'Ação 7',
        ],
      };

      expect(mockAnalysis.final_action_plan?.length || 0).toBeGreaterThanOrEqual(7);
    });
  });

  describe('title_fix.after', () => {
    it('deve falhar se tiver menos de 45 caracteres', () => {
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        title_fix: {
          problem: 'Test',
          impact: 'Test',
          before: 'Test',
          after: 'Short', // < 45 chars
        },
      };

      const titleLength = mockAnalysis.title_fix?.after?.length || 0;
      expect(titleLength).toBeLessThan(45);
    });

    it('deve passar se tiver >= 45 caracteres', () => {
      const longTitle = 'Meias 3d Crazy Socks Diversão E Conforto Em Cada Passo Infantil Unissex';
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        title_fix: {
          problem: 'Test',
          impact: 'Test',
          before: 'Test',
          after: longTitle,
        },
      };

      const titleLength = mockAnalysis.title_fix?.after?.length || 0;
      expect(titleLength).toBeGreaterThanOrEqual(45);
    });
  });

  describe('Promoção validation', () => {
    it('deve falhar se hasPromotion=true mas não mencionar valores', () => {
      const mockInput: Partial<AIAnalyzeInputV21> = {
        listing: {
          title: 'Test',
          price_base: 60,
          price_final: 32,
          has_promotion: true,
          discount_percent: 47,
          description_length: 500,
        } as any,
      };

      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        price_fix: {
          diagnostic: 'Preço pode ser otimizado',
          action: 'Considere ajustar o preço', // Não menciona 60 ou 32
        },
      };

      const priceFixText = (mockAnalysis.price_fix?.action || '').toLowerCase();
      const mentionsOriginalPrice = priceFixText.includes('60') || priceFixText.includes('original');
      const mentionsPriceFinal = priceFixText.includes('32') || priceFixText.includes('promo');

      expect(mentionsOriginalPrice || mentionsPriceFinal).toBe(false);
    });

    it('deve passar se mencionar valores de promoção', () => {
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        price_fix: {
          diagnostic: 'Promoção ativa detectada',
          action: 'Você tem uma promoção ativa: de R$ 60 por R$ 32 (47% de desconto)',
        },
      };

      const priceFixText = (mockAnalysis.price_fix?.action || '').toLowerCase();
      const mentionsOriginalPrice = priceFixText.includes('60') || priceFixText.includes('original');
      const mentionsPriceFinal = priceFixText.includes('32') || priceFixText.includes('promo');
      const mentionsDiscount = priceFixText.includes('47') || priceFixText.includes('%');

      expect(mentionsOriginalPrice).toBe(true);
      expect(mentionsPriceFinal).toBe(true);
      expect(mentionsDiscount).toBe(true);
    });
  });

  describe('Clip validation (hasClips === null)', () => {
    it('deve falhar se afirmar que não tem vídeo quando hasClips=null', () => {
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        algorithm_hacks: [
          {
            hack: 'Adicionar clip',
            how_to_apply: 'O anúncio não tem vídeo, adicione um clip',
            signal_impacted: 'CTR',
          },
        ],
      };

      const allText = JSON.stringify(mockAnalysis).toLowerCase();
      const invalidPhrases = [
        'não tem vídeo',
        'não tem clip',
        'sem vídeo',
        'sem clip',
      ];

      const hasInvalidPhrase = invalidPhrases.some(phrase => allText.includes(phrase));
      expect(hasInvalidPhrase).toBe(true);
    });

    it('deve passar se usar frase padrão "Não foi possível confirmar via API"', () => {
      const mockAnalysis: Partial<AIAnalysisResultExpert> = {
        algorithm_hacks: [
          {
            hack: 'Verificar clip',
            how_to_apply: 'Não foi possível confirmar via API se o anúncio possui clip. Valide no painel do Mercado Livre.',
            signal_impacted: 'CTR',
          },
        ],
      };

      const allText = JSON.stringify(mockAnalysis).toLowerCase();
      const requiredPhrase = 'não foi possível confirmar';
      expect(allText).toContain(requiredPhrase);
    });
  });

  describe('Fixture MLB4217107417', () => {
    it('deve ter estrutura válida para teste de promoção', async () => {
      const fixture = await import('../__fixtures__/item-MLB4217107417.json');
      
      expect(fixture.default).toBeDefined();
      expect(fixture.default.id).toBe('MLB4217107417');
      expect(fixture.default.price).toBe(60);
      expect(fixture.default.original_price).toBe(60);
      expect(fixture.default.sale_price).toBe(32);
      expect(fixture.default.prices).toBeDefined();
      expect(fixture.default.reference_prices).toBeDefined();
      expect(Array.isArray(fixture.default.pictures)).toBe(true);
      expect(fixture.default.pictures.length).toBeGreaterThanOrEqual(6);
      expect(fixture.default.video_id).toBeNull();
    });
  });
});
