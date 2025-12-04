import { fastify } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { authRoutes } from './routes/auth';
import { mercadolivreRoutes } from './routes/mercadolivre';
import { webhookRoutes } from './routes/mercado-livre-webhook';

const app = fastify({
  logger: true, // Garante logs detalhados
});

app.register(cors, {
  origin: '*', 
});

// Health check da API (Com barra inicial correta)
app.get('/api/v1/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

async function main() {
  console.log('--- [DEBUG] Server Starting - Version Route Fix 3.0 ---');

  // CORREÇÃO: Adicionada a barra '/' no início de todos os prefixos
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  
  // A rota crítica:
  await app.register(mercadolivreRoutes, { prefix: '/api/v1/auth/mercadolivre' });
  
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  try {
    await app.ready(); // Espera todos os plugins carregarem
    
    // 🕵️‍♂️ O "Dedo-Duro": Mostra todas as rotas registradas no console
    console.log('\n--- 🗺️  ROTA MAP (Check se sua rota está aqui) ---');
    console.log(app.printRoutes());
    console.log('---------------------------------------------------\n');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 HTTP Server running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();