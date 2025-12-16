Super Seller IA — Arquitetura & Segurança (Status: Produção MVP)

Documento técnico com a visão de arquitetura, fluxos de dados, padrões de segurança e desenho das APIs. Reflete a implementação atual na AWS (App Runner + RDS) e a integração com OpenAI.

1) Objetivos de Arquitetura

Escalável e Modular: Microsserviço monolítico modular (Monorepo Nx) pronto para quebra futura.

Custo-eficiente: AWS App Runner (Scale-to-zero) + RDS Postgres (Privado).

Segurança: Zero Trust na rede (VPC Privada), Secrets Manager para chaves e OAuth criptografado.

Inteligência: Motor híbrido (Regras Determinísticas + LLM Generativo via OpenAI).

2) Diagrama Lógico (Atualizado)

graph TD
    User[Usuário / Browser] -->|HTTPS/TLS| AppRunner[AWS App Runner (API + Web)]
    
    subgraph "AWS Cloud (VPC us-east-2)"
        AppRunner -->|SQL| RDS[(RDS PostgreSQL)]
        AppRunner -->|Env Vars| Secrets[AWS Secrets Manager]
    end
    
    subgraph "Integrações Externas"
        AppRunner -->|OAuth/Sync| MercadoLivre[API Mercado Livre]
        AppRunner -->|Analysis| OpenAI[OpenAI API (GPT-4o)]
        MercadoLivre -->|Webhook| AppRunner
    end


3) Stack Tecnológico (Validado)

Frontend: Next.js 14 (App Router), TailwindCSS, Shadcn/UI.

Backend: Fastify, TypeScript, Zod, Prisma ORM.

Banco de Dados: PostgreSQL 16 (AWS RDS).

IA/LLM: OpenAI GPT-4o (OpenAIService).

Infraestrutura: Terraform + Docker.

4) Fluxos de Dados Críticos

A. Sincronização e Auto-Healing

Trigger: Login do usuário ou Cron Job (Hora em hora).

Check: Verifica validade do Token OAuth.

Refresh: Se expirado, renova automaticamente via API do ML.

Sync: Baixa Anúncios e Pedidos (Janela de 30 dias).

Processamento: Calcula Super Seller Score e gera Recommendations (Regras).

B. Análise de IA Generativa

Input: Usuário clica em "Gerar Análise" no Dashboard.

Processo: Backend busca dados do anúncio (Título, Preço, Fotos) e monta Prompt.

Inferência: Envia para OpenAI (GPT-4o) via OpenAIService.

Output: Recebe JSON estruturado (Hacks, SEO, Crítica) e retorna ao Frontend.

5) Segurança e Privacidade

Segredos: Nenhuma chave (OpenAI, DB, JWT) é commitada. Tudo injetado via AWS Secrets Manager em tempo de execução.

Isolamento de Dados: TenantId obrigatório em todas as queries do Prisma (Roteamento lógico).

Rede: Banco de dados isolado em Subnet Privada, acessível apenas pelo App Runner (via VPC Connector) ou Bastion Host (Túnel SSH para manutenção).

6) Estratégia de Jobs (Background)

Token Refresh: Cron job roda a cada hora para renovar tokens prestes a expirar (< 2h).

Sync Reativo: Webhooks do Mercado Livre (configurados) atualizam estoque e preço em tempo real.

7) Roadmap Técnico (MVP → V1)

Módulo

Status

Obs

Infraestrutura Core

✅

App Runner + RDS + VPC Connector operacionais.

Autenticação

✅

NextAuth + Tratamento de Expiração.

Integração ML

✅

Anúncios e Vendas sincronizados.

Integração Shopee

🔴

Próximo passo prioritário.

Motor de Recomendação

✅

Híbrido (Regras + GPT-4o).

Dashboard Analítico

✅

GMV, Pedidos e Score visualizados.

Billing/Pagamentos

🔴

A iniciar (Stripe/Asaas).

8) Observabilidade

Logs: CloudWatch Logs (estruturados em JSON via Pino logger).

Health Checks: Rota /api/v1/health e /api/v1/ai/status monitoradas.