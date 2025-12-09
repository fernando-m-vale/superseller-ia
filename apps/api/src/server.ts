import { fastify } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { authRoutes } from './routes/auth';
import { mercadolivreRoutes } from './routes/mercadolivre';
import { webhookRoutes } from './routes/mercado-livre-webhook';
import { metricsRoutes } from './routes/metrics';
import { listingsRoutes } from './routes/listings'; // Importe aqui

const app = fastify({ logger: true }); // Logger true ajuda no debug

app.register(cors, { origin: '*' });

app.get('/api/v1/health', async () => ({ status: 'ok' }));

async function main() {
  try {
    console.log('--- [DEBUG] Server Starting ---');

    // ✅ REGISTRO DE ROTAS COM BARRA INICIAL (CRÍTICO PARA FASTIFY)
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.register(mercadolivreRoutes, { prefix: '/api/v1/auth/mercadolivre' });
    await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
    
    // Novas rotas de dados
    await app.register(metricsRoutes, { prefix: '/api/v1/metrics' });
    await app.register(listingsRoutes, { prefix: '/api/v1/listings' });

    await app.ready();
    console.log('\n--- 🗺️  ROTA MAP (VERIFICAÇÃO) ---');
    console.log(app.printRoutes());
    console.log('-----------------------------------\n');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 HTTP Server running on port ${env.PORT}`);
  } catch (err) {
    console.error('FATAL ERROR STARTING SERVER:', err);
    process.exit(1);
  }
}

main();