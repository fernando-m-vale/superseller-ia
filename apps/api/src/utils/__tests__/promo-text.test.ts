/**
 * Unit tests para promo-text.ts - HOTFIX 09.8
 * 
 * Testa regras de formatação de texto de promoção para evitar duplicação.
 */

import { describe, it, expect } from 'vitest';
import { buildPromoText, sanitizePromoText } from '../promo-text';

describe('promo-text utils (HOTFIX 09.8)', () => {
  describe('buildPromoText', () => {
    it('deve retornar "de R$ X por R$ Y" quando original > final', () => {
      const result = buildPromoText({
        hasPromotion: true,
        originalPrice: 100,
        finalPrice: 80,
      });
      expect(result).toBe('de R$ 100,00 por R$ 80,00');
    });

    it('deve retornar null quando original == final', () => {
      const result = buildPromoText({
        hasPromotion: true,
        originalPrice: 100,
        finalPrice: 100,
      });
      expect(result).toBeNull();
    });

    it('deve retornar null quando originalPrice ausente', () => {
      const result = buildPromoText({
        hasPromotion: true,
        originalPrice: null,
        finalPrice: 80,
      });
      expect(result).toBeNull();
    });

    it('deve retornar null quando hasPromotion false', () => {
      const result = buildPromoText({
        hasPromotion: false,
        originalPrice: 100,
        finalPrice: 80,
      });
      expect(result).toBeNull();
    });
  });

  describe('sanitizePromoText', () => {
    it('deve remover duplicação "de R$ X por R$ Y" e substituir por promoText', () => {
      const text = 'Aproveite a promoção: de R$ 39,90 de R$ 39,90 por R$ 29,00';
      const promoText = 'de R$ 39,90 por R$ 29,00';
      const result = sanitizePromoText(text, promoText);
      expect(result).not.toContain('de R$ 39,90 de R$ 39,90');
      expect(result).toContain('de R$ 39,90 por R$ 29,00');
    });

    it('deve remover padrão "de R$ X por R$ X" (mesmo valor)', () => {
      const text = 'Aproveite: de R$ 100,00 por R$ 100,00';
      const result = sanitizePromoText(text, null);
      expect(result).not.toContain('de R$ 100,00 por R$ 100,00');
      expect(result).toContain('por R$ 100,00');
    });

    it('deve adicionar promoText apenas uma vez', () => {
      const text = 'Aproveite a promoção: de R$ 50,00 por R$ 40,00';
      const promoText = 'de R$ 50,00 por R$ 40,00';
      const result = sanitizePromoText(text, promoText);
      // Contar ocorrências de promoText
      const occurrences = (result.match(new RegExp(promoText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      expect(occurrences).toBeLessThanOrEqual(1);
    });

    it('deve lidar com texto sem padrões de promoção', () => {
      const text = 'Produto em destaque';
      const promoText = 'de R$ 100,00 por R$ 80,00';
      const result = sanitizePromoText(text, promoText);
      expect(result).toContain('Produto em destaque');
      expect(result).toContain(promoText);
    });
  });
});
