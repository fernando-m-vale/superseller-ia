import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { getMercadoLivreCredentials } from '../lib/secrets';
import { authGuard } from '../plugins/auth';
import { checkConnectionLimit } from '../lib/plan-guard';
import { MercadoLivreSyncService } from '../services/MercadoLivreSyncService';
import { MercadoLivreOrdersService } from '../services/MercadoLivreOrdersService';
import { MercadoLivreVisitsService } from '../services/MercadoLivreVisitsService';

const prisma = new PrismaClient();

// URLs Corretas
const ML_AUTH_BASE = 'https://auth.mercadolivre.com.br';
const ML_API_BASE = 'https://api.mercadolibre.com';

/**
 * Função helper para disparar sync completo após reconexão
 * Executa de forma assíncrona (fire-and-forget) para não bloquear a resposta
 */
export async function triggerFullSync(tenantId: string): Promise<void> {
  try {
    // Log estruturado: início do sync full
    console.log(`[ML-SYNC-FULL] Iniciando sync completo tenantId=${tenantId}`);
    
    // Sync de listings
    const syncService = new MercadoLivreSyncService(tenantId);
    const listingsResult = await syncService.syncListings();
    // Log estruturado: resultado do sync de listings
    console.log(`[ML-SYNC-FULL] Sync listings concluído tenantId=${tenantId} processed=${listingsResult.itemsProcessed} created=${listingsResult.itemsCreated} updated=${listingsResult.itemsUpdated} durationMs=${listingsResult.duration}`);

    // Sync de pedidos (últimos 30 dias)
    const ordersService = new MercadoLivreOrdersService(tenantId);
    const ordersResult = await ordersService.syncOrders(30);
    // Log estruturado: resultado do sync de orders
    console.log(`[ML-SYNC-FULL] Sync orders concluído tenantId=${tenantId} processed=${ordersResult.ordersProcessed} created=${ordersResult.ordersCreated} updated=${ordersResult.ordersUpdated} durationMs=${ordersResult.duration}`);

    // Log estruturado: resumo final
    console.log(`[ML-SYNC-FULL] Sync completo finalizado tenantId=${tenantId}`);
  } catch (error) {
    // Log do erro mas não propaga para não afetar o callback
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[ML-SYNC-FULL] Erro ao executar sync completo tenantId=${tenantId} error=${errorMsg}`, error);
    throw error;
  }
}

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

export const mercadolivreRoutes: FastifyPluginCallback = (app, _, done) => {
  
  // Rota de Conexão
  app.get('/connect', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) return reply.status(401).send({ error: 'Unauthorized' });

      const credentials = await getMercadoLivreCredentials();
      
      const state = crypto.randomBytes(16).toString('hex');
      const stateData = JSON.stringify({ tenantId, userId, nonce: state });
      const encodedState = Buffer.from(stateData).toString('base64');

      const authUrl = new URL(`${ML_AUTH_BASE}/authorization`);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', credentials.clientId);
      authUrl.searchParams.append('redirect_uri', credentials.redirectUri);
      authUrl.searchParams.append('state', encodedState);
      
      return reply.send({ authUrl: authUrl.toString() });
        } catch (error) {
          app.log.error({ err: error }, 'Failed to initiate Mercado Livre connection');
          return reply.status(500).send({ error: 'Failed to initiate Mercado Livre connection' });
        }
  });

    // Rota de Status da Conexão - verifica status e retorna se está conectado
    app.get('/status', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = req as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const connection = await prisma.marketplaceConnection.findFirst({
          where: {
            tenant_id: tenantId,
            type: Marketplace.mercadolivre,
          },
          orderBy: { updated_at: 'desc' },
        });

        if (!connection) {
          return reply.send({
            connected: false,
            status: 'DISCONNECTED',
            message: 'Nenhuma conexão encontrada',
          });
        }

        // Verificar se está ativa e não expirada
        const now = new Date();
        const isExpired = connection.expires_at && connection.expires_at < now;
        const isActive = connection.status === ConnectionStatus.active && !isExpired;

        return reply.send({
          connected: isActive,
          status: isActive ? 'CONNECTED' : connection.status.toUpperCase(),
          expiresAt: connection.expires_at?.toISOString(),
          isExpired,
        });
      } catch (error) {
        app.log.error({ err: error }, 'Failed to check Mercado Livre status');
        return reply.status(500).send({ error: 'Failed to check Mercado Livre status' });
      }
    });

    // Rota de Health Check - verifica se há conexão ativa com ML
    app.get('/health', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId } = req as RequestWithAuth;

        if (!tenantId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const connection = await prisma.marketplaceConnection.findFirst({
          where: {
            tenant_id: tenantId,
            type: Marketplace.mercadolivre,
            status: ConnectionStatus.active,
          },
          orderBy: { updated_at: 'desc' },
        });

        if (!connection) {
          return reply.status(404).send({ error: 'No active Mercado Livre connection found' });
        }

        // Fetch user info from ML API to get nickname, siteId, etc.
        try {
          const userResponse = await axios.get(`${ML_API_BASE}/users/me`, {
            headers: {
              Authorization: `Bearer ${connection.access_token}`,
            },
          });

          const userData = userResponse.data;
          return reply.send({
            ok: true,
            sellerId: connection.provider_account_id,
            nickname: userData.nickname || '',
            siteId: userData.site_id || 'MLB',
            countryId: userData.country_id || 'BR',
            tags: userData.tags || [],
          });
                } catch (apiError) {
                  // Token might be expired, return basic info
                  app.log.warn({ err: apiError }, 'Failed to fetch ML user info, token may be expired');
                  return reply.send({
            ok: true,
            sellerId: connection.provider_account_id,
            nickname: '',
            siteId: 'MLB',
            countryId: 'BR',
            tags: [],
          });
        }
          } catch (error) {
            app.log.error({ err: error }, 'Failed to check Mercado Livre health');
            return reply.status(500).send({ error: 'Failed to check Mercado Livre health' });
          }
        });

    // Rota de Callback
    app.get('/callback', async (req: FastifyRequest, reply: FastifyReply) => {
      const requestId = (req as any).requestId || 'unknown';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.superselleria.com.br';

      try {
        // ========== ETAPA 1: ENTRADA ==========
        const { code, state } = req.query as { code: string; state: string };
        
        const hasCode = !!code;
        const codePrefix = code ? code.substring(0, 6) : 'missing';
        const stateLen = state ? state.length : 0;
        const stateRawPrefix = state ? state.substring(0, 10) : 'missing';

        app.log.info({
          requestId,
          hasCode,
          codePrefix,
          stateLen,
          stateRawPrefix,
        }, '[ML-CALLBACK] Entrada do callback');

        if (!code) {
          app.log.warn({ requestId }, '[ML-CALLBACK] Code não fornecido');
          return reply.redirect(`${appUrl}/overview?ml_connect=error&code=NO_CODE`);
        }

        if (!state) {
          app.log.warn({ requestId }, '[ML-CALLBACK] State não fornecido');
          return reply.redirect(`${appUrl}/overview?ml_connect=error&code=NO_STATE`);
        }

        // ========== ETAPA 2: DECODE DO STATE ==========
        let decodedState: { tenantId: string; userId: string; nonce: string };
        try {
          // Decode URI component primeiro
          const decodedStateStr = decodeURIComponent(state);
          // Depois decode base64
          const jsonState = Buffer.from(decodedStateStr, 'base64').toString('utf-8');
          decodedState = JSON.parse(jsonState);

          app.log.info({
            requestId,
            stateDecodedJson: {
              tenantId: decodedState.tenantId,
              userId: decodedState.userId,
              nonce: decodedState.nonce ? decodedState.nonce.substring(0, 8) : 'missing',
            },
          }, '[ML-CALLBACK] State decodificado com sucesso');
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          const errorStack = e instanceof Error ? e.stack : undefined;
          
          app.log.error({
            requestId,
            error: errorMsg,
            stack: errorStack,
            stateRawPrefix,
          }, '[ML-CALLBACK] Erro ao decodificar state');

          return reply.redirect(`${appUrl}/overview?ml_connect=error&code=STATE_INVALID`);
        }

        const { tenantId, userId } = decodedState;

        if (!tenantId || !userId) {
          app.log.warn({
            requestId,
            tenantId: !!tenantId,
            userId: !!userId,
          }, '[ML-CALLBACK] tenantId ou userId ausente no state decodificado');
          return reply.redirect(`${appUrl}/overview?ml_connect=error&code=STATE_INVALID`);
        }

        // ========== ETAPA 3: VERIFICAR REDIRECT_URI ==========
        const credentials = await getMercadoLivreCredentials();
        const redirectUri = credentials.redirectUri;

        if (!redirectUri || redirectUri.trim() === '') {
          app.log.error({ requestId }, '[ML-CALLBACK] ML_REDIRECT_URI não configurado');
          return reply.status(500).send({
            error: 'ML_REDIRECT_URI_MISSING',
            message: 'Redirect URI não configurado',
            code: 'ML_REDIRECT_URI_MISSING',
          });
        }

        app.log.info({
          requestId,
          redirectUri,
          tenantId,
          userId,
        }, '[ML-CALLBACK] Redirect URI verificado, iniciando token exchange');

        // ========== ETAPA 4: TOKEN EXCHANGE COM ML ==========
        let tokenResponse;
        try {
          tokenResponse = await axios.post(
            `${ML_API_BASE}/oauth/token`,
            new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: credentials.clientId,
              client_secret: credentials.clientSecret,
              code: code,
              redirect_uri: redirectUri,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );

          app.log.info({
            requestId,
            hasAccessToken: !!tokenResponse.data.access_token,
            hasRefreshToken: !!tokenResponse.data.refresh_token,
            expiresIn: tokenResponse.data.expires_in,
            mlUserId: tokenResponse.data.user_id,
          }, '[ML-CALLBACK] Token exchange bem-sucedido');
        } catch (tokenError: any) {
          const statusCode = tokenError.response?.status;
          const errorBody = tokenError.response?.data || {};
          const errorDescription = errorBody.error_description || errorBody.error || 'Unknown error';
          
          // Sanitizar body (remover tokens se existirem)
          const sanitizedBody = { ...errorBody };
          if (sanitizedBody.access_token) delete sanitizedBody.access_token;
          if (sanitizedBody.refresh_token) delete sanitizedBody.refresh_token;

          app.log.error({
            requestId,
            statusCode,
            errorDescription,
            sanitizedBody,
            redirectUri,
          }, '[ML-CALLBACK] Erro no token exchange com ML');

          return reply.status(502).send({
            error: 'ML_TOKEN_EXCHANGE_FAILED',
            message: `Falha ao trocar código por token: ${errorDescription}`,
            code: 'ML_TOKEN_EXCHANGE_FAILED',
            mlError: {
              status: statusCode,
              description: errorDescription,
            },
          });
        }

        const { access_token, refresh_token, expires_in, user_id: mlUserId } = tokenResponse.data;
        const providerAccountId = String(mlUserId);

        // ========== ETAPA 4b: BUSCAR NICKNAME DO ML ==========
        let mlNickname: string | null = null;
        try {
          const meResponse = await axios.get(`${ML_API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });
          mlNickname = meResponse.data?.nickname ?? null;
          app.log.info({ requestId, mlNickname }, '[ML-CALLBACK] Nickname obtido');
        } catch (nickErr) {
          app.log.warn({ requestId, err: nickErr }, '[ML-CALLBACK] Falha ao obter nickname (não crítico)');
        }

        // ========== ETAPA 4c: VERIFICAR LIMITE DE CONEXÕES (FREE) ==========
        // Só verifica se não é uma reconexão de conta já existente
        const existingForLimit = await prisma.marketplaceConnection.findFirst({
          where: { tenant_id: tenantId, type: Marketplace.mercadolivre, provider_account_id: providerAccountId },
        });
        if (!existingForLimit) {
          const limitCheck = await checkConnectionLimit(tenantId, prisma);
          if (!limitCheck.allowed) {
            app.log.warn({ requestId, tenantId, count: limitCheck.count }, '[ML-CALLBACK] Limite de conexões atingido');
            return reply.redirect(
              `${appUrl}/settings/connections?error=connection_limit&used=${limitCheck.count}&limit=${limitCheck.limit}`,
            );
          }
        }

        // ========== ETAPA 4d: ANTI-BURLA DO TRIAL ==========
        // Verificar se esse seller_id do ML já consumiu trial em outro tenant
        const connectionsWithSameAccount = await prisma.marketplaceConnection.findMany({
          where: {
            provider_account_id: providerAccountId,
            type: Marketplace.mercadolivre,
            tenant_id: { not: tenantId },
          },
          select: { tenant_id: true },
        });

        if (connectionsWithSameAccount.length > 0) {
          const otherTenantIds = connectionsWithSameAccount.map(c => c.tenant_id);
          const trialUsedTenant = await prisma.tenant.findFirst({
            where: { id: { in: otherTenantIds }, trial_used: true },
          });

          if (trialUsedTenant) {
            app.log.warn({ requestId, tenantId, providerAccountId }, '[ML-CALLBACK] Anti-burla: trial já usado em outro tenant');
            // Revogar trial do tenant atual
            await prisma.tenant.update({
              where: { id: tenantId },
              data: { plan: 'free', plan_status: 'active', trial_ends_at: null, trial_used: true },
            });
            // Ainda permite a conexão, mas avisa o usuário
            // (a persistência continua abaixo, só redirecionamos com warning)
          }
        }

        // Marcar trial_used = true ao conectar ML pela primeira vez (se trial ativo)
        const currentTenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { plan_status: true, trial_used: true },
        });
        if (currentTenant?.plan_status === 'trialing' && !currentTenant.trial_used) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { trial_used: true },
          });
        }

        // Verificar se deve redirecionar com warning de anti-burla
        const tenantAfterAntiburla = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true, trial_used: true, plan_status: true },
        });
        const trialWasRevoked = tenantAfterAntiburla?.plan === 'free' &&
          tenantAfterAntiburla?.trial_used === true &&
          connectionsWithSameAccount.length > 0;

        // ========== ETAPA 5: PERSISTÊNCIA NO BANCO ==========
        try {
          const existingConnection = await prisma.marketplaceConnection.findFirst({
            where: {
              tenant_id: tenantId,
              type: Marketplace.mercadolivre, 
              provider_account_id: providerAccountId,
            },
          });

          if (existingConnection) {
            app.log.info({
              requestId,
              connectionId: existingConnection.id,
              action: 'update',
              tenantId,
              providerAccountId,
            }, '[ML-CALLBACK] Atualizando conexão existente');

            await prisma.marketplaceConnection.update({
              where: { id: existingConnection.id },
              data: {
                access_token: access_token,
                refresh_token: refresh_token,
                expires_at: new Date(Date.now() + expires_in * 1000),
                status: ConnectionStatus.active,
                // Atualizar nickname se obtido
                ...(mlNickname ? { nickname: mlNickname } : {}),
                // Limpar campos de erro ao reconectar
                last_error_code: null,
                last_error_at: null,
                last_error_message: null,
              },
            });

            app.log.info({
              requestId,
              connectionId: existingConnection.id,
            }, '[ML-CALLBACK] Conexão atualizada com sucesso');
          } else {
            app.log.info({
              requestId,
              action: 'create',
              tenantId,
              providerAccountId,
            }, '[ML-CALLBACK] Criando nova conexão');

            const newConnection = await prisma.marketplaceConnection.create({
              data: {
                tenant_id: tenantId,
                type: Marketplace.mercadolivre,
                provider_account_id: providerAccountId,
                nickname: mlNickname,
                access_token: access_token,
                refresh_token: refresh_token,
                expires_at: new Date(Date.now() + expires_in * 1000),
                status: ConnectionStatus.active,
              },
            });

            app.log.info({
              requestId,
              connectionId: newConnection.id,
            }, '[ML-CALLBACK] Nova conexão criada com sucesso');
          }
        } catch (dbError: any) {
          const errorCode = dbError.code;
          const errorMeta = dbError.meta;
          const errorStack = dbError.stack;

          app.log.error({
            requestId,
            errorCode,
            errorMeta,
            stack: errorStack,
            tenantId,
            providerAccountId,
          }, '[ML-CALLBACK] Erro ao persistir conexão no banco');

          return reply.status(500).send({
            error: 'DB_PERSIST_FAILED',
            message: 'Falha ao salvar conexão no banco de dados',
            code: 'DB_PERSIST_FAILED',
            dbError: {
              code: errorCode,
              meta: errorMeta,
            },
          });
        }

        // ========== ETAPA 6: DISPARAR SYNC E REDIRECIONAR ==========
        // Disparar sync completo de forma assíncrona (fire-and-forget)
        triggerFullSync(tenantId).catch(err => {
          app.log.error({ 
            requestId,
            err,
            tenantId,
          }, '[ML-CALLBACK] Falha ao disparar sync após reconexão');
        });

        app.log.info({
          requestId,
          tenantId,
          providerAccountId,
        }, '[ML-CALLBACK] Callback concluído com sucesso, redirecionando');

        // Redirecionar — se trial foi revogado, avisar no onboarding
        if (trialWasRevoked) {
          return reply.redirect(`${appUrl}/onboarding?warning=trial_already_used`);
        }
        return reply.redirect(`${appUrl}/overview?ml_connect=success`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        app.log.error({
          requestId,
          error: errorMsg,
          stack: errorStack,
        }, '[ML-CALLBACK] Erro não tratado no callback');

        // Redirecionar com código de erro genérico
        return reply.redirect(`${appUrl}/overview?ml_connect=error&code=UNKNOWN_ERROR`);
      }
    });

  // POST /api/v1/sync/mercadolivre/visits
  // Sincroniza visitas incrementais (últimos 2-3 dias)
  app.post('/sync/mercadolivre/visits', { preHandler: authGuard }, async (req, reply) => {
    try {
      const tenantId = (req as RequestWithAuth).tenantId;
      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { lastDays = 2 } = req.body as { lastDays?: number };

      const visitsService = new MercadoLivreVisitsService(tenantId);
      const result = await visitsService.syncVisitsIncremental(lastDays);

      return reply.send({
        success: result.success,
        listingsProcessed: result.listingsProcessed,
        metricsCreated: result.metricsCreated,
        metricsUpdated: result.metricsUpdated,
        errors: result.errors,
        duration: result.duration,
      });
    } catch (error) {
      app.log.error({ err: error }, 'Failed to sync visits');
      return reply.status(500).send({
        error: 'Failed to sync visits',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // POST /api/v1/sync/mercadolivre/visits/backfill
  // Sincroniza visitas em backfill (últimos 30 dias)
  app.post('/sync/mercadolivre/visits/backfill', { preHandler: authGuard }, async (req, reply) => {
    try {
      const tenantId = (req as RequestWithAuth).tenantId;
      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { lastDays = 30, batchSize = 10, delayMs = 1000 } = req.body as {
        lastDays?: number;
        batchSize?: number;
        delayMs?: number;
      };

      const visitsService = new MercadoLivreVisitsService(tenantId);
      const result = await visitsService.syncVisitsBackfill(lastDays, batchSize, delayMs);

      return reply.send({
        success: result.success,
        listingsProcessed: result.listingsProcessed,
        metricsCreated: result.metricsCreated,
        metricsUpdated: result.metricsUpdated,
        errors: result.errors,
        duration: result.duration,
      });
    } catch (error) {
      app.log.error({ err: error }, 'Failed to backfill visits');
      return reply.status(500).send({
        error: 'Failed to backfill visits',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

    done();
};
