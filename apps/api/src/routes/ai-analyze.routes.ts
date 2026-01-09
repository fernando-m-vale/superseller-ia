/**
 * AI Analyze Routes
 * 
 * Endpoints for AI-powered listing analysis using OpenAI GPT-4o.
 * Includes fingerprint-based caching to reduce OpenAI API costs.
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OpenAIService } from '../services/OpenAIService';
import { IAScoreService } from '../services/IAScoreService';
import { authGuard } from '../plugins/auth';
import { sanitizeOpenAIError } from '../utils/sanitize-error';
import { generateFingerprint, buildFingerprintInput, PROMPT_VERSION } from '../utils/ai-fingerprint';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateActionPlan, DataQuality, MediaInfo } from '../services/ScoreActionEngine';
import { explainScore } from '../services/ScoreExplanationService';
import { getMediaVerdict } from '../utils/media-verdict';

const prisma = new PrismaClient();

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

const AnalyzeParamsSchema = z.object({
  listingId: z.string().uuid(),
});

const AnalyzeQuerySchema = z.object({
  forceRefresh: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});

export const aiAnalyzeRoutes: FastifyPluginCallback = (app, _, done) => {
  /**
   * POST /api/v1/ai/analyze/:listingId
   * 
   * Analyzes a listing using OpenAI GPT-4o and generates:
   * - A score (0-100)
   * - A short critique
   * - 3 actionable growth hacks
   * - SEO suggestions (title/description)
   * 
   * The results are saved as recommendations in the database.
   * Uses canonical payload V1 with 30-day metrics by default.
   */
  const PERIOD_DAYS = 30; // Default period for metrics aggregation

  /**
   * GET /api/v1/ai/score/:listingId
   * 
   * Calcula e retorna o IA Score Model V1 para um listing.
   * Score explicável, baseado em dados reais, sem alucinação.
   */
  app.get<{ Params: { listingId: string } }>(
    '/score/:listingId',
    { preHandler: authGuard },
    async (request: FastifyRequest<{ Params: { listingId: string } }>, reply: FastifyReply) => {
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        if (!tenantId) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado',
          });
        }

        const params = AnalyzeParamsSchema.parse(request.params);
        const { listingId } = params;

        request.log.info({ 
          requestId,
          userId,
          tenantId,
          listingId,
          periodDays: PERIOD_DAYS,
        }, 'Calculating IA Score');

        const scoreService = new IAScoreService(tenantId);
        const result = await scoreService.calculateScore(listingId, PERIOD_DAYS);

        request.log.info(
          {
            requestId,
            userId,
            tenantId,
            listingId,
            finalScore: result.score.final,
            breakdown: result.score.breakdown,
            performanceSource: result.dataQuality.sources.performance,
            completenessScore: result.dataQuality.completenessScore,
          },
          'IA Score calculated'
        );

        return reply.status(200).send({
          message: 'Score calculado com sucesso',
          data: result,
        });
      } catch (error) {
        const { listingId } = (request.params as { listingId: string }) || {};

        request.log.error({ 
          requestId,
          userId,
          tenantId,
          listingId,
          err: error 
        }, 'Error calculating IA Score');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'ID do anúncio inválido',
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro ao calcular score';
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  app.post<{ Params: { listingId: string }; Querystring: { forceRefresh?: string } }>(
    '/analyze/:listingId',
    { preHandler: authGuard },
    async (request: FastifyRequest<{ Params: { listingId: string }; Querystring: { forceRefresh?: string } }>, reply: FastifyReply) => {
      // Declarar variáveis de contexto uma vez no topo do handler
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        if (!tenantId) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado',
          });
        }

        const params = AnalyzeParamsSchema.parse(request.params);
        const query = AnalyzeQuerySchema.parse(request.query);
        const { listingId } = params;
        const forceRefresh = query.forceRefresh ?? false;

        request.log.info({ 
          requestId,
          userId,
          tenantId,
          listingId,
          periodDays: PERIOD_DAYS,
          forceRefresh,
        }, 'Starting AI analysis');

        const service = new OpenAIService(tenantId);

        if (!service.isAvailable()) {
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'OpenAI API key not configured. Please contact support.',
          });
        }

        // Step 1: Get listing data for fingerprint calculation
        const listing = await prisma.listing.findFirst({
          where: {
            id: listingId,
            tenant_id: tenantId,
          },
        });

        if (!listing) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Anúncio não encontrado',
          });
        }

        // Step 2: Calculate score to get metrics for fingerprint
        const scoreService = new IAScoreService(tenantId);
        const scoreResult = await scoreService.calculateScore(listingId, PERIOD_DAYS);

        // Step 3: Build fingerprint from listing + metrics
        const fingerprintInput = buildFingerprintInput(
          {
            title: listing.title,
            price: listing.price,
            category: listing.category,
            pictures_count: listing.pictures_count,
            has_video: listing.has_video,
            status: listing.status,
            stock: listing.stock,
            updated_at: listing.updated_at,
          },
          {
            orders: scoreResult.metrics_30d.orders,
            revenue: scoreResult.metrics_30d.revenue,
            visitsCoverage: scoreResult.dataQuality.visitsCoverage,
          },
          PERIOD_DAYS
        );
        const fingerprint = generateFingerprint(fingerprintInput);

        // Step 4: Check cache (unless forceRefresh)
        type CachedAnalysisResult = {
          analysis: {
            score: number;
            critique: string;
            growthHacks: Array<{ title: string; description: string; priority: string; estimatedImpact: string }>;
            seoSuggestions: { suggestedTitle: string; titleRationale: string; suggestedDescriptionPoints: string[]; keywords: string[] };
            analyzedAt: string;
            model: string;
          };
          savedRecommendations: number;
        };

        let cachedResult: CachedAnalysisResult | null = null;

        if (!forceRefresh) {
          const cached = await prisma.listingAIAnalysis.findFirst({
            where: {
              tenant_id: tenantId,
              listing_id: listingId,
              period_days: PERIOD_DAYS,
              fingerprint,
            },
          });

          if (cached && cached.result_json) {
            cachedResult = cached.result_json as CachedAnalysisResult;
            
            request.log.info(
              {
                requestId,
                userId,
                tenantId,
                listingId,
                fingerprint: fingerprint.substring(0, 16) + '...',
                cacheHit: true,
              },
              'AI analysis cache hit'
            );
          }
        }

        // Step 5: If cache miss or forceRefresh, call OpenAI
        if (!cachedResult) {
          const result = await service.analyzeAndSaveRecommendations(
            listingId,
            userId,
            requestId,
            PERIOD_DAYS
          );

          // Step 6: Save to cache
          try {
            await prisma.listingAIAnalysis.upsert({
              where: {
                tenant_id_listing_id_period_days_fingerprint: {
                  tenant_id: tenantId,
                  listing_id: listingId,
                  period_days: PERIOD_DAYS,
                  fingerprint,
                },
              },
              update: {
                model: result.analysis.model || 'gpt-4o',
                prompt_version: PROMPT_VERSION,
                result_json: {
                  analysis: {
                    score: result.analysis.score,
                    critique: result.analysis.critique,
                    growthHacks: result.analysis.growthHacks,
                    seoSuggestions: result.analysis.seoSuggestions,
                    analyzedAt: result.analysis.analyzedAt,
                    model: result.analysis.model,
                  },
                  savedRecommendations: result.savedRecommendations,
                } as unknown as Prisma.InputJsonValue,
                updated_at: new Date(),
              },
              create: {
                tenant_id: tenantId,
                listing_id: listingId,
                period_days: PERIOD_DAYS,
                fingerprint,
                model: result.analysis.model || 'gpt-4o',
                prompt_version: PROMPT_VERSION,
                result_json: {
                  analysis: {
                    score: result.analysis.score,
                    critique: result.analysis.critique,
                    growthHacks: result.analysis.growthHacks,
                    seoSuggestions: result.analysis.seoSuggestions,
                    analyzedAt: result.analysis.analyzedAt,
                    model: result.analysis.model,
                  },
                  savedRecommendations: result.savedRecommendations,
                } as unknown as Prisma.InputJsonValue,
              },
            });
          } catch (cacheError) {
            // Log but don't fail if cache save fails
            request.log.warn({ err: cacheError, listingId, fingerprint: fingerprint.substring(0, 16) + '...' }, 'Failed to save AI analysis to cache');
          }

          // Generate action plan and score explanation (IA Score V2)
          const dataQualityForActions: DataQuality = {
            performanceAvailable: result.dataQuality.performanceAvailable,
            visitsCoverage: result.dataQuality.visitsCoverage,
            videoStatusKnown: listing.has_video !== null, // false quando has_video = null (não detectável via API)
          };
          const actionPlan = generateActionPlan(
            result.score.score.breakdown,
            dataQualityForActions,
            result.score.score.potential_gain,
            {
              hasVideo: listing.has_video,
              picturesCount: listing.pictures_count,
            }
          );
          const scoreExplanation = explainScore(
            result.score.score.breakdown,
            dataQualityForActions,
            {
              hasVideo: listing.has_video,
              picturesCount: listing.pictures_count,
            }
          );
          
          // DEBUG: Log mediaInfo antes de gerar MediaVerdict
          const mediaInfo = {
            hasVideo: listing.has_video,
            hasClips: listing.has_clips,
            picturesCount: listing.pictures_count,
          };
          request.log.info(
            {
              listingId,
              listingIdExt: listing.listing_id_ext,
              marketplace: listing.marketplace,
              mediaInfo,
            },
            '[MEDIA-VERDICT-DEBUG] MediaInfo antes de gerar MediaVerdict'
          );
          
          // Gerar MediaVerdict para incluir na resposta
          const mediaVerdict = getMediaVerdict(listing.has_video, listing.pictures_count);
          
          // DEBUG: Log MediaVerdict result
          request.log.info(
            {
              listingId,
              listingIdExt: listing.listing_id_ext,
              mediaVerdict,
            },
            '[MEDIA-VERDICT-DEBUG] MediaVerdict gerado'
          );

          request.log.info(
            {
              requestId,
              userId,
              tenantId,
              listingId,
              score: result.analysis.score,
              growthHacksCount: result.analysis.growthHacks.length,
              savedRecommendations: result.savedRecommendations,
              performanceSource: result.dataQuality.sources.performance,
              completenessScore: result.dataQuality.completenessScore,
              cacheHit: false,
              fingerprint: fingerprint.substring(0, 16) + '...',
              actionPlanCount: actionPlan.length,
            },
            'AI analysis complete (cache miss)'
          );

          return reply.status(200).send({
            message: 'Análise concluída com sucesso',
            data: {
              listingId,
              score: result.score.score.final,
              scoreBreakdown: result.score.score.breakdown,
              potentialGain: result.score.score.potential_gain,
              critique: result.analysis.critique,
              growthHacks: result.analysis.growthHacks,
              seoSuggestions: result.analysis.seoSuggestions,
              savedRecommendations: result.savedRecommendations,
              analyzedAt: result.analysis.analyzedAt,
              model: result.analysis.model,
              metrics30d: result.score.metrics_30d,
              dataQuality: result.dataQuality,
              cacheHit: false,
              // IA Score V2: Action Plan and Score Explanation
              actionPlan,
              scoreExplanation,
              // MediaVerdict - Fonte única de verdade para mídia
              mediaVerdict,
            },
          });
        }

        // Step 7: Return cached result
        if (!cachedResult) {
          // This should never happen due to the check above, but TypeScript needs it
          return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Erro ao recuperar análise em cache',
          });
        }

        // Generate action plan and score explanation (IA Score V2)
        // Use fresh scoreResult for actionPlan since it's based on current score
        const dataQualityForActions: DataQuality = {
          performanceAvailable: scoreResult.dataQuality.performanceAvailable,
          visitsCoverage: scoreResult.dataQuality.visitsCoverage,
          videoStatusKnown: listing.has_video !== null, // false quando has_video = null (não detectável via API)
        };
        const actionPlan = generateActionPlan(
          scoreResult.score.breakdown,
          dataQualityForActions,
          scoreResult.score.potential_gain,
          {
            hasVideo: listing.has_video,
            picturesCount: listing.pictures_count,
          }
        );
        const scoreExplanation = explainScore(
          scoreResult.score.breakdown,
          dataQualityForActions,
          {
            hasVideo: listing.has_video,
            picturesCount: listing.pictures_count,
          }
        );
        
        // DEBUG: Log mediaInfo antes de gerar MediaVerdict
        const mediaInfo = {
          hasVideo: listing.has_video,
          hasClips: listing.has_clips,
          picturesCount: listing.pictures_count,
        };
        request.log.info(
          {
            listingId,
            listingIdExt: listing.listing_id_ext,
            marketplace: listing.marketplace,
            mediaInfo,
          },
          '[MEDIA-VERDICT-DEBUG] MediaInfo antes de gerar MediaVerdict (cache)'
        );
        
        // Gerar MediaVerdict para incluir na resposta
        const mediaVerdict = getMediaVerdict(listing.has_video, listing.pictures_count);
        
        // DEBUG: Log MediaVerdict result
        request.log.info(
          {
            listingId,
            listingIdExt: listing.listing_id_ext,
            mediaVerdict,
          },
          '[MEDIA-VERDICT-DEBUG] MediaVerdict gerado (cache)'
        );

        return reply.status(200).send({
          message: 'Análise concluída com sucesso (cache)',
          data: {
            listingId,
            score: scoreResult.score.final,
            scoreBreakdown: scoreResult.score.breakdown,
            potentialGain: scoreResult.score.potential_gain,
            critique: cachedResult.analysis.critique,
            growthHacks: cachedResult.analysis.growthHacks,
            seoSuggestions: cachedResult.analysis.seoSuggestions,
            savedRecommendations: cachedResult.savedRecommendations,
            analyzedAt: cachedResult.analysis.analyzedAt,
            model: cachedResult.analysis.model,
            metrics30d: scoreResult.metrics_30d,
            dataQuality: scoreResult.dataQuality,
            cacheHit: true,
            // IA Score V2: Action Plan and Score Explanation
            actionPlan,
            scoreExplanation,
            // MediaVerdict - Fonte única de verdade para mídia
            mediaVerdict,
          },
        });
      } catch (error) {
        const { listingId } = (request.params as { listingId: string }) || {};

        // Log erro sanitizado (sem tokens/secrets)
        // Reutilizar variáveis já declaradas no topo do handler
        request.log.error({ 
          requestId,
          userId,
          tenantId,
          listingId,
          err: error 
        }, 'Error analyzing listing');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'ID do anúncio inválido',
          });
        }

        // Detectar erros da OpenAI SDK
        const openAIError = error as Record<string, unknown>;
        const response = openAIError?.response as Record<string, unknown> | undefined;
        const statusCode = (openAIError?.status || openAIError?.statusCode || response?.status) as number | undefined;
        const errorType = (openAIError?.type || openAIError?.code) as string | undefined;
        const responseData = response?.data as Record<string, unknown> | undefined;
        const responseError = responseData?.error as Record<string, unknown> | undefined;
        
        // Detectar 429 (Rate Limit / Quota)
        const isRateLimit = 
          statusCode === 429 ||
          errorType === 'insufficient_quota' ||
          errorType === 'rate_limit_exceeded' ||
          responseError?.code === 'rate_limit_exceeded';

        if (isRateLimit) {
          return reply.status(429).send({
            error: 'Rate limit / Quota',
            message: 'Limite de uso da IA atingido. Tente novamente mais tarde.',
          });
        }

        // Sanitizar erro da OpenAI
        const sanitized = sanitizeOpenAIError(error);

        // Retornar erro sanitizado (sem detalhes internos)
        return reply.status(sanitized.statusCode || 500).send({
          error: 'Internal Server Error',
          message: sanitized.message,
        });
      }
    }
  );

  /**
   * GET /api/v1/ai/status
   * 
   * Check if the AI service is available and configured.
   * Always returns 200 OK, even if the service is not configured.
   */



  app.get(
    '/status',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Declarar variáveis de contexto uma vez no topo do handler
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        if (!tenantId) {
          return reply.status(401).send({
            status: 'online',
            keyConfigured: false,
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado',
          });
        }

        // Verificar se a API key está configurada sem instanciar o serviço
        // para evitar qualquer possível erro de inicialização
        const apiKey = process.env.OPENAI_API_KEY;
        const keyConfigured = Boolean(apiKey && apiKey.trim().length > 0);

        // Tentar instanciar o serviço de forma segura
        let isAvailable = false;
        try {
          const service = new OpenAIService(tenantId);
          isAvailable = service.isAvailable();
        } catch (serviceError) {
          request.log.warn({ requestId, userId, tenantId, err: serviceError }, 'Error checking service availability');
          // Continuar mesmo se houver erro, retornando keyConfigured
        }

        // Sempre retornar 200 OK com status online
        return reply.status(200).send({
          status: 'online',
          keyConfigured: keyConfigured && isAvailable,
          available: isAvailable,
          model: isAvailable ? 'gpt-4o' : null,
          message: isAvailable
            ? 'Serviço de IA disponível e configurado'
            : 'Serviço de IA não configurado',
        });
      } catch (error) {
        // Garantir que sempre retornamos 200 OK mesmo em caso de erro inesperado
        // Reutilizar variáveis já declaradas no topo do handler
        request.log.error({ requestId, userId, tenantId, err: error }, 'Unexpected error in status endpoint');
        
        return reply.status(200).send({
          status: 'online',
          keyConfigured: false,
          available: false,
          model: null,
          message: 'Erro ao verificar status do serviço de IA',
        });
      }
    }
  );


  
