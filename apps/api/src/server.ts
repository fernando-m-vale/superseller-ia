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
import { aiDebugRoutes } from './routes/ai-debug.routes';
import { debugRoutes } from './routes/debug.routes';
import { internalJobsRoutes } from './routes/internal-jobs.routes';
import { internalDebugRoutes } from './routes/internal-debug.routes';
import { metaRoutes } from './routes/meta.routes';
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
    // Registrar meta primeiro (sem conflito)
    await app.register(metaRoutes, { prefix: '/api/v1' });
    
    // Registrar rotas de AI - ordem importante: debug antes de analyze para evitar conflitos
    await app.register(aiDebugRoutes, { prefix: '/api/v1/ai' });
    await app.register(aiAnalyzeRoutes, { prefix: '/api/v1/ai' });
    await app.register(debugRoutes, { prefix: '/api/v1/debug' });
    await app.register(internalJobsRoutes, { prefix: '/api/v1/jobs' });
    await app.register(internalDebugRoutes, { prefix: '/api/v1/internal/debug' });

    await app.ready();
    
    // Log de rotas registradas (sempre logar em produção para debug)
    const routes = app.printRoutes();
    app.log.info({ 
      totalRoutes: routes.split('\n').filter(line => line.trim().length > 0).length,
      hasForceRefresh: routes.includes('force-refresh'),
      hasDebugPayload: routes.includes('debug-payload'),
      hasMeta: routes.includes('/meta'),
    }, 'Routes registered');
    
    // Log detalhado apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      app.log.debug({ routes }, 'Routes registered (detailed)');
    }

    // DB Fingerprint: identificar qual DB a API está usando
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const dbFingerprint = await prisma.$queryRaw<Array<{ current_database: string | null; inet_server_addr: string | null; inet_server_port: number | null }>>`
        SELECT current_database() as current_database, inet_server_addr() as inet_server_addr, inet_server_port() as inet_server_port
      `;
      
      if (dbFingerprint.length > 0) {
        const fp = dbFingerprint[0];
        app.log.info({
          dbFingerprint: {
            database: fp.current_database,
            serverAddr: fp.inet_server_addr,
            serverPort: fp.inet_server_port,
          },
        }, 'DB Fingerprint: API conectada ao banco');
      }
      
      await prisma.$disconnect();
    } catch (err) {
      app.log.warn({ err }, 'Erro ao obter DB fingerprint (não crítico)');
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
