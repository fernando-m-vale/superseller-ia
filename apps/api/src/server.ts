import Fastify from 'fastify';
import cors from '@fastify/cors';
import { tenantPlugin } from './plugins/tenant';
import { listingsRoutes } from './routes/listings';
import { actionsRoutes } from './routes/actions';
import { metricsRoutes } from './routes/metrics';
import { mercadolivreRoutes } from './routes/mercadolivre';


const app = Fastify({ logger: true });


app.register(cors, { origin: process.env.CORS_ORIGIN || true });
app.register(tenantPlugin);
app.register(listingsRoutes, { prefix: '/api/v1' });
app.register(actionsRoutes, { prefix: '/api/v1' });
app.register(metricsRoutes, { prefix: '/api/v1' });
app.register(mercadolivreRoutes, { prefix: '/api/v1' });


app.get('/health', async () => ({ status: 'ok' }));


app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
.then(() => console.log('API running on :3001'))
.catch((e) => { app.log.error(e); process.exit(1); });
