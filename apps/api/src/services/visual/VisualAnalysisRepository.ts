import { PrismaClient } from '@prisma/client';
import type { ListingVisualAnalysis as ListingVisualAnalysisPayload } from '../../types/visual-analysis';
import { VisualAnalysisNormalizer } from './VisualAnalysisNormalizer';
import { VISUAL_ANALYSIS_PROMPT_VERSION } from './visual-analysis.constants';
import type { VisualSignals } from './VisualSignalsBuilder';

type PersistInput = {
  tenantId: string;
  listingId: string;
  analysis: ListingVisualAnalysisPayload;
  imageHash: string | null;
  mainImageUrl: string | null;
  imageSource: string;
  promptVersion: string;
  model: string;
  status: string;
  signals: VisualSignals;
};

export class VisualAnalysisRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly normalizer = new VisualAnalysisNormalizer(),
  ) {}

  async findLatestByCacheKey(input: {
    tenantId: string;
    listingId: string;
    imageHash: string;
    promptVersion: string;
  }): Promise<ListingVisualAnalysisPayload | null> {
    const record = await this.prisma.listingVisualAnalysis.findFirst({
      where: {
        tenant_id: input.tenantId,
        listing_id: input.listingId,
        image_hash: input.imageHash,
        prompt_version: input.promptVersion,
        status: 'success',
      },
      orderBy: {
        analyzed_at: 'desc',
      },
    });

    if (!record) {
      return null;
    }

    const criteria = (record.criteria_json || {}) as Record<string, unknown>;
    const improvements = Array.isArray(record.improvements_json)
      ? (record.improvements_json as string[])
      : [];
    const signals = (record.signals_json || {}) as VisualSignals;

    const hydrated: ListingVisualAnalysisPayload = {
      visual_score: record.visual_score ?? 0,
      summary: record.visual_summary || 'Analise visual disponivel em cache.',
      clarity: criteria.clarity as ListingVisualAnalysisPayload['clarity'],
      contrast: criteria.contrast as ListingVisualAnalysisPayload['contrast'],
      visual_pollution: criteria.visual_pollution as ListingVisualAnalysisPayload['visual_pollution'],
      excessive_text: criteria.excessive_text as ListingVisualAnalysisPayload['excessive_text'],
      differentiation: criteria.differentiation as ListingVisualAnalysisPayload['differentiation'],
      clickability: criteria.clickability as ListingVisualAnalysisPayload['clickability'],
      criteria: criteria as ListingVisualAnalysisPayload['criteria'],
      main_improvements: improvements.length > 0 ? improvements.slice(0, 5) : ['Revisar imagem principal do anuncio.'],
      main_image_url: record.main_image_url,
      analyzed_at: record.analyzed_at.toISOString(),
      model: record.model,
      meta: {
        status: (record.status as 'success' | 'missing_image' | 'model_error' | 'invalid_output') || 'success',
        cache_hit: true,
        prompt_version: record.prompt_version || VISUAL_ANALYSIS_PROMPT_VERSION,
        model: record.model,
        analyzed_at: record.analyzed_at.toISOString(),
        image_hash: record.image_hash,
        image_source: (record.image_source as 'pictures_json_first' | 'thumbnail_url' | 'none') || 'none',
      },
    };

    return this.normalizer.withCacheMetadata(hydrated, true, signals);
  }

  async save(input: PersistInput): Promise<void> {
    await this.prisma.listingVisualAnalysis.create({
      data: {
        tenant_id: input.tenantId,
        listing_id: input.listingId,
        image_hash: input.imageHash,
        main_image_url: input.mainImageUrl,
        image_source: input.imageSource,
        prompt_version: input.promptVersion,
        model: input.model,
        status: input.status,
        visual_score: input.analysis.visual_score,
        visual_summary: input.analysis.summary,
        criteria_json: (input.analysis.criteria || {
          clarity: input.analysis.clarity,
          contrast: input.analysis.contrast,
          visual_pollution: input.analysis.visual_pollution,
          excessive_text: input.analysis.excessive_text,
          differentiation: input.analysis.differentiation,
          clickability: input.analysis.clickability,
        }) as any,
        improvements_json: input.analysis.main_improvements as any,
        signals_json: input.signals as any,
        analyzed_at: new Date(input.analysis.analyzed_at),
      },
    });
  }
}
