import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { getMercadoLivreCredentials } from '../lib/secrets';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

// ✅ URL CORRETA para Login (Tela Amarela do Brasil)
const ML_AUTH_BASE = 'https://auth.mercadolivre.com.br';
// ✅ URL CORRETA para APIs de Dados (Troca de Token, Produtos, etc)
const ML_API_BASE = 'https://api.mercadolibre.com';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

export const mercadolivreRoutes: FastifyPluginCallback = (app, _, done) => {
  
  // Rota de Conexão: /api/v1/auth/mercadolivre/connect
  app.get('/auth/mercadolivre/connect', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const credentials = await getMercadoLivreCredentials();
      
      const state = crypto.randomBytes(16).toString('hex');
      const stateData = JSON.stringify({ tenantId, userId, nonce: state });
      const encodedState = Buffer.from(stateData).toString('base64');

      const authUrl = new URL(`${ML_AUTH_BASE}/authorization`);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', credentials.clientId);
      authUrl.searchParams.append('redirect_uri', credentials.redirectUri);
      authUrl.searchParams.append('state', encodedState);
      
      return reply.redirect(authUrl.toString());
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to initiate Mercado Livre connection' });
    }
  });

  // Rota de Callback: /api/v1/auth/mercadolivre/callback
  app.get('/auth/mercadolivre/callback', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { code, state } = req.query as { code: string; state: string };
      
      if (!code) {
        return reply.status(400).send({ error: 'No code provided' });
      }

      let decodedState;
      try {
        const jsonState = Buffer.from(state, 'base64').toString('utf-8');
        decodedState = JSON.parse(jsonState);
      } catch (e) {
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      const { tenantId, userId } = decodedState;

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
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token, refresh_token, expires_in, user_id: mlUserId } = tokenResponse.data;
      const providerAccountId = String(mlUserId);

      // ✅ CORREÇÃO AQUI: Usando nomes de campos em snake_case para bater com o Schema do Banco
      const existingConnection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,          // Era tenantId -> virou tenant_id
          provider: 'MERCADOLIVRE', 
          provider_account_id: providerAccountId, // Era providerAccountId -> virou provider_account_id
        },
      });

      if (existingConnection) {
        await prisma.marketplaceConnection.update({
          where: { id: existingConnection.id },
          data: {
            access_token: access_token,   // Era accessToken -> virou access_token
            refresh_token: refresh_token, // Era refreshToken -> virou refresh_token
            expires_at: new Date(Date.now() + expires_in * 1000), // Era expiresAt -> virou expires_at
            status: 'active',
          },
        });
      } else {
        await prisma.marketplaceConnection.create({
          data: {
            tenant_id: tenantId,          // Era tenantId -> virou tenant_id
            provider: 'MERCADOLIVRE',
            provider_account_id: providerAccountId, // Era providerAccountId -> virou provider_account_id
            access_token: access_token,   // Era accessToken -> virou access_token
            refresh_token: refresh_token, // Era refreshToken -> virou refresh_token
            expires_at: new Date(Date.now() + expires_in * 1000), // Era expiresAt -> virou expires_at
            status: 'active',
          },
        });
      }

      // 4. Sucesso! Redireciona para o Dashboard
      // Ajuste o domínio conforme a propagação do seu DNS (ou use o do App Runner)
      return reply.redirect('https://app.superselleria.com.br/dashboard?success=true');

    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to complete Mercado Livre connection', details: String(error) });
    }
  });

  done();
};