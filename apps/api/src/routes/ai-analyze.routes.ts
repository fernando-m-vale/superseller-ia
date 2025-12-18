/**
 * AI Analyze Routes
 * 
 * Endpoints for AI-powered listing analysis using OpenAI GPT-4o.
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OpenAIService } from '../services/OpenAIService';
import { authGuard } from '../plugins/auth';
import { sanitizeOpenAIError, createSafeErrorMessage } from '../utils/sanitize-error';

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
        const { requestId, userId } = request;

        request.log.info({ 
          requestId,
          userId,
          tenantId,
          listingId,
        }, 'Starting AI analysis');

        const service = new OpenAIService(tenantId);

        if (!service.isAvailable()) {
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'OpenAI API key not configured. Please contact support.',
          });
        }

        const result = await service.analyzeAndSaveRecommendations(listingId);

        const { requestId, userId } = request;
        request.log.info(
          {
            requestId,
            userId,
            tenantId,
            listingId,
            score: result.analysis.score,
            growthHacksCount: result.analysis.growthHacks.length,
            savedRecommendations: result.savedRecommendations,
          },
          'AI analysis complete'
        );

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
        const { listingId } = (request.params as { listingId: string }) || {};
        const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

        // Log erro sanitizado (sem tokens/secrets)
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
          const { tenantId: tenantIdForLog } = request as RequestWithAuth;
          request.log.warn({ tenantId: tenantIdForLog, err: serviceError }, 'Error checking service availability');
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
        const { tenantId: tenantIdForLog } = request as RequestWithAuth;
        request.log.error({ tenantId: tenantIdForLog, err: error }, 'Unexpected error in status endpoint');
        
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
      try {
        const { tenantId } = request as RequestWithAuth;
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

        const { tenantId: tenantIdForLog } = request as RequestWithAuth;
        request.log.debug({ tenantId: tenantIdForLog, status: res.status, ms: Date.now() - start }, 'AI ping check');

        return reply.status(200).send({
          ok: res.ok,
          hasKey: true,
          status: res.status,
          ms: Date.now() - start,
        });
      } catch (err) {
        const { tenantId: tenantIdForLog } = request as RequestWithAuth;
        request.log.warn({ tenantId: tenantIdForLog, err }, 'AI ping error');
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
