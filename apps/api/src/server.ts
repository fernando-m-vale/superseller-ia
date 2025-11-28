import fastify from 'fastify';
import cors from '@fastify/cors';

import { tenantPlugin } from './plugins/tenant';
import { authPlugin } from './plugins/auth';

import { authRoutes } from './routes/auth';
import { listingsRoutes } from './routes/listings';
import { actionsRoutes } from './routes/actions';
import { metricsRoutes } from './routes/metrics';

import { mercadolivreRoutes } from './routes/mercadolivre';
import { mercadoLivreWebhookRoutes } from './routes/mercado-livre-webhook';

import { shopeeRoutes } from './routes/shopee';

import { aiRoutes } from './routes/ai';
import { aiActionsRoutes } from './routes/ai-actions';
import { aiMetricsRoutes } from './routes/ai-metrics';

import { dataQualityRoutes } from './routes/data-quality';
import { jobsRoutes } from './routes/jobs';
import { automationRoutes } from './routes/automation';
import { outcomesRoutes } from './routes/outcomes';


// ---------------------------------------------------------
// Build do servidor Fastify
// ---------------------------------------------------------
export async function buildApp() {
  const app = fastify({
    logger: true,
  });

  // ---------------------------
  // Middlewares / Plugins
  // ---------------------------
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
  });

  await app.register(tenantPlugin);
  await app.register(authPlugin);

  // ---------------------------
  // Rotas principais (prefixo /api/v1)
  // ---------------------------
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(listingsRoutes, { prefix: '/api/v1' });
  await app.register(actionsRoutes, { prefix: '/api/v1' });
  await app.register(metricsRoutes, { prefix: '/api/v1' });

  await app.register(mercadolivreRoutes, { prefix: '/api/v1' }); // OAuth / Sync
  await app.register(shopeeRoutes, { prefix: '/api/v1' });

  await app.register(aiRoutes, { prefix: '/api/v1' });
  await app.register(aiActionsRoutes, { prefix: '/api/v1' });
  await app.register(aiMetricsRoutes, { prefix: '/api/v1' });

  await app.register(dataQualityRoutes, { prefix: '/api/v1' });
  await app.register(jobsRoutes, { prefix: '/api/v1' });
  await app.register(automationRoutes, { prefix: '/api/v1' });
  await app.register(outcomesRoutes, { prefix: '/api/v1' });

  // ---------------------------
  // Rotas sem prefixo
  // ---------------------------

  // Webhook do Mercado Livre (NOTIFICAÇÕES)
  await app.register(mercadoLivreWebhookRoutes); 
  // ⚠️ Não usa prefixo porque a rota já define path absoluto:
  // /api/v1/webhooks/mercadolivre

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // Health check com prefixo /api/v1 (para monitoramento e testes)
  app.get('/api/v1/health', async () => ({ status: 'ok' }));


  return app;
}


// ---------------------------------------------------------
// Inicialização da API
// ---------------------------------------------------------
buildApp()
  .then((app) => {
    const PORT = Number(process.env.PORT) || 3001;

    app.listen({ port: PORT, host: '0.0.0.0' })
      .then(() => {
        console.log(`API running on port ${PORT}`);
      })
      .catch((err) => {
        app.log.error(err);
        process.exit(1);
      });
  })
  .catch((err) => {
    console.error("Failed to start app:", err);
    process.exit(1);
  });
