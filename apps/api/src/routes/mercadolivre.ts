import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '@/config/env';

export async function mercadoLivreRoutes(app: FastifyInstance) {
  // Rota para iniciar a conexão (Redireciona para o ML)
  app.get('/connect', async (request, reply) => {
    const { ML_APP_ID, ML_REDIRECT_URI } = env;

    // CORREÇÃO: Usar o domínio de autenticação do Brasil (auth.mercadolivre.com.br)
    // Em vez de api.mercadolibre.com que retorna "Resource not found"
    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_APP_ID}&redirect_uri=${ML_REDIRECT_URI}`;

    return reply.redirect(authUrl);
  });

  // Rota de Callback (Onde o ML retorna com o código)
  app.get('/callback', async (request, reply) => {
    const querySchema = z.object({
      code: z.string(),
    });

    const { code } = querySchema.parse(request.query);

    // Aqui você chamaria o serviço para trocar o Code pelo Token
    // Exemplo: await registerMercadoLivreToken(request.user.tenantId, code);

    return reply.send({ message: 'Conexão realizada com sucesso!', code });
  });
}