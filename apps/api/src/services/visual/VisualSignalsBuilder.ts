import { createHash } from 'crypto';
import type { ResolvedVisualAsset, VisualImageSource } from './VisualAssetResolver';
import { VISUAL_SIGNAL_VERSION } from './visual-analysis.constants';

export type VisualAnalysisReadiness = 'ready' | 'missing_image';

export type VisualSignals = {
  hasMainImage: boolean;
  pictureCount: number;
  isLowImageCount: boolean;
  aspectRatioHint: string | null;
  imageSource: VisualImageSource;
  imageHash: string | null;
  hasGallery: boolean;
  mainImagePosition: 0;
  analysisReadiness: VisualAnalysisReadiness;
  signalVersion: string;
  imageFingerprintSource: string;
};

export class VisualSignalsBuilder {
  build(asset: ResolvedVisualAsset): VisualSignals {
    const hasMainImage = Boolean(asset.mainImageUrl);
    const imageHash = hasMainImage
      ? createHash('sha256')
        .update(
          JSON.stringify({
            mainImageUrl: asset.mainImageUrl,
            pictureCount: asset.pictureCount,
            fingerprintSource: asset.imageFingerprintSource,
          }),
        )
        .digest('hex')
      : null;

    return {
      hasMainImage,
      pictureCount: asset.pictureCount,
      isLowImageCount: asset.pictureCount <= 1,
      aspectRatioHint: null,
      imageSource: asset.imageSource,
      imageHash,
      hasGallery: asset.pictureCount > 1,
      mainImagePosition: 0,
      analysisReadiness: hasMainImage ? 'ready' : 'missing_image',
      signalVersion: VISUAL_SIGNAL_VERSION,
      imageFingerprintSource: asset.imageFingerprintSource,
    };
  }
}
