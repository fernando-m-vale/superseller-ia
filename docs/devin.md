# DEVIN BRIEF — Super Seller IA

## 🎯 Objetivo
O **Super Seller IA** é uma plataforma SaaS que utiliza inteligência artificial para otimizar o desempenho de anúncios em marketplaces como Shopee, Mercado Livre, Amazon e Magalu. O sistema analisa métricas de performance e recomenda ações automáticas para aumentar visibilidade, conversão e faturamento.

Durante o **MVP**, o foco é em **Shopee** e **Mercado Livre**.

---

## 🧠 O que o DEVIN deve saber
### 1. Documentação base
Todos os documentos de referência estão no repositório:
- `docs/business-plan.md` → visão de negócio
- `docs/financial-plan.md` → modelo financeiro (CAC, LTV, etc.)
- `docs/mvp-backlog.md` → backlog funcional
- `docs/user-stories.md` → user stories e critérios de aceite
- `docs/architecture.md` → arquitetura técnica e endpoints
- `docs/README-dev.md` → setup técnico e convenções

### 2. Estrutura do projeto
```
superseller-ia/
  apps/
    api/  → Fastify + TS + Zod (serviços e rotas)
    web/  → Next.js + shadcn/ui (dashboard)
  packages/
    core/ → motor de health score e ações
    connectors/ → integrações Shopee/ML (placeholders)
    ui/ → componentes visuais compartilhados
  infra/
    terraform/ → IaC AWS (S3, Config, CloudTrail, KMS, Secrets)
  docs/ → documentação do produto
  .github/ → CI/CD, templates, actions, OIDC AWS
```

### 3. Stack principal
- **Frontend**: Next.js 14 + Tailwind + shadcn/ui + React Query
- **Backend**: Fastify + TS + Zod + Prisma (Postgres local → RDS depois)
- **Infra AWS (us-east-2)**: S3, CloudTrail, AWS Config, Secrets Manager, KMS, OIDC GitHub Actions
- **CI/CD**: GitHub Actions (lint, build, tests, deploy futuro)

### 4. Regras de colaboração
- Commits → Conventional Commits (`feat:`, `fix:`, `chore:` ...)
- Branches → `feature/<nome>`
- PR → 1 issue por PR, descrição com **como testar** + **evidências**
- CI → precisa passar (lint/build/test)
- Sem segredos no repo; usar `.env.example`

### 5. Workflow de Sprint (atual Sprint 1)
| Ordem | Issue | Título |
|--------|--------|---------|
| 1 | US-001 | API bootstrap + /health + CORS |
| 2 | US-081 | Web – tabela de anúncios consumindo /listings (mock) |
| 3 | US-021 | DB – migrations iniciais + scripts db:up/db:down |
| 4 | US-030 | Core – função healthScore() + testes |
| 5 | US-040 | API – /actions/recommendations (mock) |
| 6 | US-003 | Web – checklist de ativação (localStorage) |

---

## ⚙️ Ambiente DEV padrão
- Node 18+
- PNPM (`corepack enable` ou `npm i -g pnpm`)
- Postgres local (Docker ou host)
- API porta 3001 → Web porta 3000

### Variáveis padrão
`apps/api/.env.example`
```
PORT=3001
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgres://USER:PASS@localhost:5432/superseller
JWT_SECRET=change-me
```

`apps/web/.env.example`
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## 🚀 Objetivo da Sprint 1 (10–21 nov 2025)
1. Subir API com rota `/health` e CORS dinâmico
2. Renderizar tabela mock de anúncios (`/listings`)
3. Criar schema e migrations (Postgres local)
4. Implementar função `healthScore()` (core package)
5. Criar rota `/actions/recommendations` (mock)
6. Adicionar checklist de ativação no dashboard

---

## 🧩 Regras de entrega
- Um **PR por issue**, com `Fixes #<número>` na descrição.
- Inclua logs, prints, outputs e passos de teste.
- Atualize a issue com checklist marcado.
- Após merge, mova o card no Project `Superseller IA — MVP` para **Done**.

---

## 🛠️ Comandos úteis
```bash
pnpm i -w                 # instalar dependências
pnpm --filter api dev      # rodar API local
pnpm --filter web dev      # rodar web local
pnpm --filter api build    # build API
pnpm --filter web build    # build web
pnpm lint                  # lint global
```

---

## 🧠 Missão do DEVIN
1. Ler `docs/DEVIN.md`, `docs/architecture.md` e o board da Sprint 1.
2. Executar issues **US-001 → US-081 → US-021 → US-030 → US-040 → US-003**, nessa ordem.
3. Abrir **PRs separados** para cada issue com commits padronizados.
4. Adicionar **descrição completa** no PR (contexto, como testar, resultados, prints).
5. Garantir **CI verde** em cada PR.

> Ao finalizar cada issue, notificar o revisor e seguir para a próxima.

---

## ✅ Validação Inicial (Pré-Sprint)
Antes de iniciar o desenvolvimento das issues, o DEVIN deve validar o ambiente do projeto e registrar o resultado em um comentário no PR ou issue inicial.

### 1. Clonar e instalar dependências
```bash
git clone https://github.com/fernando-m-vale/superseller-ia.git
cd superseller-ia
pnpm i -w
```

### 2. Validar execução local
```bash
# Testar API
pnpm --filter api dev
# Em outro terminal, testar Web
pnpm --filter web dev
```
- API deve responder em `http://localhost:3001/health` → `{ "status": "ok" }`
- Web deve abrir em `http://localhost:3000`

### 3. Validar build CI
```bash
pnpm --filter api build && pnpm --filter web build
```

### 4. Confirmar CI local
- Rodar `pnpm lint` e confirmar ausência de erros.
- Verificar que todos os pacotes compilam corretamente.

### 5. Atualizar documentação
Caso encontre problemas ou comandos ausentes, adicionar seção **“Troubleshooting”** no `docs/README-dev.md` com a correção aplicada (ex: versão de Node, pnpm, variáveis ausentes, porta em uso etc.).

---

## ✅ Conclusão
Com este documento, o **Devin** tem todas as informações necessárias para compreender o contexto, stack, convenções e prioridades da Sprint 1 do projeto **Super Seller IA**, além de validar o ambiente antes de começar a desenvolver efetivamente.

