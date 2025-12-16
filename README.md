Super Seller IA 🚀

Plataforma SaaS de inteligência artificial para otimização de vendas em marketplaces.
Conecte sua conta, receba um diagnóstico profundo e deixe a IA gerar hacks de crescimento para seus anúncios.

🌟 Visão Geral

O Super Seller IA não é apenas um dashboard. É um Copiloto de E-commerce que analisa métricas de performance (CTR, Conversão, Receita) e utiliza Inteligência Artificial Generativa (LLM) para criar recomendações acionáveis.

Diferenciais:

Super Seller Score: Algoritmo proprietário (0-100) que audita a saúde real da sua conta.

IA Generativa: O sistema reescreve títulos e descrições focados em SEO e conversão.

Auto-Healing: Sincronização de dados resiliente que se recupera de falhas de conexão automaticamente.

🚀 Funcionalidades Principais

1. Diagnóstico Inteligente

Score Proprietário: Avalia Cadastro (30%), Tráfego (30%) e Disponibilidade (40%).

Action Engine: Detecta oportunidades críticas (ex: "Baixa conversão com alto tráfego").

2. Motor de IA (Generative AI)

Integração nativa com OpenAI (GPT-4o).

Gera "Growth Hacks" personalizados para cada anúncio.

Sugere otimizações de Copywriting e SEO em tempo real.

3. Gestão Financeira & Operacional

Dashboard Financeiro: GMV, Pedidos, Ticket Médio e Curvas de Crescimento.

Gestão de Anúncios: Filtros avançados, edição rápida e histórico de vendas (30 dias).

Sync Automático: Webhooks e Jobs garantem dados sempre frescos.

🛠️ Stack Tecnológica

O projeto utiliza uma arquitetura moderna, escalável e segura na AWS.

Camada

Tecnologia

Detalhes

Frontend

Next.js 14

App Router, Tailwind CSS, Shadcn/UI, Recharts.

Backend

Node.js (Fastify)

TypeScript, Zod, Prisma ORM.

Banco de Dados

PostgreSQL

AWS RDS (Private VPC) + Prisma.

AI Core

OpenAI API

Modelo GPT-4o via OpenAIService.

Infraestrutura

AWS App Runner

Serverless Containers, Scale-to-zero.

IaC

Terraform

Infraestrutura como Código para todo o ambiente.

CI/CD

GitHub Actions

Deploy automatizado com OIDC.

🏗️ Estrutura do Monorepo

superseller-ia/
├── apps/
│   ├── api/          # Backend Fastify (Porta 3001)
│   └── web/          # Frontend Next.js (Porta 3000)
├── packages/
│   ├── core/         # Lógica compartilhada (Types, Utils)
│   └── ai/           # (Futuro) Modelos de ML isolados
├── infra/
│   └── terraform/    # Código Terraform (AWS)
└── docs/             # Documentação de Arquitetura e Negócio


⚡ Setup Rápido (Desenvolvimento)

Pré-requisitos

Node.js 20+

pnpm 8+

Docker (Opcional, para banco local)

Instalação

Clone o repositório:

git clone [https://github.com/fernando-m-vale/superseller-ia.git](https://github.com/fernando-m-vale/superseller-ia.git)
cd superseller-ia


Instale dependências:

pnpm install


Configure Variáveis de Ambiente:

Copie .env.example para .env em apps/api e apps/web.

Adicione sua chave da OpenAI e credenciais do Banco.

Inicie o Banco de Dados:

# Se usar Docker
docker-compose up -d db

# Gere o cliente Prisma e rode as migrações
pnpm --filter @superseller/api db:generate
pnpm --filter @superseller/api db:deploy


Rode a Aplicação:

# Terminal 1 (API)
pnpm --filter @superseller/api dev

# Terminal 2 (Web)
pnpm --filter web dev


Acesse:

Frontend: http://localhost:3000

API: http://localhost:3001/api/v1

🔒 Segurança & Deploy

Segredos: Gerenciados via AWS Secrets Manager. Nenhuma chave sensível no código.

Rede: Banco de dados isolado em subnet privada. Acesso externo apenas via Bastion Host (Túnel SSH).

Deploy: Push na main dispara o pipeline de CI/CD para o AWS App Runner.

📚 Documentação Adicional

Arquitetura & Segurança

Guia de Deploy (Prod)

User Stories & Backlog

Business Plan

© 2025 Super Seller IA - Otimizando o e-commerce com inteligência real.