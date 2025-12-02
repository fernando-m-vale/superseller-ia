import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// CORREÇÃO 1: Usando caminho relativo para garantir que o build encontre o arquivo
import { env } from '../config/env';

// CORREÇÃO 2: Nome da função ajustado para 'mercadolivreRoutes' (minúsculo) para bater com o server.ts
export async function mercadolivreRoutes(app: FastifyInstance) {
  // Rota para iniciar a conexão (Redireciona para o ML)
  app.get('/connect', async (request, reply) => {
    const { ML_APP_ID, ML_REDIRECT_URI } = env;

    // URL correta de autenticação do Brasil
    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_APP_ID}&redirect_uri=${ML_REDIRECT_URI}`;

    return reply.redirect(authUrl);
  });

  // Rota de Callback (Onde o ML retorna com o código)
  app.get('/callback', async (request, reply) => {
    const querySchema = z.object({
      code: z.string(),
    });

    const { code } = querySchema.parse(request.query);

    // Aqui futuramente faremos a troca do token
    return reply.send({ message: 'Conexão realizada com sucesso!', code });
  });
}