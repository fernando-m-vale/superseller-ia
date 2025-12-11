Contexto do Projeto - Super Seller IA

Visão Geral

Plataforma SaaS para gestão e otimização de anúncios em marketplaces (Mercado Livre e Shopee) utilizando Inteligência Artificial.

Estado Atual do Projeto (2025-12-12)

Status de Produção: Maduro. O sistema possui navegação fluida (Sidebar), dados confiáveis (após saneamento) e funcionalidades de ação (Recomendações interativas).

UX: Dashboard Layout profissional com Sidebar fixa, menus contextuais e Sheets para detalhes.

Acesso: Landing Page com CTA claro para login/cadastro.

Funcionalidades Chave

✅ Super Seller Score: Algoritmo proprietário (0-100) que avalia a saúde real do anúncio.

✅ Recomendações Inteligentes: Dicas baseadas em regras de negócio precisas (sem falsos positivos).

✅ Gestão de Tarefas: Usuário pode visualizar detalhes em painel lateral e marcar recomendações como "Feitas".

✅ Dashboard Financeiro: Dados reais de GMV e Pedidos sincronizados, com badges de crescimento e Top 3 Produtos.

Estrutura de Dados

Listing: super_seller_score, score_breakdown, pictures (JSON), description (Text).

Recommendation: status (Pending/Applied), type, priority, effort.

Problemas Conhecidos & Dívida Técnica

Lockfile Drift: Rodando com hotfix --no-frozen-lockfile no CI. Precisa de estabilização definitiva futura.

Webhooks: Infraestrutura pronta, pendente validação de estabilidade em alta escala.

Próximos Passos (Roadmap de Curto Prazo)

IA Generativa (The "Wow" Factor):

Transformar a dica "Melhore o título" em um botão "Gerar Título com IA" (Integração OpenAI/Anthropic).

Gestão de Assinatura: Implementar página de planos/pagamento (Stripe/Asaas) no futuro menu de Configurações.