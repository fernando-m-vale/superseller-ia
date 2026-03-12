import type { Prisma } from '@prisma/client';
import {
  createFallbackVisualAnalysis,
  type ListingVisualAnalysis,
} from '../types/visual-analysis';
import { VisualAssetResolver } from './visual/VisualAssetResolver';
import { VisualSignalsBuilder } from './visual/VisualSignalsBuilder';
import { VisualAnalysisLLMService, type OpenAIClientLike } from './visual/VisualAnalysisLLMService';
import { VisualAnalysisNormalizer } from './visual/VisualAnalysisNormalizer';
import {
  VISUAL_ANALYSIS_MODEL,
  VISUAL_ANALYSIS_PROMPT_VERSION,
} from './visual/visual-analysis.constants';

type ListingImageSource = {
  thumbnail_url?: string | null;
  pictures_json?: Prisma.JsonValue | null;
  pictures_count?: number | null;
};

export class VisualAnalysisService {
  private readonly assetResolver = new VisualAssetResolver();
  private readonly signalsBuilder = new VisualSignalsBuilder();
  private readonly llmService: VisualAnalysisLLMService;
  private readonly normalizer = new VisualAnalysisNormalizer();

  constructor(client?: OpenAIClientLike | null) {
    this.llmService = new VisualAnalysisLLMService(client);
  }

  resolveMainImageUrl(listing: ListingImageSource): string | null {
    return this.assetResolver.resolve(listing).mainImageUrl;
  }

  async analyzeMainImage(input: {
    title: string;
    category?: string | null;
    mainImageUrl: string | null;
  }): Promise<ListingVisualAnalysis> {
    if (!input.mainImageUrl) {
      return createFallbackVisualAnalysis({
        mainImageUrl: null,
        reason: 'imagem principal ausente',
        status: 'missing_image',
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
      });
    }

    try {
      new URL(input.mainImageUrl);
    } catch {
      return createFallbackVisualAnalysis({
        mainImageUrl: input.mainImageUrl,
        reason: 'URL da imagem principal invalida',
        status: 'invalid_output',
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
      });
    }

    const asset = this.assetResolver.resolve({
      thumbnail_url: input.mainImageUrl,
      pictures_count: 1,
    });
    const signals = this.signalsBuilder.build(asset);

    try {
      const rawResponse = await this.llmService.analyze({
        title: input.title,
        category: input.category,
        mainImageUrl: input.mainImageUrl,
      });

      return this.normalizer.normalize({
        rawResponse,
        mainImageUrl: input.mainImageUrl,
        imageSource: asset.imageSource,
        imageHash: signals.imageHash,
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
        model: VISUAL_ANALYSIS_MODEL,
      });
    } catch (error) {
      return createFallbackVisualAnalysis({
        mainImageUrl: input.mainImageUrl,
        reason: error instanceof Error ? error.message : 'falha ao interpretar resposta visual',
        status: 'model_error',
        promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
        imageHash: signals.imageHash,
        imageSource: asset.imageSource,
        model: VISUAL_ANALYSIS_MODEL,
      });
    }
  }
}
