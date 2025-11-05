# Super Seller IA — Arquitetura & Segurança (MVP→V1)

> Documento técnico com a visão de arquitetura, fluxos de dados, padrões de segurança/LGPD e desenho das APIs do MVP. Inclui esqueleto de rotas (Fastify + TypeScript + Zod) e contratos de dados.

---

## 1) Objetivos de Arquitetura
- **Escalável** e modular (conectores por marketplace)
- **Custo-eficiente** (serverless e jobs programados)
- **Segurança e LGPD** by design (mínimo necessário, criptografia, consentimento)
- **Observabilidade** (telemetria de produto + logs + métricas)
- **DX** boa: monorepo, CI, IaC, ambientes claros

---

## 2) Diagrama lógico (texto)
```
[Web (Next.js)]  ↔  [API (Fastify)]  ↔  [Core Services]
                                   ↙            ↘
                          [Connectors]         [Scoring/Actions]
                                 |                    |
                        [OAuth + SDKs]         [Rules + LLMs]
                                 |                    |
                      [Marketplaces APIs]       [Storage/DB]
                                 |                    |
                            [S3 Data Lake]  ← ETL → [Postgres (RDS)]
                                   ↑                        ↓
                           [Ingestion Jobs]          [Analytics/Telemetry]
```

**Principais componentes**
- **Web**: dashboard, action queue, relatórios
- **API**: autenticação, conectores, scores, actions
- **Connectors**: Shopee/ML — OAuth, coleta, aplicação de mudanças
- **Core**: cálculo do **Health Score** e **Action Engine**
- **Dados**: S3 (bruto), RDS Postgres (operacional), futuros jobs ETL (Step Functions/Airflow)
- **Observabilidade**: CloudWatch (logs/alarms), events para métricas de produto

---

## 3) Serviços AWS (MVP)
- **API**: ECS Fargate ou EC2 pequena (ou Lambda com Fastify adaptado)
- **Dados**: S3 (raw), RDS Postgres (operacional)
- **Jobs**: EventBridge Scheduler + Lambda (ingestão diária, recompute de scores)
- **Secrets**: AWS Secrets Manager (tokens OAuth, DB)
- **Auth**: Cognito (usuários da aplicação)
- **Observabilidade**: CloudWatch Logs/Metrics + Alarmes
- **IaC**: Terraform (módulos por recurso)

> V1: adicionar VPC privada, NAT, WAF, CloudFront, Redis (caching), Redshift/Databricks para análises, SageMaker ou ECS p/ serviços de ML.

---

## 4) Segurança & LGPD
### 4.1 Princípios
- **Minimização**: guardar só o necessário para executar as recomendações
- **Transparência**: termos e consentimento para cada conector
- **Criptografia**: em trânsito (TLS) e em repouso (S3 KMS, RDS AES-256)
- **Isolamento por tenant**: `tenant_id` em todas as tabelas e policies de acesso
- **Retention**: política (ex.: 18–24 meses para métricas agregadas)
- **Auditoria**: trilhas de ações (quem aprovou/aplicou o quê, quando)

### 4.2 Dados pessoais
- E-mail, nome e identificadores dos marketplaces → **dados pessoais**
- Não armazenar dados sensíveis
- Pseudonimização onde possível (IDs internos por tenant)

### 4.3 Controles
- **RBAC** (roles: owner, manager, operator)
- **MFA** via Cognito
- **Secrets Manager** para tokens/keys
- **Backups** RDS (automáticos diários)
- **DPIA** simplificado no MVP (anexo futuro)

---

## 5) Modelo de Dados (operacional — v1)
**Tabelas principais**
- `tenants (id, name, created_at)`
- `users (id, tenant_id, email, role, created_at)`
- `marketplace_connections (id, tenant_id, type, access_token, refresh_token, expires_at, status)`
- `listings (id, tenant_id, marketplace, listing_id_ext, title, price, stock, status, category, updated_at)`
- `listing_metrics_daily (id, tenant_id, listing_id, date, impressions, clicks, ctr, visits, conversion, orders, gmv)`
- `health_scores (id, tenant_id, listing_id, score, components_json, computed_at)`
- `actions (id, tenant_id, listing_id, type, payload_json, status, created_at, approved_at, applied_at)`
- `action_effects (id, action_id, window_days, metric, before, after, delta)`
- `events (id, tenant_id, type, payload_json, created_at)`

---

## 6) APIs (Fastify + Zod) — Contratos MVP
**Prefixo**: `/api/v1`

### 6.1 Auth & Tenancy
- `POST /auth/signup` — cria usuário (Cognito) e tenant
- `POST /auth/login` — login → token de sessão (ou delegar ao Cognito Hosted UI)

### 6.2 Connectors
- `GET /connectors` — status das conexões
- `POST /connectors/shopee/oauth/start` — inicia OAuth
- `POST /connectors/shopee/oauth/callback` — callback OAuth
- (idem para Mercado Livre)

