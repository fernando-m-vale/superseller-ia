/**
 * AI Analyze Routes
 * 
 * Endpoints for AI-powered listing analysis using OpenAI GPT-4o.
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OpenAIService } from '../services/OpenAIService';
import { authGuard } from '../plugins/auth';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

const AnalyzeParamsSchema = z.object({
  listingId: z.string().uuid(),
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
   */
  app.post<{ Params: { listingId: string } }>(
    '/analyze/:listingId',
    { preHandler: authGuard },
    async (request: FastifyRequest<{ Params: { listingId: string } }>, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Token inválido ou tenant não identificado',
          });
        }

        const params = AnalyzeParamsSchema.parse(request.params);
        const { listingId } = params;

        console.log(`[AI-ANALYZE] Starting analysis for listing ${listingId}, tenant ${tenantId}`);

        const service = new OpenAIService(tenantId);

        if (!service.isAvailable()) {
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'OpenAI API key not configured. Please contact support.',
          });
        }

        const result = await service.analyzeAndSaveRecommendations(listingId);

        console.log(`[AI-ANALYZE] Analysis complete for listing ${listingId}:`, {
          score: result.analysis.score,
          growthHacks: result.analysis.growthHacks.length,
          savedRecommendations: result.savedRecommendations,
        });

        return reply.status(200).send({
          message: 'Análise concluída com sucesso',
          data: {
            listingId,
            score: result.analysis.score,
            critique: result.analysis.critique,
            growthHacks: result.analysis.growthHacks,
            seoSuggestions: result.analysis.seoSuggestions,
            savedRecommendations: result.savedRecommendations,
            analyzedAt: result.analysis.analyzedAt,
            model: result.analysis.model,
          },
        });
      } catch (error) {
        console.error('[AI-ANALYZE] Error analyzing listing:', error);

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'ID do anúncio inválido',
            details: error.errors,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        
        // Check for specific OpenAI errors
        if (errorMessage.includes('API key')) {
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'Serviço de IA não configurado corretamente.',
          });
        }

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Falha ao analisar anúncio com IA',
          details: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/ai/status
   * 
   * Check if the AI service is available and configured.
   */
  app.get(
    '/status',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request as RequestWithAuth;

      if (!tenantId) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Token inválido ou tenant não identificado',
        });
      }

      const service = new OpenAIService(tenantId);
      const isAvailable = service.isAvailable();

      return reply.send({
        available: isAvailable,
        model: isAvailable ? 'gpt-4o' : null,
        message: isAvailable
          ? 'Serviço de IA disponível e configurado'
          : 'Serviço de IA não configurado. OPENAI_API_KEY não definida.',
      });
    }
  );

  done();
};
