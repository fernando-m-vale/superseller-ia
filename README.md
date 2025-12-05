SuperSeller IA

Plataforma SaaS multi-tenant que ajuda vendedores de e-commerce a otimizar seus anúncios em marketplaces usando inteligência artificial.

Visão Geral

O SuperSeller IA analisa métricas de performance dos anúncios (CTR, taxa de conversão, receita) e gera recomendações acionáveis para melhorar visibilidade e vendas. A plataforma suporta integração com Shopee e Mercado Livre via OAuth 2.0.

Principais Funcionalidades

Integração com Marketplaces: Conexão OAuth 2.0 para sincronizar anúncios e métricas

Health Score: Pontuação de saúde (0-100) por anúncio baseada em regras de qualidade

Recomendações IA: Sugestões para otimizar títulos, imagens, preços e atributos

Automação: Regras configuráveis para aprovar e executar recomendações automaticamente

Monitoramento: Acompanhamento de efetividade das ações aplicadas

Stack Tecnológica

Camada

Tecnologia

Frontend

Next.js 14, React, TypeScript, Tailwind CSS

Backend

Fastify, Node.js 20, TypeScript

Banco de Dados

PostgreSQL (AWS RDS) com Prisma ORM

Infraestrutura

AWS App Runner (Web + API), RDS Privado, NAT Gateway

CI/CD

GitHub Actions com OIDC

IaC

Terraform

Estrutura do Projeto

superseller-ia/
├── apps/
│   ├── api/          # Backend Fastify (porta 3001)
│   └── web/          # Frontend Next.js (porta 3000)
├── packages/
│   ├── core/         # Utilitários compartilhados
│   └── ai/           # Engine de recomendações
├── infra/
│   └── terraform/    # Definições de infraestrutura AWS (App Runner, RDS, VPC)
├── docs/             # Documentação técnica e Logs
└── package.json      # Configuração do workspace pnpm


Setup Rápido

Pré-requisitos

Node.js 20+ (use nvm use para carregar a versão correta)

pnpm 8+

PostgreSQL 14+

Docker (opcional, para ambiente local)

Instalação

# Clone o repositório
git clone [https://github.com/fernando-m-vale/superseller-ia.git](https://github.com/fernando-m-vale/superseller-ia.git)
cd superseller-ia

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp apps/api/.env.example apps/api/.env
# Edite o arquivo .env com suas credenciais

# Execute as migrations do banco
pnpm --filter @superseller/api db:generate
pnpm --filter @superseller/api db:dev


Executando o Projeto

# Terminal 1: Inicie a API
pnpm --filter @superseller/api dev

# Terminal 2: Inicie o frontend
pnpm --filter web dev


Acesse:

Frontend: http://localhost:3000

API: http://localhost:3001/api/v1

Infraestrutura e Deploy

O deploy é automatizado via GitHub Actions para a AWS.
A infraestrutura utiliza AWS App Runner para computação serverless e RDS PostgreSQL em subnets privadas para segurança. O acesso externo (APIs Mercado Livre) é garantido via NAT Gateway.

Para economia de custos em desenvolvimento, o NAT Gateway pode ser desabilitado via variável Terraform enable_nat_gateway = false.

Documentação

Contexto Atual

Log de Desenvolvimento

Contratos de API

Arquitetura

Licença

Proprietário - Todos os direitos reservados.