### 6.3 Listings & Métricas
- `GET /listings` — lista com filtros (marketplace, score range, categoria)
- `GET /listings/:id/metrics?from=&to=` — série temporal

### 6.4 Scores
- `POST /scores/recompute` — agenda recompute para um tenant
- `GET /scores/:listingId` — score + componentes

### 6.5 Actions (aprovação/aplicação)
- `GET /actions/recommendations?listingId=` — recomendações
- `POST /actions/:id/approve` — aprova
- `POST /actions/:id/apply` — aplica (via API conector ou fluxo manual)
- `GET /actions/:id/effect` — métrica pré vs pós

### 6.6 Reports & Alerts
- `GET /reports/daily` — resumo do dia
- `GET /alerts` — eventos críticos

---

## 7) Esqueleto de rotas (TypeScript)
> Coloque estes arquivos em `apps/api/src/`.

### 7.1 Schemas com Zod — `schemas.ts`
```ts
import { z } from 'zod';

export const ListingFilterSchema = z.object({
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
  scoreMin: z.coerce.number().min(0).max(100).optional(),
  scoreMax: z.coerce.number().min(0).max(100).optional(),
  q: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(200).default(20),
});

export const ActionApproveSchema = z.object({ id: z.string().uuid() });
export const DateRangeSchema = z.object({ from: z.string().optional(), to: z.string().optional() });
```

### 7.2 Plugin de contexto/tenant — `plugins/tenant.ts`
```ts
import { FastifyPluginCallback } from 'fastify';

export const tenantPlugin: FastifyPluginCallback = (app, _, done) => {
  app.addHook('preHandler', async (req) => {
    // TODO: extrair tenant do token/jwt ou header (x-tenant)
    (req as any).tenantId = 'demo-tenant';
  });
  done();
};
```

### 7.3 Rotas — `routes/listings.ts`
```ts
import { FastifyPluginCallback } from 'fastify';
import { ListingFilterSchema } from '../schemas';

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/listings', { schema: { querystring: ListingFilterSchema } }, async (req) => {
    const q = ListingFilterSchema.parse(req.query);
    // TODO: buscar em Postgres usando q + (req as any).tenantId
    return { items: [], total: 0, page: q.page, pageSize: q.pageSize };
  });

  app.get('/listings/:id/metrics', async (req) => {
    // TODO: retornar série temporal para o listing
    return { series: [] };
  });

  done();
};
```

### 7.4 Rotas — `routes/actions.ts`
```ts
import { FastifyPluginCallback } from 'fastify';
import { ActionApproveSchema } from '../schemas';

export const actionsRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/actions/recommendations', async () => {
    // TODO: usar motor de recomendações
    return { items: [] };
  });

  app.post('/actions/:id/approve', async (req) => {
    const { id } = req.params as { id: string };
    ActionApproveSchema.parse({ id });
    // TODO: mudar status → approved
    return { ok: true };
  });

  app.post('/actions/:id/apply', async (req) => {
    const { id } = req.params as { id: string };
    // TODO: chamar conector; registrar histórico
    return { ok: true };
  });

  done();
};
```

### 7.5 Bootstrap do servidor — `server.ts`
```ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { tenantPlugin } from './plugins/tenant';
import { listingsRoutes } from './routes/listings';
import { actionsRoutes } from './routes/actions';

const app = Fastify({ logger: true });
app.register(cors, { origin: true });
app.register(tenantPlugin);
app.register(listingsRoutes, { prefix: '/api/v1' });
app.register(actionsRoutes, { prefix: '/api/v1' });

app.get('/health', async () => ({ status: 'ok' }));

app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
  .then(() => console.log('API running on :3001'))
  .catch((e) => { app.log.error(e); process.exit(1); });
```

---

## 8) Estratégia de Jobs (ingestão e scores)
- **Ingestão diária** (por conector): EventBridge → Lambda → salva RAW (S3) → publica evento → ETL (normaliza em Postgres)
- **Recompute Score**: job a cada manhã + on-demand por tenant
- **Resiliência**: retries exponenciais, DLQ, idempotência

---

## 9) Observabilidade
- **Logs estruturados** (json) + correlação por `tenant_id`
- **Métricas de produto**: eventos (conectar, ação aprovada, ação aplicada, relatório enviado)
- **Alarmes**: falha em ingestão, aumento de latência, taxa de erro > 2%

---

## 10) Roadmap técnico (MVP → V1)
- MVP: conectores Shopee/ML + scores + ações + execução assistida
- V1: A/B testing, Ads optimizer, Pricing v1, Reputation mining, API pública

---

## 11) Checklists de Segurança (MVP)
- [ ] TLS forçado
- [ ] Secrets no AWS SM, nunca em env plano
- [ ] Tokens OAuth com escopo mínimo e refresh
- [ ] Backups e restauração testados
- [ ] RBAC aplicado na API
- [ ] Logs sem dados pessoais sensíveis

---

## 12) Anexos futuros
- Diagramas C4/PlantUML
- DPIA detalhado
- Política de retenção e descarte
- Guia de resposta a incidentes

