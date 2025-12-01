# Contexto do Projeto: SuperSeller IA
**Última Atualização:** 01/12/2025

## 1. Visão Geral e Objetivos
Plataforma SaaS Multi-tenant para otimização de e-commerce (ML, Shopee).
**Meta:** MVP funcional com ciclo de testes limpo e baixo custo operacional.

### Diferenciais Competitivos (Escopo Expandido)
1.  **Engenharia Reversa de Algoritmos:** Scoring reverso para entender por que um anúncio rankeia mal.
2.  **Gestão de Ads (Fase 4):** Sugestão de budget e ROI para Mercado Ads e Shopee Ads.
3.  **Agente Autônomo "Human-in-the-Loop":** Execução de melhorias (títulos, preços) mediante aprovação.

## 2. Stack Tecnológica
- **Frontend:** Next.js 14 (App Router), Tailwind, ShadcnUI.
- **Backend:** Fastify, Node.js 20, TypeScript.
- **Database:** PostgreSQL (Prisma ORM).
- **IA Engine:** Módulo isolado (`packages/ai`) agnóstico a LLMs (OpenAI/Anthropic/Llama).
- **Filas:** AWS SQS (para processamento assíncrono de IA e Sync).

## 3. Infraestrutura (Pivot para Eficiência de Custo)
*Decisão em 01/12: Migração de ECS Fargate para AWS App Runner.*
- **Compute:** AWS App Runner (Web + API). Remove necessidade de ALB dedicado e gestão de cluster.
- **Database:** AWS RDS PostgreSQL (Existente).
- **Segurança:** Tokens de Marketplace criptografados em repouso (Field Encryption).

## 4. Problemas Conhecidos & Status
1.  **Conexão DB (EM RESOLUÇÃO):** Instância RDS criada, mas banco lógico `superseller` inexistente.
    - *Ação:* Criar database via SQL cliente e atualizar Secret.
2.  **Integração ML:** Fluxo OAuth pendente e falta de renovação automática de tokens (Refresh Token Cron).
3.  **Custos:** Infraestrutura original (ECS+ALB) superdimensionada para fase atual.

## 5. Backlog Prioritário
1.  **Infra:** Refatorar Terraform para App Runner.
2.  **Core:** Implementar fila SQS para requests de IA.
3.  **Features:** Criar Models para `AdsMetrics` e `AlgorithmScore`.
