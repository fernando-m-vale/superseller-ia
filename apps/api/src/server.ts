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
import { TokenRefreshService } from './services/TokenRefreshService';

const app = fastify({ logger: true });

app.register(cors, { origin: '*' });

// ✅ CORREÇÃO CRÍTICA: Rota '/health' na raiz para o AWS App Runner
app.get('/health', async () => ({ status: 'ok' }));

// Rota de monitoramento padrão da API
app.get('/api/v1/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

/**
 * Cron job para refresh proativo de tokens do Mercado Livre
 * Executa a cada hora
 */
function scheduleTokenRefresh() {
  console.log('[TOKEN-REFRESH] Agendando refresh proativo de tokens (executa a cada hora)...');
  
  // Executar imediatamente na inicialização
  TokenRefreshService.refreshExpiringTokens().catch((err: unknown) => {
    console.error('[TOKEN-REFRESH] Erro no refresh inicial:', err);
  });

  // Executar a cada hora (3600000 ms)
  setInterval(() => {
    console.log('[TOKEN-REFRESH] Executando refresh proativo de tokens...');
    TokenRefreshService.refreshExpiringTokens().catch((err: unknown) => {
      console.error('[TOKEN-REFRESH] Erro no refresh agendado:', err);
    });
  }, 60 * 60 * 1000); // 1 hora
}

async function main() {
  try {
    console.log('--- [DEBUG] Server Starting ---');

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

    await app.ready();
    console.log('\n--- 🗺️  ROTA MAP ---');
    console.log(app.printRoutes());
    console.log('-------------------\n');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 HTTP Server running on port ${env.PORT}`);

    // Iniciar cron job de refresh proativo de tokens (executa a cada hora)
    scheduleTokenRefresh();
  } catch (err) {
    console.error('FATAL ERROR STARTING SERVER:', err);
    process.exit(1);
  }
}

main();
