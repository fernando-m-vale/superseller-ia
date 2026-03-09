import { ListingActionDetailStatus, PrismaClient, Prisma } from '@prisma/client';
import OpenAI from 'openai';
import {
  ACTION_DETAILS_PROMPT_VERSION,
  ActionDetailsV1,
  ActionDetailsV1Schema,
  BuildActionDetailsPromptInput,
  buildActionDetailsPrompt,
} from './ActionDetailsPrompt';
import {
  ActionDetailsV2,
  ActionDetailsV2Schema,
} from './schemas/ActionDetailsV2';
import {
  buildActionDetailsV2Prompt,
  ACTION_DETAILS_V2_PROMPT_VERSION,
} from './actionDetails/prompts/actionDetailsPrompts';
import { validateArtifacts } from './actionDetails/validateArtifacts';
import { applyConcreteFallbackDetails } from './actionDetails/concreteFallback';

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
  details: ActionDetailsV1 | ActionDetailsV2;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface ActionDetailsGenerator {
  generate(prompt: string, schemaVersion?: 'v1' | 'v2'): Promise<DetailsGenerationResult>;
}

export class OpenAIActionDetailsGenerator implements ActionDetailsGenerator {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(prompt: string, schemaVersion: 'v1' | 'v2' = 'v1'): Promise<DetailsGenerationResult> {
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

    const parsedJson = JSON.parse(content);
    
    if (schemaVersion === 'v2') {
      const parsed = ActionDetailsV2Schema.parse(parsedJson);
      return {
        details: parsed,
        model: completion.model || ACTION_DETAILS_MODEL,
        tokensIn: completion.usage?.prompt_tokens ?? null,
        tokensOut: completion.usage?.completion_tokens ?? null,
      };
    }

    const parsed = ActionDetailsV1Schema.parse(parsedJson);
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
    opts?: { schemaVersion?: 'v1' | 'v2' },
  ): Promise<
    | { state: 'ready'; data: ActionDetailsV1 | ActionDetailsV2; cached: boolean; schemaVersion: 'v1' | 'v2' }
    | { state: 'generating' }
  > {
    const schemaVersion = opts?.schemaVersion || 'v1';
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

    const existing = await this.prismaClient.listingActionDetail.findUnique({
      where: {
        actionId_schemaVersion: {
          actionId,
          schemaVersion,
        },
      },
    });

    if (existing?.status === ListingActionDetailStatus.READY && existing.detailsJson) {
      // Parse e validar dados do cache (já são JSON-safe do Prisma)
      const dataParsed = schemaVersion === 'v2'
        ? ActionDetailsV2Schema.parse(existing.detailsJson)
        : ActionDetailsV1Schema.parse(existing.detailsJson);
      const analysisPayload = await this.getLatestAnalysisPayload(action);
      const data = applyConcreteFallbackDetails({
        actionKey: action.actionKey,
        schemaVersion,
        details: dataParsed,
        analysisPayload,
      });
      return { state: 'ready', data, cached: true, schemaVersion };
    }

    const recentlyGenerating =
      existing?.status === ListingActionDetailStatus.GENERATING
      && existing.updatedAt.getTime() > Date.now() - GENERATING_WINDOW_MS;

    if (recentlyGenerating) {
      return { state: 'generating' };
    }

    await this.ensureGeneratingState(action, schemaVersion);

    if (!this.generator) {
      await this.markFailed(action, 'OpenAI API key não configurada.');
      throw new ActionDetailsError('Não foi possível gerar os detalhes agora. Tente novamente em instantes.', 500);
    }

    try {
      const { promptInput, analysisPayload } = await this.buildPromptInput(action);
      
      let prompt: string;
      let promptVersion: string;
      
      if (schemaVersion === 'v2') {
        prompt = buildActionDetailsV2Prompt(promptInput, action.actionKey);
        promptVersion = ACTION_DETAILS_V2_PROMPT_VERSION;
      } else {
        prompt = buildActionDetailsPrompt(promptInput);
        promptVersion = ACTION_DETAILS_PROMPT_VERSION;
      }
      
      const generation = await this.generator.generate(prompt, schemaVersion);

      // Validação V2: verificar artifacts obrigatórios
      if (schemaVersion === 'v2') {
        const validation = validateArtifacts(generation.details as ActionDetailsV2, action.actionKey);
        if (!validation.isValid) {
          // Retry 1x com prompt "repair"
          try {
            const repairPrompt = `${prompt}\n\nERRO: Faltam os seguintes artifacts obrigatórios: ${validation.missingArtifacts.join(', ')}. Gere novamente incluindo TODOS os artifacts obrigatórios.`;
            const repairGeneration = await this.generator.generate(repairPrompt, schemaVersion);
            const repairValidation = validateArtifacts(repairGeneration.details as ActionDetailsV2, action.actionKey);
            
            if (!repairValidation.isValid) {
              await this.markFailed(action, repairValidation.errorMessage || 'Artifacts obrigatórios ausentes após retry');
              throw new ActionDetailsError('Não foi possível gerar todos os artifacts obrigatórios. Tente novamente em instantes.', 500);
            }
            
            // Usar resultado do repair
            generation.details = repairGeneration.details;
            generation.model = repairGeneration.model;
            generation.tokensIn = (generation.tokensIn || 0) + (repairGeneration.tokensIn || 0);
            generation.tokensOut = (generation.tokensOut || 0) + (repairGeneration.tokensOut || 0);
          } catch (retryError) {
            await this.markFailed(action, retryError instanceof Error ? retryError.message : 'Erro no retry de validação');
            throw new ActionDetailsError('Não foi possível gerar os detalhes agora. Tente novamente em instantes.', 500);
          }
        }
      }

      const detailsWithFallback = applyConcreteFallbackDetails({
        actionKey: action.actionKey,
        schemaVersion,
        details: generation.details,
        analysisPayload,
      });

      // Garantir que detailsJson seja JSON-safe para Prisma
      // Após validação Zod, o objeto já é JSON-safe, mas fazemos cast explícito para satisfazer TypeScript
      const detailsJsonSafe = detailsWithFallback as Prisma.InputJsonValue;

      await this.prismaClient.listingActionDetail.upsert({
        where: {
          actionId_schemaVersion: {
            actionId,
            schemaVersion,
          },
        },
        create: {
          actionId,
          listingId: action.listingId,
          batchId: action.batchId,
          actionKey: action.actionKey,
          schemaVersion,
          status: ListingActionDetailStatus.READY,
          detailsJson: detailsJsonSafe,
          generatedAt: new Date(),
          model: generation.model,
          promptVersion,
          costTokensIn: generation.tokensIn,
          costTokensOut: generation.tokensOut,
          errorMessage: null,
        },
        update: {
          status: ListingActionDetailStatus.READY,
          detailsJson: detailsJsonSafe,
          generatedAt: new Date(),
          model: generation.model,
          promptVersion,
          costTokensIn: generation.tokensIn,
          costTokensOut: generation.tokensOut,
          errorMessage: null,
        },
      });

      return { state: 'ready', data: detailsWithFallback, cached: false, schemaVersion };
    } catch (error) {
      await this.markFailed(action, error instanceof Error ? error.message : 'Erro inesperado', schemaVersion);
      throw new ActionDetailsError('Não foi possível gerar os detalhes agora. Tente novamente em instantes.', 500);
    }
  }

