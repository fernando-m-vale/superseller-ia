import { fastify } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { authRoutes } from './routes/auth';
import { mercadolivreRoutes } from './routes/mercadolivre';
import { webhookRoutes } from './routes/mercado-livre-webhook';
import { metricsRoutes } from './routes/metrics';
import { syncRoutes } from './routes/sync.routes';

const app = fastify();

app.register(cors, {
  origin: '*',
});

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

async function main() {
  console.log('--- [DEBUG] Server Starting ---');

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  
  await app.register(mercadolivreRoutes, { prefix: '/api/v1/auth/mercadolivre' });
  
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  
  await app.register(metricsRoutes, { prefix: '/api/v1/metrics' });
  
  await app.register(syncRoutes, { prefix: '/api/v1/sync' });

  try {
    await app.ready();
    
    console.log('\n--- ROUTE MAP (VERIFICATION) ---');
    console.log(app.printRoutes());
    console.log('-------------------------------------------\n');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`HTTP Server running on port ${env.PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
