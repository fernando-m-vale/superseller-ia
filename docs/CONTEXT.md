Contexto do Projeto - Super Seller IA

Visão Geral

Plataforma SaaS para gestão e otimização de anúncios em marketplaces (Mercado Livre e Shopee) utilizando Inteligência Artificial.

Estado Atual do Projeto (2025-12-09)

Frontend: Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui.

Backend: Node.js (Fastify) + Prisma ORM.

Infraestrutura: AWS App Runner (Docker) + RDS (PostgreSQL).

Status de Produção: Estável (Online). Login funcional, integração com Mercado Livre ativa.

Funcionalidades Implementadas

✅ Autenticação: NextAuth.js com suporte a JWT e Refresh Token.

✅ Integração Mercado Livre: OAuth flow, download de anúncios, sincronização de visitas e Sincronização de Pedidos (Novo).

✅ Dashboard: Gráficos de tendências (Vendas, Visitas, Impressões). Nota: Totais numéricos precisam de ajuste.

✅ Gestão de Anúncios: Listagem com filtros (Status, Marketplace), paginação e exibição de detalhes.

✅ Onboarding: Checklist automatizado de primeiros passos.

Estrutura de Dados Crítica

Tenant: Unidade de isolamento de dados por usuário/empresa.

Integration: Armazena tokens OAuth (ML/Shopee).

Listing: Anúncios sincronizados (agora com campo health_score).

Order/OrderItem: Pedidos sincronizados para cálculo de GMV e Receita.

Metric: Dados diários de performance (visits, views, sales_qty).

Problemas Conhecidos & Dívida Técnica

Inconsistência de Métricas: O endpoint /metrics/overview retorna as séries temporais corretamente (gráfico funciona), mas o objeto totals retorna zeros, deixando os cards de KPI vazios.

Health Score: O campo existe no banco, mas a integração não está populando o valor correto (sempre zero ou null).

Terraform Drift: A configuração real da AWS (App Runner) foi alterada manualmente e não bate com o arquivo main.tf. Risco de sobrescrita em deploys futuros.

Webhooks: A estrutura de processamento existe, mas precisa de validação real em produção para garantir que novos pedidos entrem automaticamente.

Próximos Passos (Prioridade)

Bugfix Dashboard: Corrigir agregação de Receita e Pedidos no Backend.

Bugfix Health Score: Ajustar mapeamento de dados da API do Mercado Livre.

Infra: Sincronizar estado do  Terraform com a configuração manual do App Runner.

IA: Iniciar implementação do motor de Recomendações (fase 4 do roadmap).