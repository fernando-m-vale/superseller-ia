Contexto do Projeto - Super Seller IA

Visão Geral

Plataforma SaaS para gestão e otimização de anúncios em marketplaces (Mercado Livre e Shopee) utilizando Inteligência Artificial.

Estado Atual do Projeto (2025-12-12)

Status de Produção: Maduro. O sistema possui um layout profissional (Sidebar), métricas proprietárias (Score) e um motor de recomendações ativo.

UX: Navegação unificada e painéis laterais interativos substituíram a navegação fragmentada.

Funcionalidades Implementadas

✅ Super Seller Score: Algoritmo proprietário (0-100) que avalia a saúde real do anúncio.

✅ Motor de Recomendações: Sistema de regras que gera dicas práticas (SEO, Preço, Estoque) baseadas no score.

✅ Novo Layout (Dashboard): Sidebar fixa, redirecionamento automático e painéis deslizantes (Sheets) para detalhes.

✅ Dashboard Rico: KPIs financeiros, Gráficos de Tendência e Tabela "Top 3 Produtos".

Estrutura de Dados Crítica

Listing: Possui super_seller_score e score_breakdown.

Recommendation: Nova tabela que armazena as dicas geradas para cada anúncio (Status: Pending, Applied, Dismissed).

Problemas Conhecidos & Dívida Técnica

Lockfile Drift: O pnpm-lock.yaml precisa ser estabilizado para voltarmos a usar --frozen-lockfile no CI (segurança). Atualmente rodando com --no-frozen-lockfile como hotfix.

Webhooks: A infraestrutura existe, mas a recepção de eventos em tempo real ainda carece de validação massiva em produção.

Próximos Passos (Roadmap de Curto Prazo)

IA Generativa: Conectar um LLM para executar as recomendações (ex: "Clicar em 'Melhorar Título' gera 3 sugestões via IA").

Gestão de Recomendações: Permitir que o usuário marque dicas como "Feito" ou "Ignorar" (API já existe, falta conectar UI).