import Fastify from 'fastify';
import cors from '@fastify/cors';
import { tenantPlugin } from './plugins/tenant';
import { authPlugin } from './plugins/auth';
import { authRoutes } from './routes/auth';
import { listingsRoutes } from './routes/listings';
import { actionsRoutes } from './routes/actions';
import { metricsRoutes } from './routes/metrics';
import { shopeeRoutes } from './routes/shopee';


const app = Fastify({ logger: true });


app.register(cors, { origin: process.env.CORS_ORIGIN || true });
app.register(tenantPlugin);
app.register(authPlugin);
app.register(authRoutes, { prefix: '/api/v1' });
app.register(listingsRoutes, { prefix: '/api/v1' });
app.register(actionsRoutes, { prefix: '/api/v1' });
app.register(metricsRoutes, { prefix: '/api/v1' });
app.register(shopeeRoutes, { prefix: '/api/v1' });


app.get('/health', async () => ({ status: 'ok' }));


app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
.then(() => console.log('API running on :3001'))
.catch((e) => { app.log.error(e); process.exit(1); });
