import type { Prisma } from '@prisma/client';
import type { ListingVisualAnalysis } from '../../types/visual-analysis';
import { VisualAssetResolver } from './VisualAssetResolver';
import { VisualSignalsBuilder } from './VisualSignalsBuilder';
import { VisualAnalysisLLMService } from './VisualAnalysisLLMService';
import { VisualAnalysisNormalizer } from './VisualAnalysisNormalizer';
import { VisualAnalysisRepository } from './VisualAnalysisRepository';
import {
  VISUAL_ANALYSIS_MODEL,
  VISUAL_ANALYSIS_PROMPT_VERSION,
} from './visual-analysis.constants';

export type VisualListingContext = {
  tenantId: string;
  listingId: string;
  title: string;
  category?: string | null;
  pictures_json?: Prisma.JsonValue | null;
  thumbnail_url?: string | null;
  pictures_count?: number | null;
};

export class VisualAnalysisOrchestrator {
  constructor(
    private readonly repository: VisualAnalysisRepository,
    private readonly assetResolver = new VisualAssetResolver(),
    private readonly signalsBuilder = new VisualSignalsBuilder(),
    private readonly llmService = new VisualAnalysisLLMService(),
    private readonly normalizer = new VisualAnalysisNormalizer(),
  ) {}

  async analyzeListing(listing: VisualListingContext): Promise<ListingVisualAnalysis> {
    const asset = this.assetResolver.resolve(listing);
    const signals = this.signalsBuilder.build(asset);

    if (signals.analysisReadiness === 'missing_image') {
      return this.normalizer.createFailure({
        reason: 'imagem principal ausente',
        status: 'missing_image',
        mainImageUrl: null,
        imageSource: asset.imageSource,
        imageHash: signals.imageHash,
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
        model: VISUAL_ANALYSIS_MODEL,
      });
    }

    if (signals.imageHash) {
      const cached = await this.repository.findLatestByCacheKey({
        tenantId: listing.tenantId,
        listingId: listing.listingId,
        imageHash: signals.imageHash,
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
      });

      if (cached) {
        return this.normalizer.withCacheMetadata(cached, true, signals);
      }
    }

    let analysis: ListingVisualAnalysis;

    try {
      const rawResponse = await this.llmService.analyze({
        title: listing.title,
        category: listing.category,
        mainImageUrl: asset.mainImageUrl as string,
      });

      analysis = this.normalizer.normalize({
        rawResponse,
        mainImageUrl: asset.mainImageUrl,
        imageSource: asset.imageSource,
        imageHash: signals.imageHash,
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
        model: VISUAL_ANALYSIS_MODEL,
      });
    } catch (error) {
      analysis = this.normalizer.createFailure({
        reason: error instanceof Error ? error.message : 'falha ao processar analise visual',
        status: 'model_error',
        mainImageUrl: asset.mainImageUrl,
        imageSource: asset.imageSource,
        imageHash: signals.imageHash,
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
        model: VISUAL_ANALYSIS_MODEL,
      });
    }

    await this.repository.save({
      tenantId: listing.tenantId,
      listingId: listing.listingId,
      analysis,
      imageHash: signals.imageHash,
      mainImageUrl: asset.mainImageUrl,
      imageSource: asset.imageSource,
      promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
      model: analysis.model,
      status: analysis.meta?.status || 'success',
      signals,
    });

    return analysis;
  }
}
