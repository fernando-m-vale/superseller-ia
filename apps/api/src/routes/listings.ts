import { FastifyPluginCallback } from 'fastify';
import { PrismaClient, Marketplace } from '@prisma/client';
import { z } from 'zod';
import { authGuard } from '../plugins/auth';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import axios, { AxiosError } from 'axios';

const prisma = new PrismaClient();
const ML_API_BASE = 'https://api.mercadolibre.com';

// TTL para considerar análise expirada (em dias)
const ANALYSIS_TTL_DAYS = Number(process.env.ANALYSIS_TTL_DAYS) || 7;

// Schema de validação para query params
const ListingsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
  q: z.string().optional(),
  status: z.enum(['active', 'paused', 'deleted']).optional(),
});

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
  
  // GET /api/v1/listings
  app.get('/', { preHandler: authGuard }, async (req, reply) => {
    try {
      // tenantId é injetado pelo authGuard
      const tenantId = req.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized: No tenant context' });
      }

      // Validar e extrair query params
      const query = ListingsQuerySchema.parse(req.query);
      const { page, pageSize, marketplace, q, status } = query;
      const skip = (page - 1) * pageSize;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = { tenant_id: tenantId };

      // Filtro de marketplace
      if (marketplace) {
        whereClause.marketplace = marketplace as Marketplace;
      }

      // Filtro de busca por título
      if (q && q.trim()) {
        whereClause.title = { contains: q.trim(), mode: 'insensitive' };
      }

      // Filtro de status
      if (status) {
        whereClause.status = status;
      }

      // Contar total para paginação
      const total = await prisma.listing.count({ where: whereClause });

      // Buscar listings com paginação
      const listings = await prisma.listing.findMany({
        where: whereClause,
        orderBy: { updated_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          listing_ai_analysis: {
            orderBy: { created_at: 'desc' },
            take: 1, // Pegar apenas a análise mais recente
            select: {
              created_at: true,
              prompt_version: true,
              model: true,
            },
          },
        },
      });

      // Calcular data de expiração (7 dias atrás)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() - ANALYSIS_TTL_DAYS);

      // Mapear para formato esperado pelo frontend (camelCase)
      const items = listings.map((listing) => {
        // Pegar análise mais recente (se existir)
        const latestAnalysis = listing.listing_ai_analysis[0] || null;
        const latestAnalysisAt = latestAnalysis?.created_at || null;

        // Calcular status da análise
        let analysisStatus: 'NOT_ANALYZED' | 'ANALYZED' | 'EXPIRED' = 'NOT_ANALYZED';
        if (latestAnalysisAt) {
          const analysisDate = new Date(latestAnalysisAt);
          if (analysisDate >= expiryDate) {
            analysisStatus = 'ANALYZED';
          } else {
            analysisStatus = 'EXPIRED';
          }
        }

        return {
          id: listing.id,
          title: listing.title,
          marketplace: listing.marketplace,
          price: Number(listing.price),
          stock: listing.stock,
          status: listing.status,
          category: listing.category,
          healthScore: listing.health_score ?? undefined, // Score legado da API do ML
          superSellerScore: listing.super_seller_score ?? undefined, // Super Seller Score proprietário
          scoreBreakdown: listing.score_breakdown ?? undefined, // Detalhamento do score
          hasVideo: listing.has_video, // null quando não sabemos (tri-state: true/false/null)
          hasClips: listing.has_clips ?? null, // null = desconhecido/não detectável via API
          listingIdExt: listing.listing_id_ext, // ID externo do marketplace (ex: MLB3923303743)
          accessStatus: listing.access_status, // Status de acesso pela conexão atual
          accessBlockedCode: listing.access_blocked_code ?? undefined, // Código do erro que bloqueou acesso
          accessBlockedReason: listing.access_blocked_reason ?? undefined, // Mensagem sanitizada do erro
          createdAt: listing.created_at,
          updatedAt: listing.updated_at,
          // Campos de promoção
          priceBase: listing.original_price ? Number(listing.original_price) : Number(listing.price),
          priceFinal: listing.price_final ? Number(listing.price_final) : Number(listing.price),
          hasPromotion: listing.has_promotion ?? false,
          discountPercent: listing.discount_percent ?? null,
          // Campos de análise
          latestAnalysisAt: latestAnalysisAt?.toISOString() || null,
          latestPromptVersion: latestAnalysis?.prompt_version || null,
          latestModel: latestAnalysis?.model || null,
          analysisStatus,
        };
      });

      return reply.send({
        items,
        total,
        page,
        pageSize,
        tenantId,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch listings' });
    }
  });

  // POST /api/v1/listings/:listingId/apply-action
  app.post<{ Params: { listingId: string } }>(
    '/:listingId/apply-action',
    { preHandler: authGuard },
    async (req, reply) => {
      try {
        // tenantId é injetado pelo authGuard
        const tenantId = req.tenantId;

        if (!tenantId) {
          return reply.status(401).send({ error: 'Unauthorized: No tenant context' });
        }

        const { listingId } = req.params as { listingId: string };
        
        // HOTFIX: Aceitar payload flexível e actionTypes granulares
        const rawBody = req.body as any;
        
        // Normalizar actionType (aceitar actionType ou action_type)
        const actionTypeRaw = rawBody.actionType || rawBody.action_type;
        if (!actionTypeRaw || typeof actionTypeRaw !== 'string') {
          return reply.status(400).send({ 
            error: 'Missing actionType',
            message: 'Campo actionType é obrigatório e deve ser uma string'
          });
        }

        // Validar actionType (granular + legacy)
        const validActionTypes = [
          'seo_title', 'seo_description', 'media_images',
          'promo_cover_badge', 'promo_banner',
          'seo', 'midia', 'cadastro', 'competitividade'
        ];
        if (!validActionTypes.includes(actionTypeRaw)) {
          return reply.status(400).send({ 
            error: `Invalid actionType: ${actionTypeRaw}`,
            message: `actionType deve ser um dos: ${validActionTypes.join(', ')}`
          });
        }

        // Normalizar beforePayload (aceitar beforePayload, before, before_payload)
        let beforePayload: Record<string, unknown> = {};
        if (rawBody.beforePayload) {
          beforePayload = typeof rawBody.beforePayload === 'object' && !Array.isArray(rawBody.beforePayload)
            ? rawBody.beforePayload
            : { value: rawBody.beforePayload };
        } else if (rawBody.before) {
          beforePayload = typeof rawBody.before === 'object' && !Array.isArray(rawBody.before)
            ? rawBody.before
            : { value: rawBody.before };
        } else if (rawBody.before_payload) {
          beforePayload = typeof rawBody.before_payload === 'object' && !Array.isArray(rawBody.before_payload)
            ? rawBody.before_payload
            : { value: rawBody.before_payload };
        }

        // Normalizar afterPayload (aceitar afterPayload, after, after_payload)
        let afterPayload: Record<string, unknown> = {};
        if (rawBody.afterPayload) {
          afterPayload = typeof rawBody.afterPayload === 'object' && !Array.isArray(rawBody.afterPayload)
            ? rawBody.afterPayload
            : { value: rawBody.afterPayload };
        } else if (rawBody.after) {
          afterPayload = typeof rawBody.after === 'object' && !Array.isArray(rawBody.after)
            ? rawBody.after
            : { value: rawBody.after };
        } else if (rawBody.after_payload) {
          afterPayload = typeof rawBody.after_payload === 'object' && !Array.isArray(rawBody.after_payload)
            ? rawBody.after_payload
            : { value: rawBody.after_payload };
        }

        // HOTFIX: Normalizar actionType legado para granular baseado no payload
        let normalizedActionType: string = actionTypeRaw;
        
        if (actionTypeRaw === 'seo') {
          // Decidir pelo afterPayload: se tem "title" => seo_title, se tem "description" => seo_description
          if (afterPayload && typeof afterPayload === 'object') {
            if ('title' in afterPayload) {
              normalizedActionType = 'seo_title';
            } else if ('description' in afterPayload) {
              normalizedActionType = 'seo_description';
            } else if ('value' in afterPayload && typeof afterPayload.value === 'string') {
              // Se for string, assumir título por padrão
              normalizedActionType = 'seo_title';
              afterPayload = { title: afterPayload.value };
            } else {
              // Default: seo_title
              normalizedActionType = 'seo_title';
            }
          } else {
            normalizedActionType = 'seo_title';
          }
        } else if (actionTypeRaw === 'midia') {
          normalizedActionType = 'media_images';
          // Se afterPayload for string ou tiver "value", converter para { plan: string }
          if (afterPayload && typeof afterPayload === 'object' && 'value' in afterPayload) {
            afterPayload = { plan: String(afterPayload.value || '') };
          }
        } else if (actionTypeRaw === 'competitividade') {
          // Manter como está ou mapear para promo_banner? Por enquanto manter legado
          normalizedActionType = 'competitividade';
        }
        // cadastro: manter legado

        // HOTFIX: Normalizar afterPayload baseado no actionType normalizado
        if (normalizedActionType === 'seo_title') {
          if (typeof afterPayload === 'string') {
            afterPayload = { title: afterPayload };
          } else if (afterPayload && typeof afterPayload === 'object' && 'value' in afterPayload) {
            afterPayload = { title: String(afterPayload.value || '') };
          } else if (!('title' in afterPayload)) {
            return reply.status(400).send({ 
              error: 'Invalid afterPayload for seo_title',
              message: 'afterPayload deve conter campo "title" ou ser uma string'
            });
          }
        } else if (normalizedActionType === 'seo_description') {
          if (typeof afterPayload === 'string') {
            afterPayload = { description: afterPayload };
          } else if (afterPayload && typeof afterPayload === 'object' && 'value' in afterPayload) {
            afterPayload = { description: String(afterPayload.value || '') };
          } else if (!('description' in afterPayload)) {
            return reply.status(400).send({ 
              error: 'Invalid afterPayload for seo_description',
              message: 'afterPayload deve conter campo "description" ou ser uma string'
            });
          }
        } else if (normalizedActionType === 'media_images') {
          if (typeof afterPayload === 'string') {
            afterPayload = { plan: afterPayload };
          } else if (afterPayload && typeof afterPayload === 'object' && 'value' in afterPayload) {
            afterPayload = { plan: String(afterPayload.value || '') };
          } else if (!('plan' in afterPayload)) {
            return reply.status(400).send({ 
              error: 'Invalid afterPayload for media_images',
              message: 'afterPayload deve conter campo "plan" ou ser uma string'
            });
          }
        }

        // Validar que afterPayload não está vazio
        if (!afterPayload || Object.keys(afterPayload).length === 0) {
          return reply.status(400).send({ 
            error: 'Missing afterPayload',
            message: 'Campo afterPayload é obrigatório e não pode estar vazio'
          });
        }

        const { AppliedActionService } = await import('../services/AppliedActionService');
        const service = new AppliedActionService();

        const result = await service.applyAction({
          tenantId,
          listingId,
          actionType: normalizedActionType as any, // HOTFIX: normalizedActionType é sempre válido após normalização
          beforePayload,
          afterPayload,
        });

        return reply.status(200).send({
          message: 'Ação aplicada com sucesso',
          data: result,
        });
      } catch (error) {
        const { listingId: listingIdParam } = req.params as { listingId: string };
        const tenantIdForLog = req.tenantId;
        app.log.error({ error, listingId: listingIdParam, tenantId: tenantIdForLog }, 'Error applying action');
        
        // DIA 06.3: Mensagens de erro mais claras
        if (error instanceof z.ZodError) {
          const firstError = error.errors[0];
          return reply.status(400).send({ 
            error: firstError.message || 'Invalid input',
            message: `Erro de validação: ${firstError.path.join('.')} - ${firstError.message}`,
            details: error.errors
          });
        }
        if (error instanceof Error) {
          if (error.message.includes('não encontrado')) {
            return reply.status(404).send({ error: error.message });
          }
          // Retornar mensagem do erro se disponível
          return reply.status(400).send({ 
            error: error.message,
            message: error.message
          });
        }
        return reply.status(500).send({ 
          error: 'Failed to apply action',
          message: 'Erro interno ao registrar ação'
        });
      }
    }
  );

  // POST /api/v1/listings/:listingId/hacks/:hackId/feedback
  // Registra feedback do usuário sobre um hack sugerido
  app.post(
    '/:listingId/hacks/:hackId/feedback',
    { preHandler: authGuard },
    async (req, reply) => {
      try {
        const tenantId = req.tenantId;
        const { listingId, hackId } = req.params as { listingId: string; hackId: string };

        if (!tenantId) {
          return reply.status(401).send({ error: 'Unauthorized: No tenant context' });
        }

        // Validar payload
        const FeedbackSchema = z.object({
          status: z.enum(['confirmed', 'dismissed']),
          notes: z.string().optional().nullable(),
        });

        const { status, notes } = FeedbackSchema.parse(req.body);

        // Validar que listing pertence ao tenant
        const listing = await prisma.listing.findFirst({
          where: {
            id: listingId,
            tenant_id: tenantId,
          },
        });

        if (!listing) {
          return reply.status(404).send({ 
            error: 'Listing not found',
            message: 'Anúncio não encontrado'
          });
        }

        // Salvar feedback
        const { saveHackFeedback } = await import('../services/ListingHacksService');
        await saveHackFeedback({
          tenantId,
          listingId,
          hackId,
          status,
          notes: notes || null,
        });

        app.log.info({ tenantId, listingId, hackId, status }, 'Feedback de hack registrado');

        return reply.status(200).send({
          message: 'Feedback registrado com sucesso',
          data: {
            listingId,
            hackId,
            status,
            notes: notes || null,
          },
        });
      } catch (error) {
        const { listingId, hackId } = (req.params as { listingId: string; hackId: string }) || {};
        const tenantIdForLog = req.tenantId;
        app.log.error({ error, listingId, hackId, tenantId: tenantIdForLog }, 'Error saving hack feedback');
        
        if (error instanceof z.ZodError) {
          const firstError = error.errors[0];
          return reply.status(400).send({ 
            error: firstError.message || 'Invalid input',
            message: `Erro de validação: ${firstError.path.join('.')} - ${firstError.message}`,
            details: error.errors
          });
        }
        if (error instanceof Error) {
          return reply.status(400).send({ 
            error: error.message,
            message: error.message
          });
        }
        return reply.status(500).send({ 
          error: 'Failed to save feedback',
          message: 'Erro interno ao registrar feedback'
        });
      }
    }
  );

  // POST /api/v1/listings/import
  // Importa anúncio manualmente por URL ou ID MLB
  app.post(
    '/import',
    { preHandler: authGuard },
    async (req, reply) => {
      try {
        const tenantId = req.tenantId;

        if (!tenantId) {
          return reply.status(401).send({ error: 'Unauthorized: No tenant context' });
        }

        // Validar payload
        const ImportSchema = z.object({
          source: z.enum(['mercadolivre']).default('mercadolivre'),
          externalId: z.string().min(1, 'externalId é obrigatório'),
        });

        const { source, externalId } = ImportSchema.parse(req.body);

        // Extrair ID MLB da URL ou usar diretamente
        let mlbId = externalId.trim();
        
        // Se vier URL completa, extrair ID
        if (mlbId.includes('mercadolivre.com.br') || mlbId.includes('mercadolivre.com')) {
          const urlMatch = mlbId.match(/MLB-?\d+/);
          if (urlMatch) {
            mlbId = urlMatch[0].replace('MLB-', 'MLB');
          } else {
            // Tentar extrair do path
            const pathMatch = mlbId.match(/\/(MLB-?\d+)/);
            if (pathMatch) {
              mlbId = pathMatch[1].replace('MLB-', 'MLB');
            }
          }
        }

        // Validar formato MLB
        if (!mlbId.startsWith('MLB')) {
          return reply.status(400).send({ 
            error: 'Invalid externalId',
            message: 'O ID deve começar com MLB (ex: MLB1234567890)'
          });
        }

        // Normalizar: garantir que seja MLB seguido de números
        mlbId = mlbId.replace(/^MLB-?/, 'MLB');

        app.log.info({ tenantId, mlbId, source }, 'Iniciando import manual de anúncio');

        // Verificar se já existe
        const existingListing = await prisma.listing.findFirst({
          where: {
            tenant_id: tenantId,
            marketplace: Marketplace.mercadolivre,
            listing_id_ext: mlbId,
          },
          select: {
            id: true,
            title: true,
            status: true,
          },
        });

        if (existingListing) {
          app.log.info({ tenantId, mlbId, listingId: existingListing.id }, 'Anúncio já existe, retornando existente');
          return reply.status(200).send({
            message: 'Anúncio já existe',
            data: {
              id: existingListing.id,
              title: existingListing.title,
              status: existingListing.status,
              listingIdExt: mlbId,
              alreadyExists: true,
            },
          });
        }

        // Usar MercadoLivreSyncService para criar/atualizar listing
        // Isso garante consistência com o fluxo de sync normal
        const syncService = new MercadoLivreSyncService(tenantId);
        
        // Buscar detalhes completos via sync service (com autenticação)
        const items = await syncService.fetchItemsDetails([mlbId], false);
        
        if (items.length === 0) {
          return reply.status(404).send({
            error: 'Anúncio não encontrado',
            message: `O anúncio ${mlbId} não foi encontrado ou não está acessível.`,
          });
        }

        // Upsert listing (criar ou atualizar)
        const { created, updated } = await syncService.upsertListings(items, 'manual_import', false);

        // Buscar listing criado
        const importedListing = await prisma.listing.findUnique({
          where: {
            tenant_id_marketplace_listing_id_ext: {
              tenant_id: tenantId,
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: mlbId,
            },
          },
          select: {
            id: true,
            title: true,
            status: true,
            listing_id_ext: true,
            price: true,
            stock: true,
            marketplace: true,
          },
        });

        if (!importedListing) {
          return reply.status(500).send({
            error: 'Erro ao criar listing',
            message: 'O anúncio foi processado mas não foi encontrado no banco de dados.',
          });
        }

        app.log.info({ 
          tenantId, 
          mlbId, 
          listingId: importedListing.id, 
          created, 
          updated 
        }, 'Import manual concluído com sucesso');

        return reply.status(201).send({
          message: 'Anúncio importado com sucesso',
          data: {
            id: importedListing.id,
            title: importedListing.title,
            status: importedListing.status,
            listingIdExt: importedListing.listing_id_ext,
            price: Number(importedListing.price),
            stock: importedListing.stock,
            marketplace: importedListing.marketplace,
            alreadyExists: false,
          },
        });
      } catch (error) {
        app.log.error({ error, tenantId: req.tenantId }, 'Erro ao importar anúncio');
        
        if (error instanceof z.ZodError) {
          const firstError = error.errors[0];
          return reply.status(400).send({
            error: 'Invalid input',
            message: firstError.message,
            details: error.errors,
          });
        }

        if (error instanceof Error) {
          return reply.status(500).send({
            error: 'Erro ao importar anúncio',
            message: error.message || 'Erro interno ao importar anúncio',
          });
        }

        return reply.status(500).send({
          error: 'Erro ao importar anúncio',
          message: 'Erro interno ao importar anúncio',
        });
      }
    }
  );

  // GET /api/v1/listings/:listingId/hacks/feedback
  // HOTFIX 09.7: Buscar histórico de feedback dos hacks
  app.get(
    '/:listingId/hacks/feedback',
    { preHandler: authGuard },
    async (req, reply) => {
      try {
        const tenantId = req.tenantId;
        const { listingId } = req.params as { listingId: string };

        if (!tenantId) {
          return reply.status(401).send({ error: 'Unauthorized: No tenant context' });
        }

        // Validar que listing pertence ao tenant
        const listing = await prisma.listing.findFirst({
          where: {
            id: listingId,
            tenant_id: tenantId,
          },
        });

        if (!listing) {
          return reply.status(404).send({ 
            error: 'Listing not found',
            message: 'Anúncio não encontrado'
          });
        }

        // Buscar histórico
        const { getHackHistory } = await import('../services/ListingHacksService');
        const history = await getHackHistory(tenantId, listingId);

        return reply.status(200).send({
          message: 'Histórico de feedback carregado',
          data: history,
        });
      } catch (error) {
        app.log.error({ error, listingId: req.params?.listingId, tenantId: req.tenantId }, 'Error fetching hack feedback history');
        return reply.status(500).send({ 
          error: 'Failed to fetch feedback history',
          message: 'Erro interno ao buscar histórico de feedback'
        });
      }
    }
  );

  done();
};