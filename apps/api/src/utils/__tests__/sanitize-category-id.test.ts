/**
 * Unit tests para sanitize-category-id.ts - HOTFIX 09.9
 */

import { describe, it, expect } from 'vitest';
import { sanitizeCategoryId, buildCategoryUrl } from '../sanitize-category-id';

describe('sanitize-category-id (HOTFIX 09.9)', () => {
  describe('sanitizeCategoryId', () => {
    it('deve sanitizar "mlb271066 c" para "MLB271066"', () => {
      const result = sanitizeCategoryId('mlb271066 c');
      expect(result).toBe('MLB271066');
    });

    it('deve normalizar "MLB271066" mantendo formato', () => {
      const result = sanitizeCategoryId('MLB271066');
      expect(result).toBe('MLB271066');
    });

    it('deve adicionar prefixo MLB se não tiver', () => {
      const result = sanitizeCategoryId('271066');
      expect(result).toBe('MLB271066');
    });

    it('deve remover espaços e caracteres inválidos', () => {
      const result = sanitizeCategoryId('mlb 271 066 !@#');
      expect(result).toBe('MLB271066');
    });

    it('deve retornar null para string vazia', () => {
      const result = sanitizeCategoryId('');
      expect(result).toBeNull();
    });

    it('deve retornar null para null/undefined', () => {
      expect(sanitizeCategoryId(null)).toBeNull();
      expect(sanitizeCategoryId(undefined)).toBeNull();
    });

    it('deve retornar null para formato inválido após sanitização', () => {
      const result = sanitizeCategoryId('abc');
      expect(result).toBeNull();
    });
  });

  describe('buildCategoryUrl', () => {
    it('deve construir URL válida para categoryId válido', () => {
      const result = buildCategoryUrl('mlb271066 c');
      expect(result).toBe('https://lista.mercadolivre.com.br/c/MLB271066');
    });

    it('deve retornar null para categoryId inválido', () => {
      const result = buildCategoryUrl('abc');
      expect(result).toBeNull();
    });

    it('deve retornar null para null/undefined', () => {
      expect(buildCategoryUrl(null)).toBeNull();
      expect(buildCategoryUrl(undefined)).toBeNull();
    });
  });
});
