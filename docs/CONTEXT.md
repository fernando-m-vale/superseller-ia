# Contexto do Projeto: SuperSeller IA
**Data de Atualização:** 01/12/2025

## 1. Visão Geral
SaaS Multi-tenant para otimização de vendas em Marketplaces (ML, Shopee) usando IA.
**Objetivo Atual:** Estabilizar MVP (Ciclo Limpo de Testes) e corrigir fluxo de Auth/Registro.

## 2. Stack Tecnológica
- **Frontend:** Next.js 14 (App Router), Tailwind, ShadcnUI.
- **Backend:** Fastify, Node.js 20, TypeScript.
- **Database:** PostgreSQL (Prisma ORM).
- **Infra:** AWS ECS Fargate, RDS, ALB, Terraform.
- **CI/CD:** GitHub Actions via OIDC.

## 3. Status da Arquitetura
- **Monorepo:** `pnpm workspaces` (apps: web, api; packages: core, ai).
- **Integrações:** Mercado Livre (OAuth pendente), Shopee (Roadmap).
- **IA:** Módulo isolado em `packages/ai`.

## 4. Problemas Conhecidos (Críticos/Bloqueantes)
1.  **DATABASE_URL Inválida (CRÍTICO):** O segredo `prod/DB_SSELLERIA` na AWS não está no formato connection string (`postgresql://...`), causando erro 500 no registro/login.
2.  **API Health Check 404:** A rota `GET /api/v1/health` retornou 404 nos testes, indicando erro de prefixo ou rota não registrada.
3.  **Testes Bloqueados:** Todo o fluxo de onboarding (T05 a T17) falha pois depende do registro/login funcional.
4.  **Integração ML:** Secrets pendentes e fluxo OAuth incompleto.

## 5. Próximos Passos Imediatos
- Corrigir formato da `DATABASE_URL` no Secrets Manager.
- Validar rota de Health Check da API.
- Executar teste de fumaça (Smoke Test) no registro de usuário.
