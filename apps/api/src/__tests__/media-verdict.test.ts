/**
 * Media Verdict Tests
 * 
 * Testa a fonte única de verdade para mídia (vídeo/clips)
 */

import { describe, it, expect } from 'vitest';
import { getMediaVerdict, canAffirmNoVideo, canAffirmHasVideo, isVideoStatusKnown } from '../utils/media-verdict';

describe('MediaVerdict', () => {
  describe('getMediaVerdict', () => {
    it('deve retornar canSuggestVideo=false quando hasVideo=true', () => {
      const verdict = getMediaVerdict(true, 10);
      
      expect(verdict.hasVideoDetected).toBe(true);
      expect(verdict.canSuggestVideo).toBe(false);
      expect(verdict.message).toContain('possui vídeo');
      expect(verdict.shortMessage).toBe('Vídeo presente');
    });

    it('deve retornar canSuggestVideo=true quando hasVideo=false', () => {
      const verdict = getMediaVerdict(false, 5);
      
      expect(verdict.hasVideoDetected).toBe(false);
      expect(verdict.canSuggestVideo).toBe(true);
      expect(verdict.message).toContain('não possui vídeo');
      expect(verdict.shortMessage).toBe('Sem vídeo');
    });

    it('deve retornar canSuggestVideo=false quando hasVideo=null', () => {
      const verdict = getMediaVerdict(null, 10);
      
      expect(verdict.hasVideoDetected).toBe(null);
      expect(verdict.canSuggestVideo).toBe(false);
      expect(verdict.message).toContain('Não foi possível confirmar');
      expect(verdict.message).toContain('valide no painel');
      expect(verdict.shortMessage).toBe('Não detectável via API');
    });

    it('deve incluir contexto de imagens quando picturesCount >= 8 e hasVideo=null', () => {
      const verdict = getMediaVerdict(null, 8);
      
      expect(verdict.message).toContain('Imagens estão boas');
    });

    it('deve incluir contexto de imagens quando picturesCount >= 6 e hasVideo=null', () => {
      const verdict = getMediaVerdict(null, 6);
      
      expect(verdict.message).toContain('Imagens estão suficientes');
    });

    it('deve sugerir adicionar imagens quando picturesCount < 6 e hasVideo=false', () => {
      const verdict = getMediaVerdict(false, 3);
      
      expect(verdict.message).toContain('adicionar mais imagens');
    });
  });

  describe('canAffirmNoVideo', () => {
    it('deve retornar true apenas quando hasVideo=false', () => {
      expect(canAffirmNoVideo(false)).toBe(true);
      expect(canAffirmNoVideo(true)).toBe(false);
      expect(canAffirmNoVideo(null)).toBe(false);
    });
  });

  describe('canAffirmHasVideo', () => {
    it('deve retornar true apenas quando hasVideo=true', () => {
      expect(canAffirmHasVideo(true)).toBe(true);
      expect(canAffirmHasVideo(false)).toBe(false);
      expect(canAffirmHasVideo(null)).toBe(false);
    });
  });

  describe('isVideoStatusKnown', () => {
    it('deve retornar true quando hasVideo não é null', () => {
      expect(isVideoStatusKnown(true)).toBe(true);
      expect(isVideoStatusKnown(false)).toBe(true);
      expect(isVideoStatusKnown(null)).toBe(false);
    });
  });
});

