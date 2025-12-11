Contexto do Projeto - Super Seller IA

Visão Geral

Plataforma SaaS para gestão e otimização de anúncios em marketplaces (Mercado Livre e Shopee) utilizando Inteligência Artificial.

Estado Atual do Projeto (2025-12-10)

Frontend: Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui.

Backend: Node.js (Fastify) + Prisma ORM.

Infraestrutura: AWS App Runner (Gerenciado via Terraform) + RDS (PostgreSQL).

Status de Produção: Validado. Sync de Anúncios e Pedidos funcionando com dados reais e Auto-Refresh de tokens. Infraestrutura (Terraform) sincronizada.

Funcionalidades Implementadas

✅ Autenticação: NextAuth.js + Renovação automática de Tokens ML.

✅ Sync Robusto: Anúncios e Pedidos (Histórico de 30 dias + Webhooks).

✅ Dashboard:

KPIs Financeiros (GMV, Ticket Médio).

Gráficos de Série Temporal (Vendas x Visitas).

Filtros dinâmicos (Marketplace, Status).

✅ Infraestrutura: Pipeline de Deploy corrigido com Migrations automáticas no startup e State do Terraform saneado.

Estrutura de Dados Crítica

Tenant: Unidade de isolamento.

Integration: Tokens com lógica de expiresAt e refreshToken.

Listing: Anúncios (Campos vitais: price, status, permalink, thumbnail).

Order/OrderItem: Base para cálculo de receita.

Metric: Séries temporais para gráficos.

Problemas Conhecidos & Backlog de Produto

Health Score (Pivot Estratégico): O campo original da API do ML (health_score) provou-se insuficiente/vazio.

Nova Definição: Criar algoritmo proprietário (Super Seller Score) que avalie a qualidade real do anúncio cruzando dados de SEO, Conversão e Competitividade.

Recomendações (IA): A tabela existe, mas o motor de geração de sugestões ainda não foi implementado.

Webhooks: A estrutura de processamento existe, mas precisa de validação contínua em produção para garantir que novos pedidos entrem automaticamente sem necessidade de sync manual.

Próximos Passos (Prioridade Imediata)

UI/UX: Implementar Card "Anúncios Ativos" no Dashboard (Quick Win).

Feature Core: Desenvolver lógica do "Super Seller Score" (Cálculo proprietário de saúde do anúncio).

Feature AI: Iniciar motor de IA para gerar a primeira recomendação real (ex: "Melhorar título" ou "Ajustar preço").