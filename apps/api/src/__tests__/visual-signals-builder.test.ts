import { describe, expect, it } from 'vitest';
import { VisualSignalsBuilder } from '../services/visual/VisualSignalsBuilder';

describe('VisualSignalsBuilder', () => {
  const builder = new VisualSignalsBuilder();

  it('gera imageHash deterministico', () => {
    const asset = {
      mainImageUrl: 'https://example.com/main.jpg',
      imageSource: 'pictures_json_first' as const,
      pictureCount: 3,
      imageFingerprintSource: 'pictures_json_first:https://example.com/main.jpg:count:3',
      imageChangedCandidate: 'pictures_json_first:https://example.com/main.jpg:count:3',
    };

    const first = builder.build(asset);
    const second = builder.build(asset);

    expect(first.imageHash).toBe(second.imageHash);
  });

  it('gera sinais corretos para listing com 1 imagem e com galeria', () => {
    const single = builder.build({
      mainImageUrl: 'https://example.com/one.jpg',
      imageSource: 'thumbnail_url',
      pictureCount: 1,
      imageFingerprintSource: 'thumbnail_url:https://example.com/one.jpg:count:1',
      imageChangedCandidate: 'thumbnail_url:https://example.com/one.jpg:count:1',
    });

    const gallery = builder.build({
      mainImageUrl: 'https://example.com/gallery.jpg',
      imageSource: 'pictures_json_first',
      pictureCount: 4,
      imageFingerprintSource: 'pictures_json_first:https://example.com/gallery.jpg:count:4',
      imageChangedCandidate: 'pictures_json_first:https://example.com/gallery.jpg:count:4',
    });

    expect(single.isLowImageCount).toBe(true);
    expect(single.hasGallery).toBe(false);
    expect(single.analysisReadiness).toBe('ready');
    expect(gallery.isLowImageCount).toBe(false);
    expect(gallery.hasGallery).toBe(true);
  });
});
