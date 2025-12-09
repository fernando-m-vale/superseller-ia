Contexto do Projeto: SuperSeller IA

Status: Fase 3 - Integração Frontend/Backend
Última Atualização: 09/12/2025

1. Visão Geral

SaaS Multi-tenant para otimização de e-commerce.
Marco Atual: Backend 100% funcional (Infra, Auth, Sync ML, Rotas de Dados).
Bloqueio Atual: Frontend falha ao consumir os dados (Erro 401 na Home e Erro de Carregamento no Dashboard).

2. Status Técnico

Infraestrutura: ✅ App Runner (Deploy OK), RDS (Migrated), NAT Gateway (Ativo).

Banco de Dados: ✅ Tabelas populadas com 46 anúncios reais do Mercado Livre.

API:

✅ Rota /api/v1/listings: Implementada e registrada.

✅ Rota /api/v1/metrics: Implementada com cálculos reais (prisma.aggregate).

Frontend: ⚠️ Páginas / e /overview carregam a estrutura, mas falham ao buscar dados da API.

Sintoma: Erro 401 (Unauthorized) ou mensagem de erro genérica.

3. Próximos Passos (Retomada)

Debug Frontend: Verificar como o token JWT está sendo passado (ou não) nas chamadas fetch dos componentes ListingsTable e DashboardMetrics.

Ajuste de Cliente HTTP: Garantir que o axios ou fetch do Next.js inclua o header Authorization: Bearer ....

Visualização Final: Ver os dados do banco renderizados na tela.