Contexto do Projeto: SuperSeller IA

Status: Fase 3 - Dashboard e Ingestão de Dados
Última Atualização: 05/12/2025 (Final do Dia)

1. Visão Geral

SaaS Multi-tenant para otimização de e-commerce.
Marco Atual: Integração OAuth com Mercado Livre concluída e Dashboard estabilizado.

2. Status Técnico

Infraestrutura: ✅ App Runner + RDS + NAT Gateway (Rede configurada e funcional).

Banco de Dados: ✅ Schema Multi-conta (provider_account_id) implementado e migrado.

Integração ML: ✅ Fluxo OAuth completo. Tokens persistidos e renováveis.

Frontend: ✅ Dashboard /overview carregando sem erros (dados mockados/zerados).

API: ✅ Rotas de Métricas implementadas (/summary) para suportar a UI.

3. Arquitetura de Rede

App Runner (Privado) -> NAT Gateway (Público) -> API ML.

App Runner -> VPC Connector -> RDS.

Nota: NAT Gateway pode ser desligado via Terraform (enable_nat_gateway = false) para economia.

4. Próximos Passos (Retomada)

Job de Ingestão: Criar worker para baixar anúncios e vendas do Mercado Livre e popular o banco.

Métricas Reais: Substituir o mock em metrics.ts por queries reais no banco (prisma.listing.count, etc).

Webhooks: Processar notificações de vendas em tempo real.