  private async ensureGeneratingState(
    action: NonNullable<ListingActionWithListing>,
    schemaVersion: 'v1' | 'v2' = 'v1',
  ): Promise<void> {
    try {
      await this.prismaClient.listingActionDetail.upsert({
        where: {
          actionId_schemaVersion: {
            actionId: action.id,
            schemaVersion,
          },
        },
        create: {
          actionId: action.id,
          listingId: action.listingId,
          batchId: action.batchId,
          actionKey: action.actionKey,
          schemaVersion,
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

  private async markFailed(
    action: NonNullable<ListingActionWithListing>,
    message: string,
    schemaVersion: 'v1' | 'v2' = 'v1',
  ): Promise<void> {
    await this.prismaClient.listingActionDetail.upsert({
      where: {
        actionId_schemaVersion: {
          actionId: action.id,
          schemaVersion,
        },
      },
      create: {
        actionId: action.id,
        listingId: action.listingId,
        batchId: action.batchId,
        actionKey: action.actionKey,
        schemaVersion,
        status: ListingActionDetailStatus.FAILED,
        errorMessage: message,
      },
      update: {
        status: ListingActionDetailStatus.FAILED,
        errorMessage: message,
      },
    });
  }

  private async getLatestAnalysisPayload(
    action: NonNullable<ListingActionWithListing>,
  ): Promise<Record<string, unknown> | null> {
    const latestAnalysis = await this.prismaClient.listingAIAnalysis.findFirst({
      where: {
        tenant_id: action.listing.tenant_id,
        listing_id: action.listingId,
      },
      orderBy: { created_at: 'desc' },
    });

    return (latestAnalysis?.result_json as Record<string, unknown> | null) ?? null;
  }

  private async buildPromptInput(action: NonNullable<ListingActionWithListing>): Promise<{
    promptInput: BuildActionDetailsPromptInput;
    analysisPayload: Record<string, unknown> | null;
  }> {
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
      analysisPayload,
      promptInput: {
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
      },
    };
  }
}
