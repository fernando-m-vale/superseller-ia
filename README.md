# SuperSeller IA

Plataforma SaaS multi-tenant que ajuda vendedores de e-commerce a otimizar seus anuncios em marketplaces usando inteligencia artificial.

## Visao Geral

O SuperSeller IA analisa metricas de performance dos anuncios (CTR, taxa de conversao, receita) e gera recomendacoes acionaveis para melhorar visibilidade e vendas. A plataforma suporta integracao com Shopee e Mercado Livre via OAuth 2.0.

### Principais Funcionalidades

- **Integracao com Marketplaces**: Conexao OAuth 2.0 para sincronizar anuncios e metricas
- **Health Score**: Pontuacao de saude (0-100) por anuncio baseada em regras de qualidade
- **Recomendacoes IA**: Sugestoes para otimizar titulos, imagens, precos e atributos
- **Automacao**: Regras configuraveis para aprovar e executar recomendacoes automaticamente
- **Monitoramento**: Acompanhamento de efetividade das acoes aplicadas

## Stack Tecnologica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Fastify, Node.js 20, TypeScript |
| Banco de Dados | PostgreSQL (Prisma ORM) |
| Infraestrutura | AWS ECS Fargate, ALB, Route53, Secrets Manager |
| CI/CD | GitHub Actions com OIDC |
| IaC | Terraform |

## Estrutura do Projeto

```
superseller-ia/
├── apps/
│   ├── api/          # Backend Fastify (porta 3001)
│   └── web/          # Frontend Next.js (porta 3000)
├── packages/
│   ├── core/         # Utilitarios compartilhados
│   └── ai/           # Engine de recomendacoes
├── infra/
│   └── terraform/    # Definicoes de infraestrutura AWS
├── docs/             # Documentacao tecnica
└── package.json      # Configuracao do workspace pnpm
```

## Setup Rapido

### Pre-requisitos

- Node.js 20+ (use `nvm use` para carregar a versao correta)
- pnpm 8+
- PostgreSQL 14+
- Docker (opcional, para ambiente local)

### Instalacao

```bash
# Clone o repositorio
git clone https://github.com/fernando-m-vale/superseller-ia.git
cd superseller-ia

# Instale as dependencias
pnpm install

# Configure as variaveis de ambiente
cp apps/api/.env.example apps/api/.env
# Edite o arquivo .env com suas credenciais

# Execute as migrations do banco
pnpm --filter @superseller/api db:generate
pnpm --filter @superseller/api db:dev

# (Opcional) Popule o banco com dados de teste
pnpm --filter @superseller/api db:seed
```

### Executando o Projeto

```bash
# Terminal 1: Inicie a API
pnpm --filter @superseller/api dev

# Terminal 2: Inicie o frontend
pnpm --filter web dev
```

Acesse:
- Frontend: http://localhost:3000
- API: http://localhost:3001/api/v1

### Comandos Uteis

```bash
# Lint e verificacao de tipos
pnpm lint
pnpm typecheck

# Build de producao
pnpm --filter @superseller/api build
pnpm --filter web build

# Testes
pnpm test
```

## Variaveis de Ambiente

### API (`apps/api/.env`)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/superseller
JWT_SECRET=sua-chave-secreta
CORS_ORIGIN=http://localhost:3000

# Mercado Livre OAuth
ML_APP_ID=seu-app-id
ML_APP_SECRET=seu-app-secret
ML_REDIRECT_URI=http://localhost:3001/api/v1/auth/mercadolivre/callback

# Shopee OAuth (opcional)
SHOPEE_CLIENT_ID=seu-client-id
SHOPEE_CLIENT_SECRET=seu-client-secret
SHOPEE_REDIRECT_URI=http://localhost:3001/api/v1/auth/shopee/callback
```

### Web (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Documentacao

- [Plano de Negocios](docs/business-plan.md)
- [Backlog MVP](docs/mvp-backlog.md)
- [Arquitetura](docs/architecture.md)
- [Guidelines Frontend](docs/frontend-guidelines.md)
- [Especificacao Health Score](docs/healthscore-spec.md)

## Contribuindo

1. Crie uma branch: `git checkout -b feature/sua-feature`
2. Faca commits com Conventional Commits: `feat:`, `fix:`, `chore:`
3. Abra um PR com descricao clara do que foi feito

## Licenca

Proprietario - Todos os direitos reservados.
