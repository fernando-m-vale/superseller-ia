import { describe, expect, it } from 'vitest';
import { VisualAssetResolver } from '../services/visual/VisualAssetResolver';

describe('VisualAssetResolver', () => {
  const resolver = new VisualAssetResolver();

  it('usa pictures_json[0] quando disponivel', () => {
    const result = resolver.resolve({
      thumbnail_url: 'https://example.com/thumb.jpg',
      pictures_json: [
        { secure_url: 'https://example.com/main.jpg' },
        { secure_url: 'https://example.com/second.jpg' },
      ],
      pictures_count: 2,
    });

    expect(result.mainImageUrl).toBe('https://example.com/main.jpg');
    expect(result.imageSource).toBe('pictures_json_first');
    expect(result.pictureCount).toBe(2);
  });

  it('faz fallback para thumbnail_url', () => {
    const result = resolver.resolve({
      thumbnail_url: 'https://example.com/thumb.jpg',
      pictures_json: null,
      pictures_count: 1,
    });

    expect(result.mainImageUrl).toBe('https://example.com/thumb.jpg');
    expect(result.imageSource).toBe('thumbnail_url');
  });

  it('lida com ausencia de imagem', () => {
    const result = resolver.resolve({
      thumbnail_url: null,
      pictures_json: 'invalid' as any,
      pictures_count: 0,
    });

    expect(result.mainImageUrl).toBeNull();
    expect(result.imageSource).toBe('none');
    expect(result.imageChangedCandidate).toBeNull();
  });
});
