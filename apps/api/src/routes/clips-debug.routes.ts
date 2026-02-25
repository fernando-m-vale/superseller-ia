/**
 * Clips API Debug Routes
 *
 * Endpoint de debug ISOLADO para investigar se a API publica do Mercado Livre
 * expoe informacao de Clips para itens locais (MLB).
 *
 * NAO altera:
 * - has_clips / persistencia
 * - fluxo de sync
 * - extractor de video
 * - score
 *
 * Pode ser removido apos investigacao.
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Marketplace } from '@prisma/client';
import { authGuard } from '../plugins/auth';
import axios from 'axios';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
  requestId?: string;
}

const ItemIdParamsSchema = z.object({
  itemId: z.string().min(1).regex(/^[A-Z]{3}\d+$/, 'Formato esperado: MLB1234567890'),
});

interface ClipsEndpointResult {
  endpointTested: string;
  status: number;
  body: unknown;
  headers: Record<string, string>;
  responseTimeMs: number;
  error?: string;
}

export const clipsDebugRoutes: FastifyPluginCallback = (app, _, done) => {
  /**
   * GET /api/v1/debug/ml/clips/:itemId
   *
   * Testa sequencialmente dois endpoints candidatos para Clips:
   *   a) GET /marketplace/items/{itemId}/clips  (padrao CBT documentado)
   *   b) GET /items/{itemId}/clips              (padrao local hipotetico)
   *
   * Usa access_token real da conexao ML do usuario logado.
   * Nao exige token manual no curl.
   * Nao altera nenhuma logica de producao.
   */
  app.get<{ Params: { itemId: string } }>(
    '/clips/:itemId',
    { preHandler: authGuard },
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply) => {
      const { tenantId, userId, requestId } = request as RequestWithAuth;

      try {
        if (!tenantId) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Token invalido ou tenant nao identificado',
          });
        }

        const params = ItemIdParamsSchema.parse(request.params);
        const { itemId } = params;

        request.log.info({
          requestId,
          userId,
          tenantId,
          itemId,
        }, '[CLIPS-DEBUG] Iniciando investigacao de clips');

        // Buscar conexao ativa do Mercado Livre (mesmo padrao de debug.routes.ts)
        const connection = await prisma.marketplaceConnection.findFirst({
          where: {
            tenant_id: tenantId,
            type: Marketplace.mercadolivre,
            status: 'active',
          },
          orderBy: { updated_at: 'desc' },
        });

        if (!connection || !connection.access_token) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Conexao ativa do Mercado Livre nao encontrada',
          });
        }

        const accessToken = connection.access_token;

        // Definir endpoints a testar em sequencia
        const endpointsToTest = [
          {
            label: 'marketplace_clips',
            url: `${ML_API_BASE}/marketplace/items/${itemId}/clips`,
          },
          {
            label: 'items_clips',
            url: `${ML_API_BASE}/items/${itemId}/clips`,
          },
        ];

        const results: ClipsEndpointResult[] = [];

        for (const endpoint of endpointsToTest) {
          const startTime = Date.now();
          try {
            const response = await axios.get(endpoint.url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              timeout: 15000,
              // Nao lancar erro para 4xx (queremos capturar o body)
              validateStatus: () => true,
            });

            const elapsed = Date.now() - startTime;

            // Capturar headers relevantes (sem expor tokens)
            const relevantHeaders: Record<string, string> = {};
            const headerKeys = [
              'content-type',
              'x-request-id',
              'x-content-type-options',
              'x-frame-options',
              'date',
              'retry-after',
              'x-ratelimit-limit',
              'x-ratelimit-remaining',
              'x-ratelimit-reset',
            ];
            for (const key of headerKeys) {
              const val = response.headers[key];
              if (val !== undefined && val !== null) {
                relevantHeaders[key] = String(val);
              }
            }

            results.push({
              endpointTested: endpoint.url,
              status: response.status,
              body: response.data,
              headers: relevantHeaders,
              responseTimeMs: elapsed,
            });

            request.log.info({
              requestId,
              itemId,
              endpoint: endpoint.label,
              status: response.status,
              responseTimeMs: elapsed,
            }, `[CLIPS-DEBUG] Endpoint ${endpoint.label} respondeu`);
          } catch (err: unknown) {
            const elapsed = Date.now() - startTime;
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';

            let status = 0;
            let body: unknown = null;
            if (axios.isAxiosError(err) && err.response) {
              status = err.response.status;
              body = err.response.data;
            }

            results.push({
              endpointTested: endpoint.url,
              status,
              body,
              headers: {},
              responseTimeMs: elapsed,
              error: errorMessage,
            });

            request.log.warn({
              requestId,
              itemId,
              endpoint: endpoint.label,
              err: err as Error,
              status,
              responseTimeMs: elapsed,
            }, `[CLIPS-DEBUG] Endpoint ${endpoint.label} falhou`);
          }
        }

        // Tambem buscar item basico para contexto (video_id, tags)
        let itemContext: {
          video_id: unknown;
          videos: unknown;
          tags: unknown;
          title: string | null;
        } | null = null;

        try {
          const itemResp = await axios.get(`${ML_API_BASE}/items/${itemId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
            params: { attributes: 'video_id,videos,tags,title' },
          });
          const d = itemResp.data as Record<string, unknown>;
          itemContext = {
            video_id: d.video_id ?? null,
            videos: d.videos ?? null,
            tags: d.tags ?? null,
            title: typeof d.title === 'string' ? d.title : null,
          };
        } catch (err: unknown) {
          request.log.warn({ err: err as Error, itemId }, '[CLIPS-DEBUG] Falha ao buscar contexto do item');
        }

        const response = {
          investigation: 'clips-api-probe',
          itemId,
          testedAt: new Date().toISOString(),
          results,
          itemContext,
          summary: {
            totalEndpointsTested: results.length,
            anySuccess: results.some((r) => r.status >= 200 && r.status < 300),
            successfulEndpoints: results
              .filter((r) => r.status >= 200 && r.status < 300)
              .map((r) => r.endpointTested),
          },
        };

        request.log.info({
          requestId,
          itemId,
          anySuccess: response.summary.anySuccess,
          successfulEndpoints: response.summary.successfulEndpoints,
        }, '[CLIPS-DEBUG] Investigacao concluida');

        return reply.status(200).send(response);
      } catch (error: unknown) {
        const itemId = (request.params as { itemId?: string })?.itemId;

        request.log.error({
          requestId,
          userId,
          tenantId,
          itemId,
          err: error as Error,
        }, '[CLIPS-DEBUG] Erro na investigacao');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'ID do item invalido. Formato esperado: MLB1234567890',
            details: error.errors,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Erro na investigacao de clips';
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  done();
};
