import Fastify from 'fastify';
import cors from '@fastify/cors';
import { tenantPlugin } from './plugins/tenant';
import { authPlugin } from './plugins/auth';
import { authRoutes } from './routes/auth';
import { listingsRoutes } from './routes/listings';
import { actionsRoutes } from './routes/actions';
import { metricsRoutes } from './routes/metrics';
import { mercadolivreRoutes } from './routes/mercadolivre';
import { shopeeRoutes } from './routes/shopee';
import { aiRoutes } from './routes/ai';
import { aiActionsRoutes } from './routes/ai-actions';
import { dataQualityRoutes } from './routes/data-quality';
import { jobsRoutes } from './routes/jobs';
import { automationRoutes } from './routes/automation';
import { outcomesRoutes } from './routes/outcomes';


const app = Fastify({ logger: true });


app.register(cors, { origin: process.env.CORS_ORIGIN || true });
app.register(tenantPlugin);
app.register(authPlugin);
app.register(authRoutes, { prefix: '/api/v1' });
app.register(listingsRoutes, { prefix: '/api/v1' });
app.register(actionsRoutes, { prefix: '/api/v1' });
app.register(metricsRoutes, { prefix: '/api/v1' });
app.register(mercadolivreRoutes, { prefix: '/api/v1' });
app.register(shopeeRoutes, { prefix: '/api/v1' });
app.register(aiRoutes, { prefix: '/api/v1' });
app.register(aiActionsRoutes, { prefix: '/api/v1' });
app.register(dataQualityRoutes, { prefix: '/api/v1' });
app.register(jobsRoutes, { prefix: '/api/v1' });
app.register(automationRoutes, { prefix: '/api/v1' });
app.register(outcomesRoutes, { prefix: '/api/v1' });


app.get('/health', async () => ({ status: 'ok' }));


app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
.then(() => console.log('API running on :3001'))
.catch((e) => { app.log.error(e); process.exit(1); });
