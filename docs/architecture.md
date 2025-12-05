Super Seller IA — Arquitetura & Segurança (MVP→V1)

Documento técnico com a visão de arquitetura, fluxos de dados, padrões de segurança/LGPD e desenho das APIs do MVP. Inclui esqueleto de rotas (Fastify + TypeScript + Zod) e contratos de dados.

1) Objetivos de Arquitetura

Escalável e modular (conectores por marketplace)

Custo-eficiente (App Runner com scale-to-zero e NAT Gateway sob demanda)

Segurança e LGPD by design (mínimo necessário, criptografia, consentimento)

Observabilidade (telemetria de produto + logs + métricas)

DX boa: monorepo, CI/CD Automatizado, IaC (Terraform)

2) Diagrama lógico (texto)

[Web (Next.js)]  ↔  [API (Fastify)]  ↔  [Core Services]
                                   ↙            ↘
                          [Connectors]         [Scoring/Actions]
                                 |                    |
                        [OAuth + SDKs]         [Rules + LLMs]
                                 |                    |
                      [Marketplaces APIs]       [Storage/DB]
                                 |                    |
                            [S3 Data Lake]  ← ETL → [Postgres (RDS)]
                                   ↑                        ↓
                           [Ingestion Jobs]          [Analytics/Telemetry]


Principais componentes

Web: dashboard, action queue, relatórios

API: autenticação, conectores, scores, actions

Connectors: Shopee/ML — OAuth, coleta, aplicação de mudanças

Core: cálculo do Health Score e Action Engine

Dados: S3 (bruto), RDS Postgres (operacional)

Observabilidade: CloudWatch Logs/Metrics (Nativo App Runner)

3) Serviços AWS (Implementação Atual)

API/Web: AWS App Runner (Gerenciado, substitui ECS Fargate para o MVP)

Dados: RDS Postgres (Subnet Privada), S3 (raw)

Rede: NAT Gateway (saída internet), VPC Connector (acesso RDS)

Jobs: EventBridge Scheduler + Lambda (ingestão diária)

Secrets: AWS Secrets Manager (tokens OAuth, DB)

Auth: JWT próprio (Usuários) + OAuth Marketplaces

IaC: Terraform (módulos por recurso)

4) Segurança & LGPD

4.1 Princípios

Minimização: guardar só o necessário para executar as recomendações

Transparência: termos e consentimento para cada conector

Criptografia: em trânsito (TLS) e em repouso (RDS AES-256)

Isolamento por tenant: tenant_id em todas as tabelas e policies de acesso

Isolamento de Rede: Banco de dados inacessível publicamente

4.2 Dados pessoais

E-mail, nome e identificadores dos marketplaces → dados pessoais

Pseudonimização onde possível (IDs internos por tenant)

4.3 Controles

RBAC (roles: owner, manager, operator)

Secrets Manager para tokens/keys

Backups RDS (automáticos diários)

5) Modelo de Dados (operacional — v1)

Tabelas principais (Convenção snake_case)

tenants (id, name, created_at)

users (id, tenant_id, email, password_hash, created_at)

marketplace_connections (id, tenant_id, type, access_token, refresh_token, expires_at, status)

listings (id, tenant_id, marketplace, listing_id_ext, title, price, stock, status, category, updated_at)

health_scores (id, tenant_id, listing_id, score, components_json, computed_at)

actions (id, tenant_id, listing_id, type, payload_json, status, created_at, approved_at, applied_at)

6) APIs (Fastify + Zod) — Contratos MVP

Prefixo: /api/v1

6.1 Auth & Tenancy

POST /auth/register — Cria usuário e tenant

POST /auth/login — Autenticação JWT

6.2 Connectors (Mercado Livre)

GET /auth/mercadolivre/connect — Inicia fluxo OAuth (Redireciona para ML)

GET /auth/mercadolivre/callback — Recebe código e troca por token (via NAT Gateway)

POST /webhooks/mercadolivre — Recebe notificações de mudanças

6.3 Listings & Métricas

GET /listings — Lista com filtros

GET /listings/:id/metrics — Série temporal

6.4 Actions (aprovação/aplicação)

GET /actions/recommendations — Recomendações pendentes

POST /actions/:id/approve — Aprova sugestão da IA

7) Esqueleto de rotas (TypeScript)

Referência de implementação em apps/api/src/.

7.1 Schemas com Zod — schemas.ts

import { z } from 'zod';

export const ListingFilterSchema = z.object({
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(200).default(20),
});


7.2 Rotas — routes/mercadolivre.ts (Implementado)

import { FastifyPluginCallback } from 'fastify';
// ... imports

export const mercadolivreRoutes: FastifyPluginCallback = (app, _, done) => {
  // Rota que inicia o OAuth
  app.get('/connect', async (req, reply) => {
     // Redireciona para auth.mercadolivre.com.br
  });

  // Rota de Callback
  app.get('/callback', async (req, reply) => {
     // Troca code por token e salva no banco
  });
  done();
};


8) Estratégia de Jobs (ingestão e scores)

Ingestão Tempo Real: Webhooks do Mercado Livre disparam atualizações imediatas.

Ingestão Diária: Job agendado para garantir consistência (reconciliação).

Resiliência: Filas (SQS) planejadas para processamento assíncrono de IA.

9) Observabilidade

Logs estruturados (json) no CloudWatch.

Health Checks: /api/v1/health monitorado pelo App Runner.

Alarmes: Monitoramento de erros 5xx e latência via AWS CloudWatch.

10) Roadmap técnico (MVP → V1)

[x] Infraestrutura Core (App Runner + RDS + NAT)

[x] Autenticação de Usuários

[x] Integração OAuth Mercado Livre

[ ] Integração OAuth Shopee

[ ] Motor de Recomendação (IA)

[ ] Dashboard Analítico

11) Checklists de Segurança (MVP)

[x] TLS forçado (HTTPS)

[x] Secrets no AWS SM, nunca em env plano

[x] Tokens OAuth protegidos no banco

[x] Banco de dados em subnet privada

[x] RBAC aplicado na API (Guardas de rota)

12) Topologia de Rede (Diagrama AWS)

graph TD
    User[Usuário / Internet] -->|HTTPS| AppRunner[AWS App Runner]
    
    subgraph VPC [VPC - us-east-2]
        subgraph PublicSubnet [Subnets Públicas]
            NAT[NAT Gateway]
            IGW[Internet Gateway]
        end
        
        subgraph PrivateSubnet [Subnets Privadas]
            Connector[VPC Connector]
            RDS[(RDS PostgreSQL)]
        end
    end
    
    AppRunner -->|VPC Connector| RDS
    AppRunner -->|VPC Connector| NAT
    NAT --> IGW -->|API Calls| ML[API Mercado Livre]
