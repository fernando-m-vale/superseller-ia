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
  
  // ✅ Rota: /api/v1/auth/mercadolivre/authorize
  // Retorna a URL de autenticação como JSON para o frontend redirecionar
  app.get('/authorize', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
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
      
      // Retorna JSON para o frontend redirecionar
      return reply.send({ authUrl: authUrl.toString() });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to initiate Mercado Livre connection' });
    }
  });

  // ✅ Rota Ajustada: Apenas '/callback'
  // Rota Final: /api/v1/auth/mercadolivre/callback
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

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      const existingConnection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: Marketplace.mercadolivre, 
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
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: new Date(Date.now() + expires_in * 1000),
            status: ConnectionStatus.active, 
          },
        });
      }

      return reply.redirect('https://app.superselleria.com.br/dashboard?success=true');

    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to complete Mercado Livre connection', details: String(error) });
    }
  });

  done();
};