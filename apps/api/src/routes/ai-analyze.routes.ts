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
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import { MercadoLivreVisitsService } from '../services/MercadoLivreVisitsService';
import { authGuard } from '../plugins/auth';
import { sanitizeOpenAIError } from '../utils/sanitize-error';
import { generateFingerprint, buildFingerprintInput } from '../utils/ai-fingerprint';
import { PROMPT_VERSION, getPromptVersion } from '../utils/prompt-version';
import { sanitizeExpertAnalysis } from '@superseller/core';
import { PrismaClient, Prisma, ListingStatus, RecommendationType, RecommendationStatus } from '@prisma/client';
import { generateActionPlan, DataQuality, MediaInfo } from '../services/ScoreActionEngine';
import { explainScore } from '../services/ScoreExplanationService';
import { getMediaVerdict } from '../utils/media-verdict';
import { BenchmarkService } from '../services/BenchmarkService';
import { normalizeBenchmarkInsights } from '../services/BenchmarkInsightsService';
import { generateListingContent } from '../services/GeneratedContentService';
import type { AIAnalysisResultV21 } from '../types/ai-analysis-v21';
import type { AIAnalysisResultExpert } from '../types/ai-analysis-expert';

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
  debugPrices: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});

/**
 * Helper para adicionar header x-api-commit nas respostas
 */
