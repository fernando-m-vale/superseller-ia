/**
 * Debug Routes
 * 
 * Endpoints de diagnóstico para desenvolvimento e staging.
 * Protegidos por feature flags e nunca disponíveis em produção.
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Marketplace } from '@prisma/client';
import { authGuard } from '../plugins/auth';
import { extractHasVideoFromMlItem } from '../utils/ml-video-extractor';
import axios from 'axios';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
  requestId?: string;
}

const ItemIdParamsSchema = z.object({
  itemIdExt: z.string().min(1),
});

/**
 * Endpoint de diagnóstico para inspecionar payload do Mercado Livre
 * 
 * GET /api/v1/debug/mercadolivre/item/:itemIdExt
 * 
 * Disponível apenas quando:
 * - ENABLE_ML_DEBUG=true
 * - NODE_ENV !== 'production'
 * 
 * Retorna apenas campos whitelisted relacionados a vídeo/mídia (sem tokens/headers).
 */
const enableMLDebug = process.env.ENABLE_ML_DEBUG === 'true' && process.env.NODE_ENV !== 'production';

export const debugRoutes: FastifyPluginCallback = (app, _, done) => {
  if (enableMLDebug) {
    app.get<{ Params: { itemIdExt: string } }>(
      '/mercadolivre/item/:itemIdExt',
      { preHandler: authGuard },
      async (request: FastifyRequest<{ Params: { itemIdExt: string } }>, reply: FastifyReply) => {
        const { tenantId, userId, requestId } = request as RequestWithAuth & { requestId?: string };

        try {
          if (!tenantId) {
            return reply.status(401).send({
              error: 'Unauthorized',
              message: 'Token inválido ou tenant não identificado',
            });
          }

          const params = ItemIdParamsSchema.parse(request.params);
          const { itemIdExt } = params;

          request.log.info({
            requestId,
            userId,
            tenantId,
            itemIdExt,
          }, 'ML debug: fetching item');

          // Buscar conexão ativa do Mercado Livre
          const connection = await prisma.marketplaceConnection.findFirst({
            where: {
              tenant_id: tenantId,
              type: Marketplace.mercadolivre,
              status: 'active',
            },
          });

          if (!connection || !connection.access_token) {
            return reply.status(404).send({
              error: 'Not Found',
              message: 'Conexão ativa do Mercado Livre não encontrada',
            });
          }

          // Buscar item no ML (mesma forma que o sync faz)
          const itemResponse = await axios.get(`${ML_API_BASE}/items/${itemIdExt}`, {
            headers: {
              Authorization: `Bearer ${connection.access_token}`,
            },
          });

          const item = itemResponse.data;

          // Extrair informação de vídeo usando helper
          const videoExtraction = extractHasVideoFromMlItem(item);

          // Coletar chaves relacionadas a vídeo
          const keysWithVideo: string[] = [];
          if (item && typeof item === 'object') {
            for (const key in item) {
              if (key.toLowerCase().includes('video')) {
                keysWithVideo.push(key);
              }
            }
          }

          // Extrair dados de vídeo raw (apenas sub-objetos, sem tokens)
          const rawVideoKeys: Record<string, unknown> = {};
          if (item && typeof item === 'object') {
            const itemObj = item as Record<string, unknown>;
            if ('video_id' in itemObj && typeof itemObj.video_id === 'string') {
              rawVideoKeys.video_id = itemObj.video_id;
            }
            if ('videos' in itemObj && Array.isArray(itemObj.videos)) {
              // Limitar array para não expor dados sensíveis
              rawVideoKeys.videos = (itemObj.videos as unknown[]).slice(0, 3).map((v: unknown) => {
                if (typeof v === 'object' && v !== null) {
                  const vObj = v as Record<string, unknown>;
                  return {
                    id: vObj.id || null,
                    type: vObj.type || null,
                    // Não incluir outros campos que possam conter tokens
                  };
                }
                return v;
              });
            }
          }

          // Construir resposta whitelisted (sem tokens/headers)
          const response = {
            itemIdExt,
            title: item?.title || null,
            picturesCount: Array.isArray(item?.pictures) ? item.pictures.length : 0,
            thumbnail: item?.thumbnail || null,
            video: {
              hasVideo: videoExtraction.hasVideo,
              evidence: videoExtraction.evidence,
              rawVideoKeys: Object.keys(rawVideoKeys).length > 0 ? rawVideoKeys : undefined,
            },
            keysWithVideo,
            fetchedAt: new Date().toISOString(),
          };

          request.log.info({
            requestId,
            userId,
            tenantId,
            itemIdExt,
            hasVideo: videoExtraction.hasVideo,
            evidenceCount: videoExtraction.evidence.length,
          }, 'ML debug: item fetched');

          return reply.status(200).send(response);
        } catch (error) {
          const { itemIdExt } = (request.params as { itemIdExt?: string }) || {};

          request.log.error({
            requestId,
            userId,
            tenantId,
            itemIdExt,
            err: error,
          }, 'ML debug: error fetching item');

          if (error instanceof z.ZodError) {
            return reply.status(400).send({
              error: 'Validation Error',
              message: 'ID do item inválido',
            });
          }

          const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar item';
          return reply.status(500).send({
            error: 'Internal Server Error',
            message: errorMessage,
          });
        }
      }
    );
  } else {
    // Retornar 404 quando desabilitado
    app.get('/mercadolivre/item/:itemIdExt', async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(404).send({ error: 'Not Found' });
    });
  }

  done();
};

