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

        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
          return reply.status(429).send({
            error: 'Rate limit / Quota',
            message: 'Limite da IA atingido. Tente novamente mais tarde.',
            details: errorMessage,
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
   * Always returns 200 OK, even if the service is not configured.
   */



  app.get(
    '/status',
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = request as RequestWithAuth;
        
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
          console.error('[AI-STATUS] Erro ao verificar disponibilidade do serviço:', serviceError);
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
            : 'Serviço de IA não configurado. OPENAI_API_KEY não definida.',
        });
      } catch (error) {
        // Garantir que sempre retornamos 200 OK mesmo em caso de erro inesperado
        console.error('[AI-STATUS] Erro inesperado no endpoint de status:', error);
        
        return reply.status(200).send({
          status: 'online',
          keyConfigured: false,
          available: false,
          model: null,
          message: 'Erro ao verificar status do serviço de IA',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
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

const enableDebugRoutes =
  process.env.ENABLE_DEBUG_ROUTES === 'true' && process.env.NODE_ENV !== 'production';

if (enableDebugRoutes) {
app.get(
  '/ping',
  { preHandler: authGuard },
  async (request: FastifyRequest, reply: FastifyReply) => {
    const start = Date.now();

    try {
      const apiKey = process.env.OPENAI_API_KEY ?? '';
      const hasKey = Boolean(apiKey && apiKey.trim().length > 0);

      if (!hasKey) {
        return reply.status(200).send({
          ok: false,
          hasKey: false,
          status: null,
          ms: Date.now() - start,
          message: 'OPENAI_API_KEY não configurada no ambiente',
        });
      }

      const res = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return reply.status(200).send({
        ok: res.ok,
        hasKey: true,
        status: res.status,
        ms: Date.now() - start,
      });
    } catch (err: any) {
      return reply.status(200).send({
        ok: false,
        hasKey: true,
        status: null,
        ms: Date.now() - start,
        error: err?.name ?? 'Error',
        message: err?.message ?? String(err),
      });
    }
  }
);
}

  done();
};
