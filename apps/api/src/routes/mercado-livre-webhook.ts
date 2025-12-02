import { FastifyInstance } from 'fastify';

// CORREÇÃO: O nome da função exportada DEVE ser 'webhookRoutes' para bater com o server.ts
export async function webhookRoutes(app: FastifyInstance) {
  
  // Rota que recebe as notificações do Mercado Livre
  // O prefixo '/api/v1/webhooks' já foi definido no server.ts
  app.post('/mercadolivre', async (request, reply) => {
    console.log('🔔 Webhook Mercado Livre Recebido:', request.body);

    // O Mercado Livre espera um 200 OK rápido para não reenviar a notificação
    return reply.status(200).send();
  });
}