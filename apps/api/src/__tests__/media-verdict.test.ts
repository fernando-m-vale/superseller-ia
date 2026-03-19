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
      expect(verdict.clipStatus).toBe('HAS_CLIP');
      expect(verdict.canSuggestClip).toBe(false);
      expect(verdict.message.toLowerCase()).not.toContain('clip');
      expect(verdict.shortMessage).toBe('Cobertura visual forte');
    });

    it('deve retornar canSuggestClip=false quando hasClips=false', () => {
      const verdict = getMediaVerdict(false, 5);
      
      expect(verdict.hasClipDetected).toBe(false);
      expect(verdict.clipStatus).toBe('NO_CLIP');
      expect(verdict.canSuggestClip).toBe(false);
      expect(verdict.message.toLowerCase()).not.toContain('clip');
      expect(verdict.shortMessage).toBe('Galeria pode evoluir');
    });

    it('deve retornar canSuggestClip=false quando hasClips=null', () => {
      const verdict = getMediaVerdict(null, 10);
      
      expect(verdict.hasClipDetected).toBe(null);
      expect(verdict.clipStatus).toBe('INCONCLUSIVE');
      expect(verdict.canSuggestClip).toBe(false);
      expect(verdict.message).toContain('galeria disponível');
      expect(verdict.shortMessage).toBe('Leitura visual parcial');
    });

    it('deve incluir contexto de imagens quando picturesCount >= 8 e hasClips=null', () => {
      const verdict = getMediaVerdict(null, 8);
      
      expect(verdict.message).toContain('Galeria já está robusta');
    });

    it('deve incluir contexto de imagens quando picturesCount >= 6 e hasClips=null', () => {
      const verdict = getMediaVerdict(null, 6);
      
      expect(verdict.message).toContain('Galeria está suficiente');
    });

    it('deve sugerir adicionar imagens quando picturesCount < 6 e hasClips=false', () => {
      const verdict = getMediaVerdict(false, 3);
      
      expect(verdict.message).toContain('contexto visual');
      expect(verdict.message.toLowerCase()).not.toContain('clip');
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

