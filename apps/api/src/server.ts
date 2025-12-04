import { fastify } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { authRoutes } from './routes/auth';
import { mercadolivreRoutes } from './routes/mercadolivre';
import { webhookRoutes } from './routes/mercado-livre-webhook';

const app = fastify();

app.register(cors, {
  origin: '*', // Em produção, mude para o domínio do front
});

// Health check da API
app.get('/api/v1/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

async function main() {
  console.log('--- [DEBUG] Server Starting - Version ML Fix 2.0 ---'); // Adicione isso

  // Registro das rotas
  app.register(authRoutes, { prefix: 'api/v1/auth' });
  
  // CORREÇÃO AQUI: Adicionado '/auth' ao prefixo para bater com a URL de Callback
  app.register(mercadolivreRoutes, { prefix: 'api/v1/auth/mercadolivre' });
  
  app.register(webhookRoutes, { prefix: 'api/v1/webhooks' });

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 HTTP Server running on port ${env.PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();