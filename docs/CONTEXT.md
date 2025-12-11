Contexto do Projeto - Super Seller IA

Visão Geral

Plataforma SaaS para gestão e otimização de anúncios em marketplaces (Mercado Livre e Shopee) utilizando Inteligência Artificial.

Estado Atual do Projeto (2025-12-13)

Status de Produção: Maduro. O sistema possui navegação fluida (Sidebar), dados confiáveis (após saneamento) e funcionalidades de ação (Recomendações interativas).

Infra: Estável e escalável (App Runner + RDS).

IA: Backend pronto (OpenAI), aguardando interface visual no Frontend.

Funcionalidades Implementadas

✅ Super Seller Score: Algoritmo proprietário (0-100) que avalia a saúde real do anúncio cruzando dados de cadastro, tráfego e estoque.

✅ Recomendações Inteligentes: Dicas baseadas em regras de negócio precisas (sem falsos positivos após Fix V2).

✅ Motor de IA (Backend): Integração com OpenAI (OpenAIService) implantada, capaz de gerar hacks de crescimento e reescrita de conteúdo via API.

✅ Gestão de Tarefas: Usuário pode visualizar detalhes em painel lateral e marcar recomendações como "Feitas".

✅ Dashboard Financeiro: Dados reais de GMV e Pedidos sincronizados, com badges de crescimento e Top 3 Produtos.

✅ UX Profissional: Layout com Sidebar fixa, menus contextuais e Landing Page com acesso claro.

Estrutura de Dados Crítica

Listing: super_seller_score, score_breakdown, pictures (JSON), description (Text).

Recommendation: status (Pending/Applied), type, priority, effort.

AIAnalysis (Novo): Estrutura de retorno do endpoint /ai/analyze (Score IA, Hacks, Sugestões SEO).

Problemas Conhecidos & Dívida Técnica

Lockfile Drift: Rodando com hotfix --no-frozen-lockfile no CI. Precisa de estabilização definitiva futura.

Webhooks: Infraestrutura pronta, pendente validação de estabilidade em alta escala.

Gaps vs. Business Plan Original

Conector Shopee: Requisito obrigatório do MVP original, ainda não funcional (Apenas ML está ativo).

Billing (Cobrança): Infraestrutura de pagamento inexistente. Risco alto de não monetização.

Execução Automática: Aplicação de ações na API do marketplace ainda é manual (usuário copia e cola).

Próximos Passos (Roadmap de Curto Prazo)

Frontend da IA (O "Wow"):

Construir a interface visual dentro do Sheet de detalhes para exibir os "Hacks" e "Sugestões" gerados pelo GPT.

Monetização (A Venda):

Implementar página de planos (/pricing) e integração com Gateway de Pagamento (Stripe/Asaas).

Expansão:

Iniciar desenvolvimento do conector Shopee.