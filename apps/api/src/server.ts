import { fastify } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { authRoutes } from './routes/auth';
import { mercadolivreRoutes } from './routes/mercadolivre';
import { webhookRoutes } from './routes/mercado-livre-webhook';
import { metricsRoutes } from './routes/metrics';
import { listingsRoutes } from './routes/listings';
import { syncRoutes } from './routes/sync.routes';
import { recommendationsRoutes } from './routes/recommendations.routes';
import { aiAnalyzeRoutes } from './routes/ai-analyze.routes';
import { debugRoutes } from './routes/debug.routes';
import { TokenRefreshService } from './services/TokenRefreshService';
import { loggerConfig } from './utils/logger-config';
import { requestIdPlugin } from './plugins/request-id';

const app = fastify({ logger: loggerConfig });

app.register(cors, { origin: '*' });
// Registrar plugin de requestId antes de outras rotas
app.register(requestIdPlugin);

// ✅ CORREÇÃO CRÍTICA: Rota '/health' na raiz para o AWS App Runner
app.get('/health', async () => ({ status: 'ok' }));

// Rota de monitoramento padrão da API
app.get('/api/v1/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

/**
 * Cron job para refresh proativo de tokens do Mercado Livre
 * Executa a cada hora
 */
function scheduleTokenRefresh() {
  app.log.info('Scheduling proactive token refresh (runs every hour)');
  
  // Executar imediatamente na inicialização
  TokenRefreshService.refreshExpiringTokens().catch((err: unknown) => {
    app.log.error({ err }, 'Error in initial token refresh');
  });

  // Executar a cada hora (3600000 ms)
  setInterval(() => {
    app.log.debug('Executing scheduled token refresh');
    TokenRefreshService.refreshExpiringTokens().catch((err: unknown) => {
      app.log.error({ err }, 'Error in scheduled token refresh');
    });
  }, 60 * 60 * 1000); // 1 hora
}

async function main() {
  try {
    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      app.log.debug('Server starting...');
    }

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(mercadolivreRoutes, { prefix: '/api/v1/auth/mercadolivre' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
    await app.register(metricsRoutes, { prefix: '/api/v1/metrics' });
    await app.register(listingsRoutes, { prefix: '/api/v1/listings' });
    // Alias /api/v1/ads -> /api/v1/listings (compatibilidade com frontend)
    await app.register(listingsRoutes, { prefix: '/api/v1/ads' });
    await app.register(syncRoutes, { prefix: '/api/v1/sync' });
    await app.register(recommendationsRoutes, { prefix: '/api/v1/recommendations' });
    await app.register(aiAnalyzeRoutes, { prefix: '/api/v1/ai' });
    await app.register(debugRoutes, { prefix: '/api/v1/debug' });

    await app.ready();
    
    // Log de rotas apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      app.log.debug({ routes: app.printRoutes() }, 'Routes registered');
    }

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info({ port: env.PORT }, 'HTTP Server running');

    // Iniciar cron job de refresh proativo de tokens (executa a cada hora)
    scheduleTokenRefresh();
  } catch (err) {
    app.log.fatal({ err }, 'FATAL ERROR STARTING SERVER');
    process.exit(1);
  }
}

main();
