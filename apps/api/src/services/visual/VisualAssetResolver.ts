import type { Prisma } from '@prisma/client';

export type VisualImageSource = 'pictures_json_first' | 'thumbnail_url' | 'none';

export type VisualListingAssetInput = {
  pictures_json?: Prisma.JsonValue | null;
  thumbnail_url?: string | null;
  pictures_count?: number | null;
};

export type ResolvedVisualAsset = {
  mainImageUrl: string | null;
  imageSource: VisualImageSource;
  pictureCount: number;
  imageFingerprintSource: string;
  imageChangedCandidate: string | null;
};

export class VisualAssetResolver {
  resolve(listing: VisualListingAssetInput): ResolvedVisualAsset {
    const pictureUrls = this.extractPictureUrls(listing.pictures_json);
    const firstPictureUrl = pictureUrls[0] ?? null;
    const thumbnailUrl = this.normalizeUrl(listing.thumbnail_url);
    const pictureCount =
      pictureUrls.length > 0
        ? pictureUrls.length
        : Math.max(Number(listing.pictures_count || 0), thumbnailUrl ? 1 : 0);

    if (firstPictureUrl) {
      const fingerprint = `pictures_json_first:${firstPictureUrl}:count:${pictureCount}`;
      return {
        mainImageUrl: firstPictureUrl,
        imageSource: 'pictures_json_first',
        pictureCount,
        imageFingerprintSource: fingerprint,
        imageChangedCandidate: fingerprint,
      };
    }

    if (thumbnailUrl) {
      const fingerprint = `thumbnail_url:${thumbnailUrl}:count:${pictureCount}`;
      return {
        mainImageUrl: thumbnailUrl,
        imageSource: 'thumbnail_url',
        pictureCount,
        imageFingerprintSource: fingerprint,
        imageChangedCandidate: fingerprint,
      };
    }

    return {
      mainImageUrl: null,
      imageSource: 'none',
      pictureCount: Math.max(Number(listing.pictures_count || 0), 0),
      imageFingerprintSource: 'none',
      imageChangedCandidate: null,
    };
  }

  private extractPictureUrls(pictures: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(pictures)) {
      return [];
    }

    return pictures
      .map((picture) => {
        if (!picture || typeof picture !== 'object') {
          return null;
        }

        const candidate = picture as Record<string, unknown>;
        return this.normalizeUrl(candidate.secure_url ?? candidate.url);
      })
      .filter((url): url is string => Boolean(url));
  }

  private normalizeUrl(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }
}
