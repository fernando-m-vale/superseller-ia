/**
 * AI Debug Routes
 * 
 * Endpoints de diagnóstico para debug de análise de IA.
 * Protegidos por autenticação e sanitizados (sem tokens/PII).
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authGuard } from '../plugins/auth';
import { OpenAIService } from '../services/OpenAIService';
import { IAScoreService } from '../services/IAScoreService';

const prisma = new PrismaClient();

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
  requestId?: string;
}

export const aiDebugRoutes: FastifyPluginCallback = (app, _, done) => {
  /**
   * GET /api/ai/debug-payload/:listingIdExt
   * 
   * Retorna snapshot sanitizado do payload enviado para a IA.
   * Não retorna: tokens, headers, prompt raw completo, urls sensíveis, PII.
   */
  app.get<{ Params: { listingIdExt: string } }>(
    '/debug-payload/:listingIdExt',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, userId, requestId } = request as RequestWithAuth;

      try {
        if (!tenantId) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado',
          });
        }

        const listingIdExt = (request.params as { listingIdExt: string }).listingIdExt;
        if (!listingIdExt) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'listingIdExt é obrigatório',
          });
        }

        app.log.info({
          requestId,
          userId,
          tenantId,
          listingIdExt,
        }, '[AI-DEBUG] Requisição de debug payload');

        // Buscar listing
        const listing = await prisma.listing.findFirst({
          where: {
            tenant_id: tenantId,
            listing_id_ext: listingIdExt,
          },
        });

        if (!listing) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Listing ${listingIdExt} não encontrado para este tenant`,
          });
        }

        // Construir input V21 (mesma lógica do OpenAIService)
        const openAIService = new OpenAIService(tenantId);
        const inputV21 = await openAIService.buildAIAnalyzeInputV21(
          listing.id,
          userId || 'debug',
          requestId || 'debug',
          30
        );

        // Buscar score result (para métricas)
        const scoreService = new IAScoreService(tenantId);
        const scoreResult = await scoreService.calculateScore(listing.id, 30);

        // Sanitizar pictures URLs (remover querystring, limitar a 3)
        const picturesUrlsSample: string[] = [];
        if (listing.pictures_json && typeof listing.pictures_json === 'object') {
          const pictures = listing.pictures_json as Array<{ url?: string; secure_url?: string }>;
          const urls = pictures
            .map(p => p.secure_url || p.url)
            .filter((url): url is string => typeof url === 'string' && url.length > 0)
            .slice(0, 3)
            .map(url => {
              // Remover querystring
              try {
                const urlObj = new URL(url);
                return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
              } catch {
                return url.split('?')[0];
              }
            });
          picturesUrlsSample.push(...urls);
        }

        // Determinar source de pricing
        let pricingSource: 'prices.prices' | 'reference_prices' | 'fallback' = 'fallback';
        if (listing.original_price && listing.price_final && listing.original_price > listing.price_final) {
          // Se tem promoção, provavelmente veio de prices/reference_prices
          pricingSource = 'reference_prices';
        }

        // Prompt version configurável via env
        const promptVersion = process.env.AI_PROMPT_VERSION || 'ml-expert-v21';

        // Montar resposta sanitizada
        const response = {
          listingIdExt: listing.listing_id_ext,
          listingId: listing.id,
          tenantId: listing.tenant_id,
          fetchedAt: new Date().toISOString(),

          prompt: {
            promptVersion,
            model: 'gpt-4o',
            temperature: 0.4,
          },

          listing: {
            title: listing.title,
            status: listing.status,
            categoryId: listing.category || undefined,
            picturesCount: listing.pictures_count || undefined,
            picturesUrlsSample: picturesUrlsSample.length > 0 ? picturesUrlsSample : undefined,
            hasClips: listing.has_clips,
          },

          pricing: {
            price: listing.price ? Number(listing.price) : null,
            priceFinal: listing.price_final ? Number(listing.price_final) : null,
            originalPrice: listing.original_price ? Number(listing.original_price) : null,
            hasPromotion: listing.has_promotion ?? false,
            discountPercent: listing.discount_percent ? Number(listing.discount_percent) : null,
            source: pricingSource,
          },

          metrics30d: {
            visits: scoreResult.metrics_30d.visits,
            orders: scoreResult.metrics_30d.orders,
            revenue: scoreResult.metrics_30d.revenue,
            conversionRate: scoreResult.metrics_30d.conversionRate,
            ctr: scoreResult.metrics_30d.ctr || undefined,
          },

          dataQuality: {
            missing: inputV21.dataQuality.warnings.filter(w => w.includes('indisponível') || w.includes('não encontrado')),
            warnings: inputV21.dataQuality.warnings,
          },

          aiInputSummary: {
            hasTitle: !!inputV21.listing.title,
            hasDescription: !!inputV21.listing.description_length && inputV21.listing.description_length > 0,
            hasPictures: (inputV21.media.imageCount || 0) > 0,
            hasPromotionFlag: inputV21.listing.has_promotion ?? false,
            hasMetrics: inputV21.dataQuality.performanceAvailable,
          },
        };

        app.log.info({
          requestId,
          tenantId,
          listingIdExt,
          promptVersion,
        }, '[AI-DEBUG] Debug payload retornado');

        return reply.status(200).send(response);
      } catch (error) {
        const { tenantId, userId, requestId } = (request as RequestWithAuth) || {};
        app.log.error({
          requestId,
          userId,
          tenantId,
          err: error,
        }, '[AI-DEBUG] Erro ao gerar debug payload');

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Erro ao gerar debug payload',
        });
      }
    }
  );

  done();
};
