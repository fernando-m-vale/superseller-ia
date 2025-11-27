# Super Seller IA — README (Dev & Setup Interno)

> Guia completo para desenvolvedores e colaboradores técnicos do projeto Super Seller IA. Contém instruções de ambiente, build, convenções e boas práticas internas.

---

## 🚀 Visão Geral
O **Super Seller IA** é uma plataforma SaaS que conecta Shopee, Mercado Livre, Amazon e Magalu, analisando dados de performance de anúncios para gerar **recomendações prescritivas e automações**. O MVP é focado em Shopee e Mercado Livre.

**Principais objetivos do MVP:**
- Health Score diário por anúncio e loja
- Action Engine com recomendações priorizadas
- Execução assistida de ações (human-in-the-loop)
- Relatórios e alertas automáticos

---

## 🧱 Estrutura do Monorepo
```
superseller-ia/
  apps/
    web/            → Next.js + shadcn/ui (dashboard)
    api/            → Fastify + TypeScript + Zod (serviços)
  packages/
    core/           → health score e motor de ações
    connectors/     → Shopee/ML (integrações OAuth e API)
    ui/             → componentes compartilhados
  infra/
    terraform/      → infraestrutura AWS IaC
    pipelines/      → jobs ETL / ingestão
  docs/             → documentação e especificações
  .github/          → CI/CD, templates e segurança
```

---

## 🧩 Stack Técnica
- **Frontend**: Next.js 14, TailwindCSS, shadcn/ui, React Query
- **Backend/API**: Fastify 4, Zod, TypeScript
- **Infra**: AWS (Lambda, ECS Fargate, S3, RDS, EventBridge, Secrets Manager)
- **Banco de Dados**: Postgres (RDS)
- **AI Core**: regras e LLM (em ECS/SageMaker futura)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions, Dependabot, CodeQL

---

## ⚙️ Ambiente de Desenvolvimento
### 1) Pré-requisitos
- Node 18+  (`nvm use 18`)
- PNPM (corepack)
- Docker (opcional, para DB local)
- GitHub CLI (`gh`) opcional

### 2) Instalação
```bash
corepack enable
pnpm i -w
```

### 3) Variáveis de ambiente
#### apps/api/.env.example
```env
PORT=3001
DATABASE_URL=postgres://USER:PASS@HOST:5432/superseller
JWT_SECRET=change-me
CORS_ORIGIN=http://localhost:3000
```
#### apps/web/.env.example
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### 3.1) Configuração de URL da API (Frontend)

O frontend usa a variável `NEXT_PUBLIC_API_URL` para determinar a URL base da API. A configuração segue esta prioridade:

1. **Variável de ambiente** (`NEXT_PUBLIC_API_URL`): Se definida, usa este valor
2. **Produção** (`NODE_ENV=production`): Usa `https://api.superselleria.com.br/api/v1`
3. **Desenvolvimento**: Usa `http://localhost:3001/api/v1`

**URLs por ambiente:**

| Ambiente | URL da API |
|----------|------------|
| Desenvolvimento local | `http://localhost:3001/api/v1` |
| Produção | `https://api.superselleria.com.br/api/v1` |

**Importante:** A variável `NEXT_PUBLIC_API_URL` deve ser definida em **tempo de build** para o Next.js, pois variáveis `NEXT_PUBLIC_*` são incorporadas no bundle do cliente durante a compilação. No deploy de produção, isso é feito automaticamente via AWS Secrets Manager no workflow de CI/CD.

### 4) Rodar localmente
```bash
# API
pnpm --filter api dev

# Web
pnpm --filter web dev
```
Acesse o dashboard: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Scripts úteis
| Comando | Função |
|----------|---------|
| `pnpm i -w` | Instala dependências no workspace |
| `pnpm --filter api dev` | Sobe a API local (porta 3001) |
| `pnpm --filter web dev` | Sobe o dashboard (porta 3000) |
| `pnpm lint` | Executa ESLint global |
| `pnpm build` | Compila todos os pacotes |
| `pnpm test` | (futuro) testes unitários |

