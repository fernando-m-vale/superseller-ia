import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { getMercadoLivreCredentials } from '../lib/secrets';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

// URLs Corretas
const ML_AUTH_BASE = 'https://auth.mercadolivre.com.br';
const ML_API_BASE = 'https://api.mercadolibre.com';

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
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to initiate Mercado Livre connection' });
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
          app.log.warn('Failed to fetch ML user info, token may be expired:', apiError);
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
        app.log.error(error);
        return reply.status(500).send({ error: 'Failed to check Mercado Livre health' });
      }
    });

    // Rota de Callback
    app.get('/callback', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { code, state } = req.query as { code: string; state: string };
      
      if (!code) return reply.status(400).send({ error: 'No code provided' });

      let decodedState;
      try {
        const jsonState = Buffer.from(state, 'base64').toString('utf-8');
        decodedState = JSON.parse(jsonState);
      } catch (e) {
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      const { tenantId } = decodedState;

      const credentials = await getMercadoLivreCredentials();
      
      const tokenResponse = await axios.post(
        `${ML_API_BASE}/oauth/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          code: code,
          redirect_uri: credentials.redirectUri,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, refresh_token, expires_in, user_id: mlUserId } = tokenResponse.data;
      const providerAccountId = String(mlUserId);

      const existingConnection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: Marketplace.mercadolivre, 
          provider_account_id: providerAccountId,
        },
      });

      if (existingConnection) {
        await prisma.marketplaceConnection.update({
          where: { id: existingConnection.id },
          data: {
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: new Date(Date.now() + expires_in * 1000),
            status: ConnectionStatus.active, 
          },
        });
      } else {
        await prisma.marketplaceConnection.create({
          data: {
            tenant_id: tenantId,
            type: Marketplace.mercadolivre, 
            provider_account_id: providerAccountId,
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: new Date(Date.now() + expires_in * 1000),
            status: ConnectionStatus.active, 
          },
        });
      }

      // Redirecionar para /overview após login bem-sucedido
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.superselleria.com.br';
      return reply.redirect(`${appUrl}/overview?success=true`);

    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to complete Mercado Livre connection', details: String(error) });
    }
  });

  done();
};
