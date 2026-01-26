# PROJECT CONTEXT — SuperSeller IA
Atualizado em: 2026-01-19

## 🧠 Visão do Produto
SuperSeller IA é uma plataforma de inteligência aplicada para sellers de marketplace.
O foco não é “IA bonita”, mas decisões confiáveis, acionáveis e escaláveis.

## 🏗️ Arquitetura Consolidada
- Frontend: Next.js (app.superselleria.com.br)
- Backend: Fastify + App Runner (api.superselleria.com.br)
- Banco: PostgreSQL
- Jobs internos protegidos por X-Internal-Key
- Automação: EventBridge Scheduler (aws_scheduler_*)

## 🔐 Segurança
- INTERNAL_JOBS_KEY armazenado no Secrets Manager
- Injetado no App Runner da API
- Middleware internal-auth valida header X-Internal-Key

## 📊 Dados
- Métricas diárias materializadas em listing_metrics_daily
- Rebuild idempotente via endpoint interno
- Cron ainda não ativo (dependente do Scheduler)

## 🧭 Decisões Importantes
- IA não calcula score
- Score vem de regras determinísticas
- IA apenas explica, reescreve e contextualiza
- Clip/vídeo tratado como conceito único
- Nenhuma feature nova antes de confiabilidade total dos dados

### Decisões técnicas (visits)
- **Visitas:** `0` apenas quando fetch ok e dia ausente no mapa; erro → `NULL`
- **Parser:** extrai na ordem: `entry.visits` → `entry.total` → soma de `visits_detail[].quantity`
- **Normalização:** datas ISO convertidas para `YYYY-MM-DD` UTC antes de salvar no map

### Decisões técnicas (orders)
- **Limit clamp:** `limit` nunca excede 51 (ML API não aceita > 51)
- **Erro 400:** não interrompe refresh de metrics/visits; apenas 401/403 interrompem com `reauth_required`
- **Fallback:** quando filtro retorna 0, busca últimos pedidos sem filtro e filtra localmente

## 🧭 Roadmap (alto nível)
- ONDA 1/2: Score V2 + UX (concluído)
- ONDA 3: IA como amplificador (em progresso)
- Operação: jobs internos + scheduler (fase atual, crítico para clientes reais)
- Próxima épica: Benchmark/Ads/Automações (após dados e operação sólidos)



## ✅ Estado atual (2026-01-22)
### Produção
- Deploy está verde.
- Dashboard Overview está funcionando para:
  - totalListings, activeListings, stock, pedidos e receita
  - série diária contínua (periodDays dias) em UTC
  - **Visitas exibidas no gráfico com valores > 0** ✅
- Conexão Mercado Livre:
  - tratada com `reauth_required`
  - callback com diagnóstico + códigos de erro
  - migrations aplicadas em PROD
  - **Múltiplas conexões no banco:** sistema usa sempre a conexão `active` mais recente
  - **Atenção:** divergências de `sellerId` entre conexões podem explicar diferenças em orders

### Data pipeline
- `orders` + `order_items`: OK
- `listing_metrics_daily.orders/gmv`: OK
- `listing_metrics_daily.visits`: ✅ **RESOLVIDO** — valores > 0 no DB e UI

## 🔥 Prioridade Zero (base do produto)
**ML Data Audit (confiabilidade dos dados) — visits corrigido e validado** ✅

Status: Visits funcionando. Próximo foco: estabilizar orders quando connection active muda de sellerId.

## 📌 Decisões importantes já tomadas
- Score e ações determinísticas (regras) vêm antes de LLM.
- Não automatizar liga/desliga do ambiente agora; criar runbook manual para reduzir custo.

## 🧭 Próxima entrega crítica
✅ **VISITS reais no banco (valores > 0) e exibidos no overview** — CONCLUÍDO

Próximo: Validar comportamento de orders quando connection active muda de sellerId.

## 🚀 Plano épico aprovado (próxima fase)
### ONDA 1 — IA SCORE V2 (AÇÃO + EXPLICABILIDADE)
- Backend Action Engine (ScoreActionEngine.ts)
- explainScore()
- Payload enriquecido no /ai/analyze/:listingId com actionPlan e scoreExplanation
- Testes obrigatórios

### ONDA 2 — UX do Score
- Breakdown interativo com tooltips
- Action Plan com priorização, CTA

### ONDA 3 — IA como amplificador (Devin)
- IA explica plano (sem contradizer regras)
- IA reescreve SEO com base nas regras