/**
 * GET /api/v1/ai/ping
 *
 * Testa conectividade com a OpenAI (rede + auth).
 * Retorna apenas status e tempo (sem expor dados).
 */

// Endpoint de debug: /api/v1/ai/ping
// Desabilitado por padrão por segurança. Habilitar apenas em desenvolvimento com ENABLE_AI_PING=true
const enableAIPing = process.env.ENABLE_AI_PING === 'true' && process.env.NODE_ENV !== 'production';

if (enableAIPing) {
  app.get(
    '/ping',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const start = Date.now();
      // Declarar variáveis de contexto uma vez no topo do handler
      const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

      try {
        const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());

        if (!hasKey) {
          return reply.status(200).send({
            ok: false,
            hasKey: false,
            status: null,
            ms: Date.now() - start,
          });
        }

        const res = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        });

        request.log.debug({ requestId, userId, tenantId, status: res.status, ms: Date.now() - start }, 'AI ping check');

        return reply.status(200).send({
          ok: res.ok,
          hasKey: true,
          status: res.status,
          ms: Date.now() - start,
        });
      } catch (err) {
        // Reutilizar variáveis já declaradas no topo do handler
        request.log.warn({ requestId, userId, tenantId, err }, 'AI ping error');
        return reply.status(200).send({
          ok: false,
          hasKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
          status: null,
          ms: Date.now() - start,
        });
      }
    }
  );
} else {
  // Retornar 404 quando desabilitado
  app.get('/ping', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({ error: 'Not Found' });
  });
}

  done();
};
