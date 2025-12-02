import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { getMercadoLivreCredentials } from '../lib/secrets';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

// CORREÇÃO: URL específica para Autenticação (Brasil)
const ML_AUTH_BASE = 'https://auth.mercadolivre.com.br';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

export const mercadolivreRoutes: FastifyPluginCallback = (app, _, done) => {
  // Ajustei a rota para '/connect' para padronizar com o frontend
  // A rota final será: /api/v1/auth/mercadolivre/connect
  app.get('/auth/mercadolivre/connect', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Busca credenciais do Secrets Manager
      const credentials = await getMercadoLivreCredentials();
      
      // Gera estado para segurança (CSRF)
      const state = crypto.randomBytes(16).toString('hex');
      const stateData = JSON.stringify({ tenantId, userId, nonce: state });
      const encodedState = Buffer.from(stateData).toString('base64');

      // CONSTRUÇÃO DA URL CORRETA
      // Usando auth.mercadolivre.com.br em vez de api.mercadolibre.com
      const authUrl = new URL(`${ML_AUTH_BASE}/authorization`);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', credentials.clientId);
      authUrl.searchParams.append('redirect_uri', credentials.redirectUri);
      authUrl.searchParams.append('state', encodedState);

      // --- DEBUG LOG (Para validarmos no App Runner) ---
      console.log('--- [DEBUG] ML CONNECT ---');
      console.log('Client ID:', credentials.clientId);
      console.log('Redirect URI:', credentials.redirectUri);
      console.log('Final URL:', authUrl.toString());
      console.log('--------------------------');

      // Redireciona o usuário para o Mercado Livre
      return reply.redirect(authUrl.toString());

    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to initiate Mercado Livre connection' });
    }
  });

  // Rota de Callback (Onde o ML devolve o usuário)
  app.get('/auth/mercadolivre/callback', async (req: FastifyRequest, reply: FastifyReply) => {
     // ... (Mantenha a lógica de callback ou implementaremos depois se falhar)
     // Por enquanto, vou deixar um retorno simples para testarmos a chegada aqui
     const { code } = req.query as { code: string };
     return reply.send({ message: 'Callback recebido com sucesso! O código é: ' + code });
  });

  done();
};