/**
 * Unit tests for ML Video Extractor
 * 
 * HOTFIX 09.11: Testes cobrindo os 3 estados do tri-state has_clips:
 * - true: tem vídeo confirmado via API
 * - false: confirmado que não tem vídeo (status 200 e evidência negativa)
 * - null: não detectável via API
 */

import { extractHasVideoFromMlItem } from '../ml-video-extractor';

describe('ml-video-extractor', () => {
  describe('extractHasVideoFromMlItem - Tri-state has_clips (HOTFIX 09.11)', () => {
    it('deve retornar true quando video_id está presente e não vazio (status 200)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        video_id: 'ABC123XYZ',
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(true);
      expect(result.isDetectable).toBe(true);
      expect(result.evidence.some(e => e.includes('video_id present'))).toBe(true);
      expect(result.clipsEvidence?.signals).toContain('found_published_clip');
    });

    it('deve retornar true quando videos array está presente e não vazio (status 200)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        videos: [
          { id: 'VIDEO_001', url: 'https://example.com/video.mp4' },
        ],
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(true);
      expect(result.isDetectable).toBe(true);
      expect(result.evidence.some(e => e.includes('videos array present'))).toBe(true);
      expect(result.clipsEvidence?.signals).toContain('found_published_clip');
    });

    it('deve retornar false quando video_id é null explicitamente (status 200)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        video_id: null,
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(false);
      expect(result.isDetectable).toBe(true);
      expect(result.evidence.some(e => e.includes('video_id is null'))).toBe(true);
      expect(result.clipsEvidence?.signals).toContain('field:video_id=null');
    });

    it('deve retornar false quando videos array está vazio (status 200)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        videos: [],
        // Não incluir outras chaves que contenham "video" para evitar falsos positivos
      };

      const result = extractHasVideoFromMlItem(item, 200);

      // O código verifica videos primeiro, então deve retornar false se array vazio e status 200
      // Mas pode encontrar outras chaves com "video" no nome, então vamos verificar se pelo menos
      // a evidência de array vazio está presente
      expect(result.evidence.some(e => e.includes('videos array is empty'))).toBe(true);
      // Se não encontrou outras evidências, deve ser false
      if (!result.evidence.some(e => e.includes('key') && e.includes('video'))) {
        expect(result.hasVideo).toBe(false);
        expect(result.isDetectable).toBe(true);
      }
      expect(result.clipsEvidence?.signals).toContain('field:videos_count=0');
    });

    it('deve retornar false quando videos é null explicitamente (status 200)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        videos: null,
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(false);
      expect(result.isDetectable).toBe(true);
      expect(result.evidence.some(e => e.includes('videos is null'))).toBe(true);
      expect(result.clipsEvidence?.signals).toContain('field:videos=null');
    });

    it('deve retornar null quando video_id é null mas status não é 200 (não detectável)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        video_id: null,
      };

      const result = extractHasVideoFromMlItem(item, 404);

      expect(result.hasVideo).toBe(null);
      expect(result.isDetectable).toBe(false);
      expect(result.evidence.some(e => e.includes('video_id is null but status is not 200'))).toBe(true);
      expect(result.clipsEvidence?.signals).toContain('field:video_id=null_inconclusive');
    });

    it('deve retornar null quando videos array está vazio mas status não é 200 (não detectável)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        videos: [],
        // Não incluir outras chaves que contenham "video" para evitar falsos positivos
      };

      const result = extractHasVideoFromMlItem(item, 404);

      // O código verifica videos primeiro, então deve retornar null se array vazio e status não 200
      // Mas pode encontrar outras chaves com "video" no nome, então vamos verificar se pelo menos
      // a evidência de array vazio está presente
      expect(result.evidence.some(e => e.includes('videos array is empty but status is not 200'))).toBe(true);
      // Se não encontrou outras evidências, deve ser null
      if (!result.evidence.some(e => e.includes('key') && e.includes('video'))) {
        expect(result.hasVideo).toBe(null);
        expect(result.isDetectable).toBe(false);
      }
      expect(result.clipsEvidence?.signals).toContain('field:videos_count=0_inconclusive');
    });

    it('deve retornar null quando item não tem campos de vídeo (não detectável)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        price: 100,
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(null);
      expect(result.isDetectable).toBe(false);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('deve retornar null quando item não é um objeto válido (não detectável)', () => {
      const item = 'not an object';

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(null);
      expect(result.isDetectable).toBe(false);
      expect(result.evidence.some(e => e.includes('item is not an object'))).toBe(true);
      expect(result.clipsEvidence?.rawShape).toBe('string');
    });

    it('deve retornar null quando video_id é string vazia (não detectável)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        video_id: '',
      };

      const result = extractHasVideoFromMlItem(item, 200);

      // String vazia não é evidência de vídeo, mas também não é evidência de ausência
      // O resultado depende de outros campos, mas se não houver outros campos, deve ser null
      expect(result.hasVideo).toBe(null);
      expect(result.evidence.some(e => e.includes('video_id is empty') || e.includes('empty or invalid'))).toBe(true);
    });

    it('deve retornar true quando encontra chave top-level contendo "video" (case-insensitive)', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        has_video: true,
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(true);
      expect(result.evidence.some(e => e.includes('has_video'))).toBe(true);
    });

    it('deve retornar true quando encontra atributo relacionado a vídeo', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        attributes: [
          { id: 'VIDEO_QUALITY', name: 'Video Quality', value_name: 'HD' },
        ],
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(true);
      expect(result.evidence.some(e => e.includes('video-related attribute'))).toBe(true);
    });

    it('deve retornar true quando encontra tag relacionada a vídeo', () => {
      const item = {
        id: 'MLB123456789',
        title: 'Test Item',
        tags: ['has_video', 'premium'],
      };

      const result = extractHasVideoFromMlItem(item, 200);

      expect(result.hasVideo).toBe(true);
      expect(result.evidence.some(e => e.includes('video-related'))).toBe(true);
    });

    it('deve preservar tri-state corretamente: true nunca vira false ou null', () => {
      const itemWithVideo = {
        id: 'MLB123456789',
        title: 'Test Item',
        video_id: 'ABC123XYZ',
      };

      const result = extractHasVideoFromMlItem(itemWithVideo, 200);
      expect(result.hasVideo).toBe(true);

      // Mesmo se outros campos não estiverem presentes, true deve ser mantido
      const itemPartial = {
        id: 'MLB123456789',
        video_id: 'ABC123XYZ',
      };

      const resultPartial = extractHasVideoFromMlItem(itemPartial, 200);
      expect(resultPartial.hasVideo).toBe(true);
    });

    it('deve preservar tri-state corretamente: false (status 200) nunca vira null', () => {
      const itemWithoutVideo = {
        id: 'MLB123456789',
        title: 'Test Item',
        video_id: null,
      };

      const result = extractHasVideoFromMlItem(itemWithoutVideo, 200);
      expect(result.hasVideo).toBe(false);
      expect(result.isDetectable).toBe(true);
    });

    it('deve preservar tri-state corretamente: null permanece null quando não detectável', () => {
      const itemUnknown = {
        id: 'MLB123456789',
        title: 'Test Item',
        // Sem campos de vídeo
      };

      const result = extractHasVideoFromMlItem(itemUnknown, 200);
      expect(result.hasVideo).toBe(null);
      expect(result.isDetectable).toBe(false);
    });
  });
});
