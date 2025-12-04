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

// Health check da API (o Health Check raiz do app)
app.get('/api/v1/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

async function main() {
  console.log('--- [DEBUG] Server Starting - Version FINAL ROUTE FIX ---'); 

  // 1. Registro das rotas
  // CORREÇÃO CRÍTICA: Adicionar a barra inicial '/' em todos os prefixos
  
  // Rotas de Auth
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  
  // Rotas do Mercado Livre (Contém /connect e /callback)
  await app.register(mercadolivreRoutes, { prefix: '/api/v1/auth/mercadolivre' });
  
  // Rotas de Webhook
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  try {
    await app.ready(); // Espera todos os plugins carregarem
    
    // DEBUG: Imprime as rotas para validar em 100% (Veremos no log do App Runner)
    console.log('\n--- 🗺️  ROTA MAP (VERIFICAÇÃO) ---');
    console.log(app.printRoutes());
    console.log('-------------------------------------------\n');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 HTTP Server running on port ${env.PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();