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
  // O prefixo /api/v1 vem do server.ts
  app.get('/auth/mercadolivre/connect', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // 1. Busca credenciais seguras na AWS
      const credentials = await getMercadoLivreCredentials();
      
      // 2. Gera state de segurança para identificar o usuário na volta
      const state = crypto.randomBytes(16).toString('hex');
      const stateData = JSON.stringify({ tenantId, userId, nonce: state });
      const encodedState = Buffer.from(stateData).toString('base64');

      // 3. Monta a URL de Login usando o domínio BRASILEIRO (auth.mercadolivre.com.br)
      const authUrl = new URL(`${ML_AUTH_BASE}/authorization`);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', credentials.clientId);
      authUrl.searchParams.append('redirect_uri', credentials.redirectUri);
      authUrl.searchParams.append('state', encodedState);
      
      console.log('--- [DEBUG] Iniciando Auth ML ---');
      console.log('URL:', authUrl.toString());

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

      // 1. Decodifica o state para saber quem é o usuário
      let decodedState;
      try {
        const jsonState = Buffer.from(state, 'base64').toString('utf-8');
        decodedState = JSON.parse(jsonState);
      } catch (e) {
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      const { tenantId, userId } = decodedState;

      // 2. Troca o Code pelo Token (Aqui usamos a API global api.mercadolibre.com)
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
      
      // 3. Salva a conexão no Banco de Dados
      await prisma.marketplaceConnection.upsert({
        where: {
          tenantId_provider_providerAccountId: {
            tenantId,
            provider: 'MERCADOLIVRE',
            providerAccountId: String(mlUserId),
          },
        },
        update: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: new Date(Date.now() + expires_in * 1000),
          status: 'ACTIVE',
        },
        create: {
          tenantId,
          provider: 'MERCADOLIVRE',
          providerAccountId: String(mlUserId),
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: new Date(Date.now() + expires_in * 1000),
          status: 'ACTIVE',
        },
      });

      // 4. Sucesso! Redireciona para o Dashboard
      // Ajuste o domínio abaixo se o seu DNS já tiver propagado, senão use a URL do App Runner
      return reply.redirect('https://app.superselleria.com.br/dashboard?success=true');

    } catch (error) {
      app.log.error(error);
      // Retorna JSON em caso de erro crítico para podermos debugar
      return reply.status(500).send({ error: 'Failed to complete Mercado Livre connection', details: String(error) });
    }
  });

  done();
};