function setVersionHeader(reply: FastifyReply): void {
  try {
    const { execSync } = require('child_process');
    const gitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    const shortSha = gitSha.length > 7 ? gitSha.substring(0, 7) : gitSha;
    reply.header('x-api-commit', shortSha);
  } catch {
    // Se não conseguir, tentar via env
    const gitSha = process.env.GIT_SHA || process.env.COMMIT_SHA;
    if (gitSha) {
      const shortSha = gitSha.length > 7 ? gitSha.substring(0, 7) : gitSha;
      reply.header('x-api-commit', shortSha);
    } else {
      reply.header('x-api-commit', 'unknown');
    }
  }
}

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
        // Debug controlado: calcular uma única vez no topo do handler para evitar TS2451
        // Considera tanto query param (?debugPrices=true) quanto env var (DEBUG_ML_PRICES=true)
        const debugPricesEnabled = (query.debugPrices ?? false) || (process.env.DEBUG_ML_PRICES === 'true');

        request.log.info({ 
          requestId,
          userId,
          tenantId,
          listingId,
          periodDays: PERIOD_DAYS,
          forceRefresh,
          promptVersion: PROMPT_VERSION,
        }, 'Starting AI analysis with Expert prompt');

        const service = new OpenAIService(tenantId);

        if (!service.isAvailable()) {
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'OpenAI API key not configured. Please contact support.',
          });
        }

        // Step 1: Get listing data for fingerprint calculation
        // IMPORTANTE: Usar id EXATO para garantir listing correto
        const listing = await prisma.listing.findFirst({
          where: {
            id: listingId, // UUID exato do listing
            tenant_id: tenantId, // Garantir isolamento por tenant
          },
        });

        if (!listing) {
          request.log.warn({
            requestId,
            listingId,
            tenantId,
          }, 'Listing not found for analysis');
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Anúncio não encontrado',
          });
        }
        
        // Log para debug - garantir que listing correto foi encontrado
        request.log.info({
          requestId,
          listingId,
          foundListingId: listing.id,
          listingIdExt: listing.listing_id_ext,
          title: listing.title?.substring(0, 50),
          marketplace: listing.marketplace,
        }, 'Listing fetched for analysis');

        // Step 1.5: Se forceRefresh=true, atualizar listing antes de analisar (garantir preço/promo atual)
        if (forceRefresh && listing.marketplace === 'mercadolivre' && listing.listing_id_ext) {
          try {
            // Log before
            const beforePrice = listing.price;
            const beforePriceFinal = listing.price_final;
            const beforeOriginalPrice = listing.original_price;
            const beforeHasPromotion = listing.has_promotion;
            const beforeDiscountPercent = listing.discount_percent;
            
            request.log.info({
              requestId,
              listingId,
              listingIdExt: listing.listing_id_ext,
              before: {
                price: beforePrice,
                price_final: beforePriceFinal,
                original_price: beforeOriginalPrice,
                has_promotion: beforeHasPromotion,
                discount_percent: beforeDiscountPercent,
              },
            }, 'forceRefresh=true: atualizando listing antes de analisar (BEFORE)');
            
            const syncService = new MercadoLivreSyncService(tenantId);
            const items = await syncService.fetchItemsDetails([listing.listing_id_ext]);
            
            if (items.length > 0) {
              await syncService.upsertListings(items, 'force_refresh', false);
              
              // Buscar listing atualizado do DB
              const refreshedListing = await prisma.listing.findFirst({
                where: {
                  id: listingId,
                  tenant_id: tenantId,
                },
              });
              
              if (refreshedListing) {
                // Log after
                request.log.info({
                  requestId,
                  listingId,
                  before: {
                    price: beforePrice,
                    price_final: beforePriceFinal,
                    original_price: beforeOriginalPrice,
                    has_promotion: beforeHasPromotion,
                    discount_percent: beforeDiscountPercent,
                  },
                  after: {
                    price: refreshedListing.price,
                    price_final: refreshedListing.price_final,
                    original_price: refreshedListing.original_price,
                    has_promotion: refreshedListing.has_promotion,
                    discount_percent: refreshedListing.discount_percent,
                  },
                }, 'Listing atualizado via force-refresh (AFTER)');
                
                // Atualizar objeto listing local com dados frescos
                Object.assign(listing, refreshedListing);
              }
            }
          } catch (refreshError) {
            // Não falhar análise se refresh falhar, apenas logar
            request.log.warn({
              requestId,
              listingId,
              error: refreshError instanceof Error ? refreshError.message : 'Erro desconhecido',
            }, 'Erro ao atualizar listing via force-refresh (continuando com dados existentes)');
          }
        }

        // Step 1.6: Reconciliar status do listing se for Mercado Livre (opcional, melhor UX)
        if (listing.marketplace === 'mercadolivre' && listing.listing_id_ext) {
          try {
            const syncService = new MercadoLivreSyncService(tenantId);
            const reconcileResult = await syncService.reconcileSingleListingStatus(listing.listing_id_ext);
            
            if (reconcileResult.updated && reconcileResult.status) {
              // Atualizar listing local para usar status atualizado
              listing.status = reconcileResult.status;
              
              if (reconcileResult.status === ListingStatus.active) {
                // Se listing mudou para active, executar backfill de visits para garantir dados atualizados
                request.log.info({ 
                  listingId,
                  listingIdExt: listing.listing_id_ext,
                  oldStatus: listing.status,
                  newStatus: reconcileResult.status,
                }, 'Listing reconciliado e agora está active, executando backfill de visits');
                
                try {
                  const visitsService = new MercadoLivreVisitsService(tenantId);
                  // Backfill dos últimos 30 dias para garantir dados atualizados
                  await visitsService.syncVisitsByRange(
                    tenantId,
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
                    new Date() // Hoje
                  );
                  request.log.info({ listingId }, 'Backfill de visits concluído após reconciliação');
                } catch (visitsError) {
                  // Não falhar a análise se backfill falhar, apenas logar
                  request.log.warn({ listingId, error: visitsError }, 'Erro no backfill de visits após reconciliação (não crítico)');
                }
              }
            }
          } catch (reconcileError) {
            // Não falhar a análise se reconciliação falhar, apenas logar
            request.log.warn({ listingId, error: reconcileError }, 'Erro na reconciliação de status (não crítico)');
          }
        }

        // Step 2: Calculate score to get metrics for fingerprint
        const scoreService = new IAScoreService(tenantId);
        const scoreResult = await scoreService.calculateScore(listingId, PERIOD_DAYS);

        // Step 3: Build fingerprint from listing + metrics (V2.1 includes new fields)
        const fingerprintInput = buildFingerprintInput(
          {
            title: listing.title,
            price: listing.price,
            category: listing.category,
            pictures_count: listing.pictures_count,
            has_video: listing.has_video,
            status: listing.status,
            stock: listing.stock,
            // V2.1 fields
            price_final: listing.price_final,
            has_promotion: listing.has_promotion,
            discount_percent: listing.discount_percent,
            description: listing.description,
            has_clips: listing.has_clips,
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
          benchmark?: any; // Benchmark (Dia 04) - opcional para compatibilidade com cache antigo
          analysis: {
            score: number;
            critique: string;
            growthHacks: Array<{ title: string; description: string; priority: string; estimatedImpact: string }>;
            seoSuggestions: { suggestedTitle: string; titleRationale: string; suggestedDescriptionPoints: string[]; keywords: string[] };
            analyzedAt: string;
            model: string;
          };
          savedRecommendations: number;
          // Expert fields (obrigatório)
          analysisV21?: AIAnalysisResultExpert;
        };

        let cachedResult: CachedAnalysisResult | null = null;

        // Se forceRefresh=true, deletar cache antigo antes de buscar
        if (forceRefresh) {
          try {
            await prisma.listingAIAnalysis.deleteMany({
              where: {
                tenant_id: tenantId,
                listing_id: listingId,
                period_days: PERIOD_DAYS,
              },
            });
            request.log.info(
              {
                requestId,
                userId,
                tenantId,
                listingId,
              },
              'Cache invalidated due to forceRefresh=true'
            );
          } catch (deleteError) {
            request.log.warn({ err: deleteError, listingId }, 'Failed to delete cache on forceRefresh');
          }
        }

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
            // Verificar se o cache tem prompt_version correto
            const cachePromptVersion = cached.prompt_version;
            if (cachePromptVersion !== PROMPT_VERSION) {
              request.log.warn(
                {
                  requestId,
                  userId,
                  tenantId,
                  listingId,
                  cachePromptVersion,
                  expectedPromptVersion: PROMPT_VERSION,
                  fingerprint: fingerprint.substring(0, 16) + '...',
                },
                'Cache hit but prompt_version mismatch, will regenerate'
              );
              cachedResult = null; // Forçar regeneração
            } else {
              cachedResult = cached.result_json as unknown as CachedAnalysisResult;
              
              // Se cache não tiver analysisV21, considerar como cache miss e regenerar
              if (!cachedResult.analysisV21) {
                request.log.warn(
                  {
                    requestId,
                    userId,
                    tenantId,
                    listingId,
                    fingerprint: fingerprint.substring(0, 16) + '...',
                  },
                  'Cache hit but missing analysisV21, will regenerate'
                );
                cachedResult = null; // Forçar regeneração
              } else {
                // Verificar se analysisV21 tem prompt_version correto
                const analysisV21PromptVersion = (cachedResult.analysisV21 as any)?.meta?.prompt_version;
                if (analysisV21PromptVersion && analysisV21PromptVersion !== PROMPT_VERSION) {
                  request.log.warn(
                    {
                      requestId,
                      userId,
                      tenantId,
                      listingId,
                      analysisV21PromptVersion,
                      expectedPromptVersion: PROMPT_VERSION,
                    },
                    'Cache hit but analysisV21 has wrong prompt_version, will regenerate'
                  );
                  cachedResult = null; // Forçar regeneração
                } else {
                  request.log.info(
                    {
                      requestId,
                      userId,
                      tenantId,
                      listingId,
                      fingerprint: fingerprint.substring(0, 16) + '...',
                      cacheHit: true,
                      hasV21: true,
                      promptVersion: PROMPT_VERSION,
                    },
                    'AI analysis cache hit with Expert (ml-expert-v1)'
                  );
                }
              }
            }
          }
        }

        // Step 5: If cache miss or forceRefresh or cache missing V2.1, call OpenAI
        if (!cachedResult) {
          // Usar PROMPT ESPECIALISTA (ml-expert-v1) - SEM FALLBACK
          let analysisV21: AIAnalysisResultExpert | null = null;
          let result: {
            analysis: any;
            savedRecommendations: number;
            dataQuality: any;
            score: any;
          } | null = null;

          try {
            // Construir input V2.1 canônico
            const inputV21 = await service.buildAIAnalyzeInputV21(listingId, userId, requestId, PERIOD_DAYS);
            
            // Calcular score
            const scoreService = new IAScoreService(tenantId);
            const scoreResult = await scoreService.calculateScore(listingId, PERIOD_DAYS);

            // Usar PROMPT ESPECIALISTA
            request.log.info({ 
              listingId, 
              requestId,
              listingIdExt: listing.listing_id_ext,
              title: listing.title?.substring(0, 50),
            }, 'Attempting AI analysis Expert (ml-expert-v1)');
            
            try {
              analysisV21 = await service.analyzeListingV21(inputV21, scoreResult);
              
              request.log.info({ 
                listingId, 
                requestId,
                listingIdExt: listing.listing_id_ext,
                promptVersion: analysisV21.meta.prompt_version,
                analyzedAt: analysisV21.meta.analyzed_at,
                verdict: analysisV21.verdict?.substring(0, 50),
                hasTitleFix: !!analysisV21.title_fix,
                hasImagePlan: !!analysisV21.image_plan?.length,
                hasDescriptionFix: !!analysisV21.description_fix,
                hasPriceFix: !!analysisV21.price_fix,
                algorithmHacksCount: analysisV21.algorithm_hacks?.length || 0,
                actionPlanCount: analysisV21.final_action_plan?.length || 0,
              }, 'AI analysis Expert (ml-expert-v1) successful');
            } catch (expertError) {
              const errorMessage = expertError instanceof Error ? expertError.message : 'Unknown error';
              
              // Se for erro de validação (AI_OUTPUT_INVALID), retornar HTTP 502
              if (errorMessage.includes('AI_OUTPUT_INVALID')) {
                request.log.error({
                  listingId,
                  requestId,
                  error: errorMessage,
                }, 'AI output validation failed - returning 502');
                
                return reply.status(502).send({
                  error: 'AI_OUTPUT_INVALID',
                  message: 'A resposta da IA não está no formato esperado. Tente novamente.',
                  details: errorMessage,
                });
              }
              
              // Para outros erros, re-throw para tratamento geral
              throw expertError;
            }

            // Criar objeto result compatível (sem salvar recomendações por enquanto - Expert não tem formato V1)
            result = {
              analysis: {
                score: scoreResult.score.final,
                critique: analysisV21.verdict,
                growthHacks: [], // Expert não usa growthHacks
                seoSuggestions: {
                  suggestedTitle: analysisV21.title_fix.after,
                  titleRationale: analysisV21.title_fix.problem,
                  suggestedDescriptionPoints: [],
                  keywords: [],
                },
                analyzedAt: analysisV21.meta.analyzed_at,
                model: analysisV21.meta.model,
              },
              savedRecommendations: 0, // Não salvar recomendações no formato Expert por enquanto
              dataQuality: inputV21.dataQuality,
              score: scoreResult,
            };
          } catch (expertError) {
            // SEM FALLBACK - Expert é obrigatório
            const errorMessage = expertError instanceof Error ? expertError.message : 'Unknown error';
            request.log.error(
              { 
                listingId, 
                requestId, 
                err: expertError,
                errorMessage,
              }, 
              'AI analysis Expert (ml-expert-v1) failed - NO FALLBACK'
            );

            // Retornar erro - não há fallback
            return reply.status(500).send({
              error: 'AI Analysis Failed',
              message: `Falha ao gerar análise especialista: ${errorMessage}`,
            });
          }

          if (!analysisV21 || !result) {
            return reply.status(500).send({
              error: 'Internal Server Error',
              message: 'Análise não foi gerada corretamente',
            });
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
              hasClips: listing.has_clips ?? null, // Usar apenas has_clips (no ML, clip = vídeo)
              picturesCount: listing.pictures_count,
            },
            {
              hasPromotion: listing.has_promotion ?? false,
              discountPercent: listing.discount_percent,
            },
            {
              visits: result.score.metrics_30d.visits,
              orders: result.score.metrics_30d.orders,
              conversionRate: result.score.metrics_30d.conversionRate,
              revenue: result.score.metrics_30d.revenue,
            }
          );
          const scoreExplanation = explainScore(
            result.score.score.breakdown,
            dataQualityForActions,
            {
              hasClips: listing.has_clips ?? null, // Usar apenas has_clips (no ML, clip = vídeo)
              picturesCount: listing.pictures_count,
            }
          );
          
          // DEBUG: Log mediaInfo antes de gerar MediaVerdict
          const mediaInfo = {
            hasVideo: listing.has_video, // Legado (não usado na decisão)
            hasClips: listing.has_clips, // Fonte de verdade
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
          
          // Gerar MediaVerdict para incluir na resposta (usar apenas has_clips)
          const mediaVerdict = getMediaVerdict(listing.has_clips ?? null, listing.pictures_count);
          
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

          // Calcular benchmark (Dia 04) - NUNCA retornar null
          let benchmarkResult: any = null;
          if (listing.category) {
            try {
              const benchmarkService = new BenchmarkService(tenantId);
              benchmarkResult = await benchmarkService.calculateBenchmark(
                {
                  id: listingId,
                  listingIdExt: listing.listing_id_ext || '',
                  categoryId: listing.category,
                  picturesCount: listing.pictures_count || 0,
                  hasClips: listing.has_clips ?? null,
                  title: listing.title,
                  price: Number(listing.price), // Converter Decimal para number
                  hasPromotion: listing.has_promotion ?? false,
                  discountPercent: listing.discount_percent,
                },
              {
                visits: result.score.metrics_30d.visits,
                orders: result.score.metrics_30d.orders,
                conversionRate: result.score.metrics_30d.conversionRate,
              }
            );
            request.log.info(
              {
                requestId,
                listingId,
                tenantId,
                categoryId: listing.category,
                confidence: benchmarkResult?.benchmarkSummary?.confidence,
                sampleSize: benchmarkResult?.benchmarkSummary?.sampleSize,
              },
              'Benchmark calculado (fresh)'
            );
            } catch (benchmarkError) {
              // BenchmarkService agora sempre retorna objeto, mas logar erro estruturado
              const errorMessage = benchmarkError instanceof Error ? benchmarkError.message : 'Erro desconhecido';
              const errorStage = errorMessage.includes('search') ? 'ml-search' 
                : errorMessage.includes('aggregate') ? 'aggregate'
                : errorMessage.includes('baseline') ? 'baseline'
                : 'unknown';
              
              // Obter connectionId/marketplaceAccountId se disponível
              let connectionId: string | undefined;
              let marketplaceAccountId: string | undefined;
              if (listing.marketplace === 'mercadolivre' && listing.listing_id_ext) {
                try {
                  const syncService = new MercadoLivreSyncService(tenantId);
                  const connectionInfo = await syncService.getConnectionInfo();
                  connectionId = connectionInfo.connectionId;
                  marketplaceAccountId = connectionInfo.providerAccountId;
                } catch {
                  // Ignorar erro ao obter connectionId
                }
              }

              request.log.warn(
                {
                  requestId,
                  tenantId,
                  listingId,
                  categoryId: listing.category,
                  connectionId,
                  marketplaceAccountId,
                  stage: errorStage,
                  errorCode: benchmarkError instanceof Error ? benchmarkError.name : 'UNKNOWN',
                  errorMessage,
                },
                'Erro ao calcular benchmark (retornando unavailable)'
              );

              // Garantir que benchmarkResult não seja null - BenchmarkService já retorna objeto
              // Mas se ainda for null, criar objeto fallback
              if (!benchmarkResult) {
                benchmarkResult = {
                  benchmarkSummary: {
                    categoryId: listing.category,
                    sampleSize: 0,
                    computedAt: new Date().toISOString(),
                    confidence: 'unavailable',
                    notes: `Benchmark indisponível: ${errorMessage}`,
                    stats: {
                      medianPicturesCount: 0,
                      percentageWithVideo: 0,
                      medianPrice: 0,
                      medianTitleLength: 0,
                      sampleSize: 0,
                    },
                    baselineConversion: {
                      conversionRate: null,
                      sampleSize: 0,
                      totalVisits: 0,
                      confidence: 'unavailable',
                    },
                  },
                  youWinHere: [],
                  youLoseHere: [],
                  tradeoffs: 'Comparação com concorrentes indisponível no momento.',
                  recommendations: [],
                };
              }
            }
          } else {
            // Sem categoryId - retornar benchmark unavailable
            benchmarkResult = {
              benchmarkSummary: {
                categoryId: null,
                sampleSize: 0,
                computedAt: new Date().toISOString(),
                confidence: 'unavailable',
                notes: 'Categoria não disponível para este anúncio.',
                stats: {
                  medianPicturesCount: 0,
                  percentageWithVideo: 0,
                  medianPrice: 0,
                  medianTitleLength: 0,
                  sampleSize: 0,
                },
                baselineConversion: {
                  conversionRate: null,
                  sampleSize: 0,
                  totalVisits: 0,
                  confidence: 'unavailable',
                },
              },
              youWinHere: [],
              youLoseHere: [],
              tradeoffs: 'Comparação com concorrentes indisponível (categoria não disponível).',
              recommendations: [],
            };
          }

          // Step 6: Save to cache (incluindo V2.1 e benchmark) - DEPOIS do cálculo do benchmark
          try {
            const cachePayload: any = {
              analysis: {
                score: result.analysis.score,
                critique: result.analysis.critique,
                growthHacks: result.analysis.growthHacks,
                seoSuggestions: result.analysis.seoSuggestions,
                analyzedAt: result.analysis.analyzedAt,
                model: result.analysis.model,
              },
              savedRecommendations: result.savedRecommendations,
            };

            // Sempre incluir Expert se disponível (obrigatório)
            if (analysisV21) {
              // Normalizar meta.prompt_version e meta.version antes de salvar no cache
              const normalizedAnalysisV21 = { ...analysisV21 };
              if (normalizedAnalysisV21.meta) {
                normalizedAnalysisV21.meta.prompt_version = PROMPT_VERSION as any;
                normalizedAnalysisV21.meta.version = PROMPT_VERSION as any;
              } else {
                // Se meta não existir, criar com campos mínimos necessários
                normalizedAnalysisV21.meta = {
                  ...(analysisV21.meta || {}),
                  prompt_version: PROMPT_VERSION as any,
                  version: PROMPT_VERSION as any,
                  model: analysisV21.meta?.model || 'gpt-4o',
                  analyzed_at: analysisV21.meta?.analyzed_at || new Date().toISOString(),
                };
              }
              cachePayload.analysisV21 = normalizedAnalysisV21;
            } else {
              // Se não tiver analysisV21, logar warning mas continuar
              request.log.warn(
                {
                  requestId,
                  listingId,
                  tenantId,
                },
                'V2.1 analysis not available, saving cache without analysisV21'
              );
            }

            // Incluir benchmark no cachePayload (Dia 04) - benchmarkResult já foi calculado acima
            if (benchmarkResult) {
              cachePayload.benchmark = benchmarkResult;
            } else {
              // Incluir fallback padrão para garantir que nunca seja null
              cachePayload.benchmark = {
                benchmarkSummary: {
                  categoryId: listing.category,
                  sampleSize: 0,
                  computedAt: new Date().toISOString(),
                  confidence: 'unavailable',
                  notes: 'Benchmark indisponível (cache antigo ou erro)',
                  stats: {
                    medianPicturesCount: 0,
                    percentageWithVideo: 0,
                    medianPrice: 0,
                    medianTitleLength: 0,
                    sampleSize: 0,
                  },
                  baselineConversion: {
                    conversionRate: null,
                    sampleSize: 0,
                    totalVisits: 0,
                    confidence: 'unavailable',
                  },
                },
                youWinHere: [],
                youLoseHere: [],
                tradeoffs: 'Comparação com concorrentes indisponível no momento.',
                recommendations: [],
              };
            }

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
                result_json: cachePayload as unknown as Prisma.InputJsonValue,
                updated_at: new Date(),
              },
              create: {
                tenant_id: tenantId,
                listing_id: listingId,
                period_days: PERIOD_DAYS,
                fingerprint,
                model: result.analysis.model || 'gpt-4o',
                prompt_version: PROMPT_VERSION,
                result_json: cachePayload as unknown as Prisma.InputJsonValue,
              },
            });
          } catch (cacheError) {
            // Log but don't fail if cache save fails
            request.log.warn({ err: cacheError, listingId, fingerprint: fingerprint.substring(0, 16) + '...' }, 'Failed to save AI analysis to cache');
          }

          // Preparar resposta com Expert (ml-expert-v1)
          const responseData: any = {
            listingId, // GARANTIR que usa o listingId do request, não de outro lugar
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
            // Versões
            promptVersion: PROMPT_VERSION,
            schemaVersion: 'analysisV21', // Versão do schema/formatter
            // IA Score V2: Action Plan and Score Explanation
            actionPlan,
            scoreExplanation,
            // MediaVerdict - Fonte única de verdade para mídia
            mediaVerdict,
            // Benchmark (Dia 04) - NUNCA null
            benchmark: benchmarkResult || {
              benchmarkSummary: {
                categoryId: listing.category,
                sampleSize: 0,
                computedAt: new Date().toISOString(),
                confidence: 'unavailable',
                notes: 'Benchmark indisponível (cache antigo ou erro)',
                stats: {
                  medianPicturesCount: 0,
                  percentageWithVideo: 0,
                  medianPrice: 0,
                  medianTitleLength: 0,
                  sampleSize: 0,
                },
                baselineConversion: {
                  conversionRate: null,
                  sampleSize: 0,
                  totalVisits: 0,
                  confidence: 'unavailable',
                },
              },
              youWinHere: [],
              youLoseHere: [],
              tradeoffs: 'Comparação com concorrentes indisponível no momento.',
              recommendations: [],
            },
          };

          // Calcular benchmarkInsights (Dia 05) - normalizar benchmark em insights acionáveis
          const benchmarkInsights = normalizeBenchmarkInsights(
            benchmarkResult,
            {
              picturesCount: listing.pictures_count || 0,
              hasClips: listing.has_clips ?? null,
              titleLength: listing.title?.length || 0,
              price: Number(listing.price),
              hasPromotion: listing.has_promotion ?? false,
              discountPercent: listing.discount_percent,
            },
            {
              visits: result.score.metrics_30d.visits,
              orders: result.score.metrics_30d.orders,
              conversionRate: result.score.metrics_30d.conversionRate,
            }
          );

          // Gerar conteúdo acionável (Dia 05) - títulos, bullets, descrição SEO
          const generatedContent = generateListingContent(
            {
              title: listing.title || '',
              description: listing.description,
              picturesCount: listing.pictures_count || 0,
              hasClips: listing.has_clips ?? null,
              hasPromotion: listing.has_promotion ?? false,
              discountPercent: listing.discount_percent,
              price: Number(listing.price),
              originalPrice: listing.original_price ? Number(listing.original_price) : null,
              category: listing.category,
            },
            benchmarkInsights.criticalGaps
          );

          // Adicionar benchmarkInsights e generatedContent ao responseData
          responseData.benchmarkInsights = benchmarkInsights;
          responseData.generatedContent = generatedContent;

          // Se header x-debug: 1, incluir benchmarkDebug no payload
          const debugHeader = request.headers['x-debug'];
          if (debugHeader === '1' && benchmarkResult?._debug) {
            responseData.benchmarkDebug = benchmarkResult._debug;
          }

            // SEMPRE incluir Expert se disponível (obrigatório) — sanitizar antes de enviar
            if (analysisV21) {
              responseData.analysisV21 = sanitizeExpertAnalysis(analysisV21);
              
              // Normalizar meta.prompt_version e meta.version para garantir consistência
              if (responseData.analysisV21.meta) {
                responseData.analysisV21.meta.prompt_version = PROMPT_VERSION as any;
                responseData.analysisV21.meta.version = PROMPT_VERSION as any; // Usar promptVersion como version também
              } else {
                // Se meta não existir, criar
                responseData.analysisV21.meta = {
                  ...(analysisV21.meta || {}),
                  prompt_version: PROMPT_VERSION as any,
                  version: PROMPT_VERSION as any,
                };
              }
              
            request.log.info(
              {
                requestId,
                listingId,
                tenantId,
                listingIdExt: listing.listing_id_ext,
                promptVersion: PROMPT_VERSION,
                analyzedAt: responseData.analysisV21.meta?.analyzed_at || analysisV21.meta?.analyzed_at,
                verdict: analysisV21.verdict?.substring(0, 50),
              },
              'Including Expert analysis in response'
            );
          } else {
            request.log.error(
              {
                requestId,
                listingId,
                tenantId,
                hasV21: false,
              },
              'Response does not include Expert analysis - CRITICAL ERROR'
            );
          }

          // Debug controlado: capturar payload do ML /prices (só para listing específico)
          // Usa debugPricesEnabled calculado no topo do handler para evitar TS2451
          // debugPricesEnabled já considera tanto query param (?debugPrices=true) quanto env var (DEBUG_ML_PRICES=true)
          if (debugPricesEnabled && listing.listing_id_ext === 'MLB4167251409' && listing.marketplace === 'mercadolivre') {
            try {
              const syncService = new MercadoLivreSyncService(tenantId);
              const debugPricesResult = await syncService.debugFetchPrices(listing.listing_id_ext);
              
              // Log estruturado
              request.log.warn({
                requestId,
                tenantId,
                listingId,
                listingIdExt: listing.listing_id_ext,
                statusCode: debugPricesResult.statusCode,
                blockedBy: debugPricesResult.blockedBy,
                code: debugPricesResult.code,
                message: debugPricesResult.message,
              }, 'Debug ML Prices API (debugPrices=true)');
              
              // Incluir no response
              responseData._debugPrices = debugPricesResult;
            } catch (debugError) {
              request.log.error({
                requestId,
                tenantId,
                listingId,
                listingIdExt: listing.listing_id_ext,
                error: debugError instanceof Error ? debugError.message : 'Erro desconhecido',
              }, 'Erro ao executar debugPrices');
              
              responseData._debugPrices = {
                listingIdExt: listing.listing_id_ext,
                attemptedAt: new Date().toISOString(),
                error: debugError instanceof Error ? debugError.message : 'Erro desconhecido',
              };
            }
          }

          // Adicionar header com commit SHA
          setVersionHeader(reply);

          return reply.status(200).send({
            message: 'Análise concluída com sucesso',
            data: responseData,
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
            hasClips: listing.has_clips ?? null, // Usar apenas has_clips (no ML, clip = vídeo)
            picturesCount: listing.pictures_count,
          },
          {
            hasPromotion: listing.has_promotion ?? false,
            discountPercent: listing.discount_percent,
          },
          {
            visits: scoreResult.metrics_30d.visits,
            orders: scoreResult.metrics_30d.orders,
            conversionRate: scoreResult.metrics_30d.conversionRate,
            revenue: scoreResult.metrics_30d.revenue,
          }
        );
        const scoreExplanation = explainScore(
          scoreResult.score.breakdown,
          dataQualityForActions,
          {
            hasClips: listing.has_clips ?? null, // Usar apenas has_clips (no ML, clip = vídeo)
            picturesCount: listing.pictures_count,
          }
        );
        
        // DEBUG: Log mediaInfo antes de gerar MediaVerdict
        const mediaInfo = {
          hasVideo: listing.has_video, // Legado (não usado na decisão)
          hasClips: listing.has_clips, // Fonte de verdade
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
        
        // Gerar MediaVerdict para incluir na resposta (usar apenas has_clips)
        const mediaVerdict = getMediaVerdict(listing.has_clips ?? null, listing.pictures_count);
        
        // DEBUG: Log MediaVerdict result
        request.log.info(
          {
            listingId,
            listingIdExt: listing.listing_id_ext,
            mediaVerdict,
          },
          '[MEDIA-VERDICT-DEBUG] MediaVerdict gerado (cache)'
        );

        // Calcular benchmark (Dia 04) - também para cache - NUNCA retornar null
        let cacheBenchmarkResult: any = null;
        if (listing.category) {
          try {
            const benchmarkService = new BenchmarkService(tenantId);
            cacheBenchmarkResult = await benchmarkService.calculateBenchmark(
              {
                id: listingId,
                listingIdExt: listing.listing_id_ext || '',
                categoryId: listing.category,
                picturesCount: listing.pictures_count || 0,
                hasClips: listing.has_clips ?? null,
                title: listing.title,
                price: Number(listing.price), // Converter Decimal para number
                hasPromotion: listing.has_promotion ?? false,
                discountPercent: listing.discount_percent ? Number(listing.discount_percent) : null,
              },
              {
                visits: scoreResult.metrics_30d.visits,
                orders: scoreResult.metrics_30d.orders,
                conversionRate: scoreResult.metrics_30d.conversionRate,
              }
            );
            request.log.info(
              {
                requestId,
                listingId,
                tenantId,
                categoryId: listing.category,
                confidence: cacheBenchmarkResult?.benchmarkSummary?.confidence,
                sampleSize: cacheBenchmarkResult?.benchmarkSummary?.sampleSize,
              },
              'Benchmark calculado (cache)'
            );
          } catch (benchmarkError) {
            // BenchmarkService agora sempre retorna objeto, mas logar erro estruturado
            const errorMessage = benchmarkError instanceof Error ? benchmarkError.message : 'Erro desconhecido';
            const errorStage = errorMessage.includes('search') ? 'ml-search' 
              : errorMessage.includes('aggregate') ? 'aggregate'
              : errorMessage.includes('baseline') ? 'baseline'
              : 'unknown';
            
            request.log.warn(
              {
                requestId,
                tenantId,
                listingId,
                categoryId: listing.category,
                stage: errorStage,
                errorCode: benchmarkError instanceof Error ? benchmarkError.name : 'UNKNOWN',
                errorMessage,
              },
              'Erro ao calcular benchmark (retornando unavailable)'
            );

            // Garantir que cacheBenchmarkResult não seja null
            if (!cacheBenchmarkResult) {
              cacheBenchmarkResult = {
                benchmarkSummary: {
                  categoryId: listing.category,
                  sampleSize: 0,
                  computedAt: new Date().toISOString(),
                  confidence: 'unavailable',
                  notes: `Benchmark indisponível: ${errorMessage}`,
                  stats: {
                    medianPicturesCount: 0,
                    percentageWithVideo: 0,
                    medianPrice: 0,
                    medianTitleLength: 0,
                    sampleSize: 0,
                  },
                  baselineConversion: {
                    conversionRate: null,
                    sampleSize: 0,
                    totalVisits: 0,
                    confidence: 'unavailable',
                  },
                },
                youWinHere: [],
                youLoseHere: [],
                tradeoffs: 'Comparação com concorrentes indisponível no momento.',
                recommendations: [],
              };
            }
          }
        } else {
          // Sem categoryId - retornar benchmark unavailable
          cacheBenchmarkResult = {
            benchmarkSummary: {
              categoryId: null,
              sampleSize: 0,
              computedAt: new Date().toISOString(),
              confidence: 'unavailable',
              notes: 'Categoria não disponível para este anúncio.',
              stats: {
                medianPicturesCount: 0,
                percentageWithVideo: 0,
                medianPrice: 0,
                medianTitleLength: 0,
                sampleSize: 0,
              },
              baselineConversion: {
                conversionRate: null,
                sampleSize: 0,
                totalVisits: 0,
                confidence: 'unavailable',
              },
            },
            youWinHere: [],
            youLoseHere: [],
            tradeoffs: 'Comparação com concorrentes indisponível (categoria não disponível).',
            recommendations: [],
          };
        }

        // Calcular benchmarkInsights (Dia 05) - também para cache
        const cacheBenchmarkInsights = normalizeBenchmarkInsights(
          cacheBenchmarkResult,
          {
            picturesCount: listing.pictures_count || 0,
            hasClips: listing.has_clips ?? null,
            titleLength: listing.title?.length || 0,
            price: Number(listing.price),
            hasPromotion: listing.has_promotion ?? false,
            discountPercent: listing.discount_percent,
          },
          {
            visits: scoreResult.metrics_30d.visits,
            orders: scoreResult.metrics_30d.orders,
            conversionRate: scoreResult.metrics_30d.conversionRate,
          }
        );

        // Gerar conteúdo acionável (Dia 05) - também para cache
        const cacheGeneratedContent = generateListingContent(
          {
            title: listing.title || '',
            description: listing.description,
            picturesCount: listing.pictures_count || 0,
            hasClips: listing.has_clips ?? null,
            hasPromotion: listing.has_promotion ?? false,
            discountPercent: listing.discount_percent,
            price: Number(listing.price),
            originalPrice: listing.original_price ? Number(listing.original_price) : null,
            category: listing.category,
          },
          cacheBenchmarkInsights.criticalGaps
        );

        // Preparar resposta do cache incluindo Expert se disponível
        const cacheResponseData: any = {
          listingId, // GARANTIR que usa o listingId do request, não do cache
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
          // Versões
          promptVersion: PROMPT_VERSION,
          schemaVersion: 'analysisV21', // Versão do schema/formatter
          // IA Score V2: Action Plan and Score Explanation
          actionPlan,
          scoreExplanation,
          // MediaVerdict - Fonte única de verdade para mídia
          mediaVerdict,
          // Benchmark (Dia 04) - também calculado para cache - NUNCA null
          benchmark: cacheBenchmarkResult || {
            benchmarkSummary: {
              categoryId: listing.category,
              sampleSize: 0,
              computedAt: new Date().toISOString(),
              confidence: 'unavailable',
              notes: 'Benchmark indisponível (cache antigo ou erro)',
              stats: {
                medianPicturesCount: 0,
                percentageWithVideo: 0,
                medianPrice: 0,
                medianTitleLength: 0,
                sampleSize: 0,
              },
              baselineConversion: {
                conversionRate: null,
                sampleSize: 0,
                totalVisits: 0,
                confidence: 'unavailable',
              },
            },
            youWinHere: [],
            youLoseHere: [],
            tradeoffs: 'Comparação com concorrentes indisponível no momento.',
            recommendations: [],
          },
        };

        // Benchmark Insights (Dia 05) - insights acionáveis do benchmark
        cacheResponseData.benchmarkInsights = cacheBenchmarkInsights;
        // Generated Content (Dia 05) - conteúdo pronto para copy/paste
        cacheResponseData.generatedContent = cacheGeneratedContent;
        // Se header x-debug: 1, incluir benchmarkDebug no payload
        const debugHeader = request.headers['x-debug'];
        if (debugHeader === '1' && cacheBenchmarkResult?._debug) {
          cacheResponseData.benchmarkDebug = cacheBenchmarkResult._debug;
        }

        // Incluir Expert se disponível no cache — sanitizar antes de enviar
        if (cachedResult.analysisV21) {
          cacheResponseData.analysisV21 = sanitizeExpertAnalysis(cachedResult.analysisV21);
          
              // Normalizar meta.prompt_version e meta.version também no cache
              if (cacheResponseData.analysisV21?.meta) {
                cacheResponseData.analysisV21.meta.prompt_version = PROMPT_VERSION as any;
                cacheResponseData.analysisV21.meta.version = PROMPT_VERSION as any;
              }
          
          // Incluir benchmark do cache se disponível, senão fallback
          if ((cachedResult as any).benchmark) {
            cacheResponseData.benchmark = (cachedResult as any).benchmark;
          } else {
            // Fallback padrão se não existir no cache antigo
            cacheResponseData.benchmark = cacheBenchmarkResult || {
              benchmarkSummary: {
                categoryId: listing.category,
                sampleSize: 0,
                computedAt: new Date().toISOString(),
                confidence: 'unavailable',
                notes: 'Benchmark indisponível (cache antigo)',
                stats: {
                  medianPicturesCount: 0,
                  percentageWithVideo: 0,
                  medianPrice: 0,
                  medianTitleLength: 0,
                  sampleSize: 0,
                },
                baselineConversion: {
                  conversionRate: null,
                  sampleSize: 0,
                  totalVisits: 0,
                  confidence: 'unavailable',
                },
              },
              youWinHere: [],
              youLoseHere: [],
              tradeoffs: 'Comparação com concorrentes indisponível (cache antigo).',
              recommendations: [],
            };
          }
          
          // Log para debug
          request.log.info({
            requestId,
            listingId,
            cacheListingId: (cachedResult.analysisV21 as any)?.meta?.listingId,
            promptVersion: (cachedResult.analysisV21 as any)?.meta?.prompt_version,
            analyzedAt: (cachedResult.analysisV21 as any)?.meta?.analyzed_at,
          }, 'Returning cached Expert analysis');
        } else {
          request.log.warn({
            requestId,
            listingId,
          }, 'Cache hit but no analysisV21 found');
        }

        // Debug controlado: capturar payload do ML /prices (só para listing específico)
        // Usa debugPricesEnabled calculado no topo do handler para evitar TS2451
        if (debugPricesEnabled && listing.listing_id_ext === 'MLB4167251409' && listing.marketplace === 'mercadolivre') {
          try {
            const syncService = new MercadoLivreSyncService(tenantId);
            const debugPricesResult = await syncService.debugFetchPrices(listing.listing_id_ext);
            
            request.log.warn({
              requestId,
              tenantId,
              listingId,
              listingIdExt: listing.listing_id_ext,
              statusCode: debugPricesResult.statusCode,
              blockedBy: debugPricesResult.blockedBy,
              code: debugPricesResult.code,
              message: debugPricesResult.message,
            }, 'Debug ML Prices API (cache response, debugPrices=true)');
            
            cacheResponseData._debugPrices = debugPricesResult;
          } catch (debugError) {
            request.log.error({
              requestId,
              tenantId,
              listingId,
              listingIdExt: listing.listing_id_ext,
              error: debugError instanceof Error ? debugError.message : 'Erro desconhecido',
            }, 'Erro ao executar debugPrices (cache)');
          }
        }

        // Adicionar header com commit SHA
        setVersionHeader(reply);

        return reply.status(200).send({
          message: 'Análise concluída com sucesso (cache)',
          data: cacheResponseData,
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