---

## 🧠 Convenções de Código
### Commits (Conventional Commits)
```
feat: nova funcionalidade
fix: correção de bug
chore: tarefa sem impacto no código
refactor: refatoração
perf: otimização
style: ajustes de formatação
```

### Branches
```
feature/<nome>
fix/<nome>
docs/<nome>
```

### Pull Requests
- Use o template em `.github/PULL_REQUEST_TEMPLATE.md`
- 2 revisões obrigatórias para merges críticos (API/infra)
- PR pequeno (<300 linhas) e focado em 1 propósito

---

## 🧱 Banco de Dados
**Modelo inicial (simplificado)**
- `tenants`: dados da loja
- `users`: usuários e roles
- `marketplace_connections`: Shopee/ML tokens
- `listings`: anúncios ativos
- `listing_metrics_daily`: métricas diárias (CTR, conversão...)
- `health_scores`: score calculado
- `actions`: recomendações geradas
- `action_effects`: impacto pós-execução

Migrations serão criadas com [Prisma](https://www.prisma.io/) ou [Knex.js](https://knexjs.org/), conforme decisão futura.

---

## ☁️ AWS & Infraestrutura
- **S3** → data lake (dados brutos)
- **RDS** → banco transacional (Postgres)
- **Lambda** → jobs de ingestão e recompute diário
- **EventBridge** → agendamento dos jobs
- **Secrets Manager** → tokens OAuth e secrets da API
- **Cognito** → autenticação e RBAC
- **CloudWatch** → logs e métricas
- **Terraform** → módulos IaC

---

## 🔐 Segurança e LGPD
- TLS em todos os endpoints (HTTPS)
- Tokens e credenciais no AWS Secrets Manager
- Dados pessoais pseudonimizados (tenant_id)
- Backups automáticos RDS + política de retenção
- RBAC aplicado (owner, manager, operator)
- MFA e logging via Cognito

---

## 📈 Observabilidade
- Logs estruturados (JSON)
- Telemetria de produto (eventos: conectar, aprovar, aplicar, relatório)
- Alarmes → ingestão falha, latência alta, erros >2%

---

## 🧾 CI/CD (GitHub Actions)
Fluxo CI básico:
1. **Lint + Build** (Next.js + API)
2. **Dependabot** semanal
3. **CodeQL** (segurança estática)
4. **Deploy** futuro via AWS OIDC → ECS/Lambda

Arquivo principal: `.github/workflows/ci.yml`

---

## 🧱 Estrutura Terraform (infra/terraform)
```hcl
aws_s3_bucket.data_lake
aws_db_instance.rds_postgres
aws_lambda_function.ingestion
aws_iam_role.github_oidc
```

> MVP: buckets e RDS simples.  
> V1: VPC, CloudFront, WAF, SageMaker, Redshift.

---

## 📘 Documentação de Referência
| Documento | Caminho |
|------------|----------|
| Business Plan | `docs/business-plan.md` |
| Plano Financeiro | `docs/financial-plan.md` |
| Backlog MVP | `docs/mvp-backlog.md` |
| User Stories | `docs/user-stories.md` |
| Arquitetura & Segurança | `docs/architecture.md` |

---

## 🧰 Boas Práticas
- Teste local antes de PR (`pnpm dev` + `pnpm lint`)
- Crie issues no GitHub com labels (`feature`, `bug`, `infra`, etc.)
- Atualize documentação sempre que alterar arquitetura ou endpoints
- Mantenha PRs pequenos e com descrição clara
- Faça squash merge para histórico limpo

---

## 👥 Contato & Colaboração
- GitHub Issues → bugs e features
- Discussions → ideias e feedbacks
- Pull Requests → contribuições diretas

> **Mantra:** _Build fast, measure smart, learn faster._

