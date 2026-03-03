import { ListingActionDetailStatus, PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import {
  ACTION_DETAILS_PROMPT_VERSION,
  ActionDetailsV1,
  ActionDetailsV1Schema,
  BuildActionDetailsPromptInput,
  buildActionDetailsPrompt,
} from './ActionDetailsPrompt';

const prisma = new PrismaClient();
const GENERATING_WINDOW_MS = 2 * 60 * 1000;
const ACTION_DETAILS_MODEL = 'gpt-4o-mini';

type ListingActionWithListing = Awaited<ReturnType<PrismaClient['listingAction']['findFirst']>> & {
  listing: {
    tenant_id: string;
    listing_id_ext: string;
    title: string;
    category: string | null;
    price: unknown;
    price_final: unknown;
    original_price: unknown;
    has_promotion: boolean;
    discount_percent: number | null;
  };
};

export class ActionDetailsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface DetailsGenerationResult {
  details: ActionDetailsV1;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface ActionDetailsGenerator {
  generate(prompt: string): Promise<DetailsGenerationResult>;
}

export class OpenAIActionDetailsGenerator implements ActionDetailsGenerator {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(prompt: string): Promise<DetailsGenerationResult> {
    const completion = await this.client.chat.completions.create({
      model: ACTION_DETAILS_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Você retorna apenas JSON válido.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('LLM retornou resposta vazia para detalhes da ação');
    }

    const parsed = ActionDetailsV1Schema.parse(JSON.parse(content));
    return {
      details: parsed,
      model: completion.model || ACTION_DETAILS_MODEL,
      tokensIn: completion.usage?.prompt_tokens ?? null,
      tokensOut: completion.usage?.completion_tokens ?? null,
    };
  }
}

export class ActionDetailsService {
  constructor(
    private readonly prismaClient: PrismaClient = prisma,
    private readonly generator: ActionDetailsGenerator | null = process.env.OPENAI_API_KEY
      ? new OpenAIActionDetailsGenerator(process.env.OPENAI_API_KEY)
      : null,
  ) {}

  async getOrGenerate(
    tenantId: string,
    listingId: string,
    actionId: string,
  ): Promise<{ state: 'ready'; data: ActionDetailsV1; cached: boolean } | { state: 'generating' }> {
    const action = (await this.prismaClient.listingAction.findFirst({
      where: {
        id: actionId,
        listingId,
        listing: { tenant_id: tenantId },
      },
      include: {
        listing: {
          select: {
            tenant_id: true,
            listing_id_ext: true,
            title: true,
            category: true,
            price: true,
            price_final: true,
            original_price: true,
            has_promotion: true,
            discount_percent: true,
          },
        },
      },
    })) as ListingActionWithListing | null;

    if (!action) {
      throw new ActionDetailsError('Ação não encontrada para este listing.', 404);
    }

    const existing = await this.prismaClient.listingActionDetail.findUnique({ where: { actionId } });

    if (existing?.status === ListingActionDetailStatus.READY && existing.detailsJson) {
      return { state: 'ready', data: ActionDetailsV1Schema.parse(existing.detailsJson), cached: true };
    }

    const recentlyGenerating =
      existing?.status === ListingActionDetailStatus.GENERATING
      && existing.updatedAt.getTime() > Date.now() - GENERATING_WINDOW_MS;

    if (recentlyGenerating) {
      return { state: 'generating' };
    }

    await this.ensureGeneratingState(action);

    if (!this.generator) {
      await this.markFailed(action, 'OpenAI API key não configurada.');
      throw new ActionDetailsError('Não foi possível gerar os detalhes agora. Tente novamente em instantes.', 500);
    }

    try {
      const promptInput = await this.buildPromptInput(action);
      const generation = await this.generator.generate(buildActionDetailsPrompt(promptInput));

      await this.prismaClient.listingActionDetail.upsert({
        where: { actionId },
        create: {
          actionId,
          listingId: action.listingId,
          batchId: action.batchId,
          actionKey: action.actionKey,
          status: ListingActionDetailStatus.READY,
          detailsJson: generation.details,
          generatedAt: new Date(),
          model: generation.model,
          promptVersion: ACTION_DETAILS_PROMPT_VERSION,
          costTokensIn: generation.tokensIn,
          costTokensOut: generation.tokensOut,
          errorMessage: null,
        },
        update: {
          status: ListingActionDetailStatus.READY,
          detailsJson: generation.details,
          generatedAt: new Date(),
          model: generation.model,
          promptVersion: ACTION_DETAILS_PROMPT_VERSION,
          costTokensIn: generation.tokensIn,
          costTokensOut: generation.tokensOut,
          errorMessage: null,
        },
      });

      return { state: 'ready', data: generation.details, cached: false };
    } catch (error) {
      await this.markFailed(action, error instanceof Error ? error.message : 'Erro inesperado');
      throw new ActionDetailsError('Não foi possível gerar os detalhes agora. Tente novamente em instantes.', 500);
    }
  }

  private async ensureGeneratingState(action: NonNullable<ListingActionWithListing>): Promise<void> {
    try {
      await this.prismaClient.listingActionDetail.upsert({
        where: { actionId: action.id },
        create: {
          actionId: action.id,
          listingId: action.listingId,
          batchId: action.batchId,
          actionKey: action.actionKey,
          status: ListingActionDetailStatus.GENERATING,
        },
        update: {
          status: ListingActionDetailStatus.GENERATING,
          errorMessage: null,
        },
      });
    } catch {
      // best-effort lock
    }
  }

  private async markFailed(action: NonNullable<ListingActionWithListing>, message: string): Promise<void> {
    await this.prismaClient.listingActionDetail.upsert({
      where: { actionId: action.id },
      create: {
        actionId: action.id,
        listingId: action.listingId,
        batchId: action.batchId,
        actionKey: action.actionKey,
        status: ListingActionDetailStatus.FAILED,
        errorMessage: message,
      },
      update: {
        status: ListingActionDetailStatus.FAILED,
        errorMessage: message,
      },
    });
  }

  private async buildPromptInput(action: NonNullable<ListingActionWithListing>): Promise<BuildActionDetailsPromptInput> {
    const [metrics, latestAnalysis] = await Promise.all([
      this.prismaClient.listingMetricsDaily.findMany({
        where: {
          tenant_id: action.listing.tenant_id,
          listing_id: action.listingId,
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prismaClient.listingAIAnalysis.findFirst({
        where: {
          tenant_id: action.listing.tenant_id,
          listing_id: action.listingId,
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const visits = metrics.reduce((acc, item) => acc + (item.visits ?? 0), 0);
    const orders = metrics.reduce((acc, item) => acc + item.orders, 0);
    const revenue = metrics.reduce((acc, item) => acc + Number(item.gmv), 0);

    const analysisPayload = (latestAnalysis?.result_json as Record<string, unknown> | null) ?? null;
    const benchmark = analysisPayload?.benchmark as Record<string, any> | undefined;
    const analysisActions = (analysisPayload?.actions as Array<Record<string, any>> | undefined) ?? [];
    const suggestedAction = analysisActions.find(
      (item) => item.actionKey === action.actionKey || item.id === action.actionKey || item.title === action.title,
    );

    return {
      listing: {
        idExt: action.listing.listing_id_ext,
        title: action.listing.title,
        category: action.listing.category,
        breadcrumb: action.listing.category,
      },
      metrics30d: {
        visits,
        orders,
        conversionRate: visits > 0 ? orders / visits : null,
        revenue,
      },
      pricingNormalized: {
        price: Number(action.listing.price),
        priceFinal: action.listing.price_final ? Number(action.listing.price_final) : null,
        originalPrice: action.listing.original_price ? Number(action.listing.original_price) : null,
        hasPromotion: Boolean(action.listing.has_promotion),
        discountPercent: action.listing.discount_percent,
      },
      benchmark: benchmark
        ? {
            available: true,
            confidence: benchmark?.benchmarkSummary?.confidence ?? null,
            baselineConversionRate: benchmark?.benchmarkSummary?.baselineConversion ?? null,
            medianPrice: benchmark?.benchmarkSummary?.stats?.price?.median ?? null,
            p25Price: benchmark?.benchmarkSummary?.stats?.price?.p25 ?? null,
            p75Price: benchmark?.benchmarkSummary?.stats?.price?.p75 ?? null,
          }
        : { available: false },
      action: {
        actionKey: action.actionKey,
        title: action.title,
        description: action.description,
        expectedImpact: action.expectedImpact,
        priority: action.priority,
        suggestedActionUrl: suggestedAction?.suggestedActionUrl ?? null,
      },
    };
  }
}
