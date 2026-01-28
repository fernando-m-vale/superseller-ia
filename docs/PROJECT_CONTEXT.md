# PROJECT CONTEXT — SuperSeller IA
Atualizado em: 2026-01-27

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

### Decisões arquiteturais (access control)
- **Separação de responsabilidades:** `status` (active/paused) vs `access_status` (accessible/unauthorized/blocked_by_policy)
- **Não ingerir dados quando `access_status != accessible`:** Visits/metrics não processam listings bloqueados
- **Reconciliação periódica:** Verifica status real via batch API autenticada (`/items?ids=...`)
- **Não alterar `status` quando bloqueado:** Se PolicyAgent bloqueia, `status` permanece desconhecido (não alterar)
- **Limpeza automática:** Quando listing volta a ser acessível, limpa `access_blocked_*` e marca `access_status='accessible'`

### Decisões arquiteturais (Análise IA V2.1)
- **Cache de análise por listing:** Evita custos desnecessários com OpenAI; regeneração automática quando `analysisV21` ausente
- **Regeração manual sob demanda:** Botão "Regerar análise" permite forçar nova análise quando necessário
- **Controle de custo OpenAI:** Cache é crítico; sistema respeita cache existente e só regenera quando necessário
- **Integração orientada a versionamento de prompt:** `PROMPT_VERSION = 'ai-v2.1'` para invalidação de cache
- **Preparação para IA visual futura:** Armazenar `pictures_json`, `pictures_count` sem análise visual por IA neste momento (decisão consciente para evitar complexidade prematura)

## 🧭 Roadmap (alto nível)
- ONDA 1/2: Score V2 + UX (concluído)
- ONDA 3: IA como amplificador (em progresso)
  - ✅ Análise IA V2.1 (backend + frontend) — **CONCLUÍDO**
  - ⏳ Estabilização e refinamento UX — **EM PROGRESSO**
- Operação: jobs internos + scheduler (fase atual, crítico para clientes reais)
- Próxima épica: Benchmark/Ads/Automações (após dados e operação sólidos)



## 🧠 Estado atual do produto (2026-01-27)
- **SuperSeller IA opera com Análise IA V2.1 como padrão:** V1 foi oficialmente descontinuada
- **Sistema está preparado para escalar IA, dados e UX:** Fundação sólida para evolução futura
- **Cache de análise por listing:** Evita custos desnecessários com OpenAI
- **Backfill manual por decisão consciente:** Automação futura planejada
- **Preparação para IA visual futura:** Dados de imagens armazenados (`pictures_json`, `pictures_count`) sem análise visual ativa

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
- **Access Control:** Listings bloqueados por PolicyAgent marcados corretamente (`access_status='blocked_by_policy'`)
- **Reconciliação:** Status de listings (`active`/`paused`) sincronizado com ML via batch API autenticada

## 🔥 Prioridade Zero (base do produto)
**ML Data Audit (confiabilidade dos dados) — CONCLUÍDO** ✅

Status: 
- ✅ **Visits funcionando** — dados confiáveis, 0 NULL quando fetch ok
- ✅ **Sistema resiliente a bloqueios da API ML** — PolicyAgent tratado corretamente
- ✅ **Reconciliação de status** — paused vs active sincronizado

Próximo foco: estabilizar orders quando connection active muda de sellerId + estrutura multi-contas.

## 📌 Decisões importantes já tomadas
- Score e ações determinísticas (regras) vêm antes de LLM.
- Não automatizar liga/desliga do ambiente agora; criar runbook manual para reduzir custo.
- **Não ingerir dados quando `access_status != accessible`:** Garante que apenas dados acessíveis são processados
- **Backfill manual por enquanto:** Automação de backfill de visits/metrics será implementada futuramente
- **Multi-conexões:** Sistema usa sempre a conexão `active` mais recente; suporte a múltiplas conexões simultâneas será implementado no futuro

## 🆔 Padronização de tenant_id
- **Situação atual:** Inconsistência (TEXT x UUID)
- **Curto prazo:** Cast explícito para compatibilidade
- **Decisão registrada:** Padronizar UUID no domínio
- **Mudança planejada, não urgente:** Não é bloqueador atual

## 🚧 Riscos conhecidos (backlog)
- **Multi-conexões:** Sistema não suporta múltiplas conexões ativas simultaneamente (usa sempre a mais recente)
- **Inserção manual de anúncios:** Não implementado; sistema depende de sync do Mercado Livre
- **Backfill automático:** Por enquanto, backfill de visits/metrics é manual; automação futura
- **UX com termos técnicos:** "V2.1", "indisponível" precisam refinamento para linguagem de usuário final

## 🧭 Próxima entrega crítica
✅ **VISITS reais no banco (valores > 0) e exibidos no overview** — CONCLUÍDO
✅ **Análise IA V2.1 integrada (backend + frontend)** — CONCLUÍDO

Próximo: Estabilizar completamente V2.1 (finalizar pendências do Dia 2).

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
