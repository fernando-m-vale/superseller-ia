/**
 * Media Verdict Tests
 * 
 * Testa a fonte única de verdade para mídia (clip/vídeo)
 * IMPORTANTE: No Mercado Livre, clip = vídeo. Não há distinção.
 */

import { describe, it, expect } from 'vitest';
import { getMediaVerdict, canAffirmNoClip, canAffirmHasClip, isClipStatusKnown } from '../utils/media-verdict';

describe('MediaVerdict', () => {
  describe('getMediaVerdict', () => {
    it('deve retornar canSuggestClip=false quando hasClips=true', () => {
      const verdict = getMediaVerdict(true, 10);
      
      expect(verdict.hasClipDetected).toBe(true);
      expect(verdict.canSuggestClip).toBe(false);
      expect(verdict.message).toContain('possui clip');
      expect(verdict.shortMessage).toBe('Clip presente');
    });

    it('deve retornar canSuggestClip=true quando hasClips=false', () => {
      const verdict = getMediaVerdict(false, 5);
      
      expect(verdict.hasClipDetected).toBe(false);
      expect(verdict.canSuggestClip).toBe(true);
      expect(verdict.message).toContain('não possui clip');
      expect(verdict.shortMessage).toBe('Sem clip');
    });

    it('deve retornar canSuggestClip=false quando hasClips=null', () => {
      const verdict = getMediaVerdict(null, 10);
      
      expect(verdict.hasClipDetected).toBe(null);
      expect(verdict.canSuggestClip).toBe(false);
      expect(verdict.message).toContain('Não foi possível confirmar');
      expect(verdict.message).toContain('valide no painel');
      expect(verdict.shortMessage).toBe('Não detectável via API');
    });

    it('deve incluir contexto de imagens quando picturesCount >= 8 e hasClips=null', () => {
      const verdict = getMediaVerdict(null, 8);
      
      expect(verdict.message).toContain('Imagens estão boas');
    });

    it('deve incluir contexto de imagens quando picturesCount >= 6 e hasClips=null', () => {
      const verdict = getMediaVerdict(null, 6);
      
      expect(verdict.message).toContain('Imagens estão suficientes');
    });

    it('deve sugerir adicionar imagens quando picturesCount < 6 e hasClips=false', () => {
      const verdict = getMediaVerdict(false, 3);
      
      expect(verdict.message).toContain('adicionar mais imagens');
    });
  });

  describe('canAffirmNoClip', () => {
    it('deve retornar true apenas quando hasClips=false', () => {
      expect(canAffirmNoClip(false)).toBe(true);
      expect(canAffirmNoClip(true)).toBe(false);
      expect(canAffirmNoClip(null)).toBe(false);
    });
  });

  describe('canAffirmHasClip', () => {
    it('deve retornar true apenas quando hasClips=true', () => {
      expect(canAffirmHasClip(true)).toBe(true);
      expect(canAffirmHasClip(false)).toBe(false);
      expect(canAffirmHasClip(null)).toBe(false);
    });
  });

  describe('isClipStatusKnown', () => {
    it('deve retornar true quando hasClips não é null', () => {
      expect(isClipStatusKnown(true)).toBe(true);
      expect(isClipStatusKnown(false)).toBe(true);
      expect(isClipStatusKnown(null)).toBe(false);
    });
  });
});

