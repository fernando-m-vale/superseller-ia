# PROJECT CONTEXT — SuperSeller IA
Atualizado em: 2026-03-12

## 🧠 Visão do Produto
SuperSeller IA é uma plataforma de inteligência aplicada para sellers de marketplace.
O foco não é "IA bonita", mas decisões confiáveis, acionáveis e escaláveis.

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
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos
- **Descrição é feature central:** Descrição curta = BUG de produto
- **Prompt especialista é o padrão:** V1 oficialmente aposentado
- **Todo output deve ser "pronto para aplicar"**

## 🔐 Aprendizado Crítico — Integrações Mercado Livre
- **Pode haver múltiplas conexões ML por tenant:** Banco de dados pode conter 2+ conexões com `type='mercadolivre'` e mesmo `tenant_id`
- **Toda lógica deve usar resolver determinístico:** `resolveMercadoLivreConnection()` com critérios explícitos (access_token válido → refresh_token disponível → mais recente)
- **Nunca assumir que findFirst retorna a conexão correta:** Sem ordenação explícita, seleção é não-determinística
- **Token válido ≠ refresh_token obrigatório:** Helper `getValidAccessToken()` usa refresh apenas quando necessário (access_token expirado)
- **Dados "não detectáveis" devem ser tratados como null, nunca como false:** `hasClips = null` quando API não permite confirmar; usar `false` afirma ausência sem certeza
- **Esse aprendizado vira regra de arquitetura para futuras integrações (Shopee, etc):** Padrão aplicável a qualquer marketplace

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

### Decisões arquiteturais (Análise IA Expert)
- **Prompt ml-expert-v1 é o padrão:** V1 oficialmente aposentado, sem fallback
- **Cache de análise por listing:** Evita custos desnecessários com OpenAI; regeneração automática quando `analysisV21` ausente
- **Regeração manual sob demanda:** Botão "Regerar análise" permite forçar nova análise quando necessário
- **Controle de custo OpenAI:** Cache é crítico; sistema respeita cache existente e só regenera quando necessário
- **Integração orientada a versionamento de prompt:** `PROMPT_VERSION = 'ml-expert-v1'` para invalidação de cache
- **Normalização snake_case → camelCase:** Frontend usa dados normalizados para facilitar uso
- **Preparação para IA visual futura:** Armazenar `pictures_json`, `pictures_count` sem análise visual por IA neste momento (decisão consciente para evitar complexidade prematura)

## 📐 Fluxo atual da análise de anúncio

```
Veredito
    ↓
Diagnóstico do funil (SEARCH → CLICK → CONVERSION)
    ↓
Ganho potencial da rodada
    ↓
Plano de execução recomendado (3 passos)
    ↓
Cards de ação
    ↓
Detalhes executáveis (modal sob demanda)
```

| Bloco | Propósito |
|-------|-----------|
| **Veredito** | Resumo claro e acionável do estado do anúncio |
| **Diagnóstico do funil** | Identifica em qual estágio (busca, clique, conversão) está o gargalo |
| **Ganho potencial** | Estimativa de impacto da rodada de melhorias |
| **Plano de execução** | 3 passos ordenados por gargalo + impacto + esforço |
| **Cards de ação** | Ações priorizadas com badge de gargalo e impacto estimado |
| **Detalhes executáveis** | Conteúdo operacional (como fazer, copy, checklist) sob demanda |

### Capacidades atuais

- Diagnóstico de gargalo **SEARCH / CLICK / CONVERSION**
- Hipótese consultiva do problema dominante
- Plano de execução com priorização (gargalo + impacto + esforço)
- Estimativa de impacto por ação (com multiplicador quando resolve o gargalo)
- Geração de títulos sugeridos
- Geração de descrição sugerida
- Oportunidades extras (hacks Mercado Livre)

### Decisão recente — Clip fora da experiência do usuário

A **análise automática de clip foi removida da experiência do usuário** por inconsistências na detecção. O sistema pode manter detecção interna para outros fins, mas **não exibe nem recomenda clip** no produto.

---

## Limitações atuais da análise
- **Personalização de título e descrição** — Dia 14 backend implementado (causa raiz, confiança, prioridade); **camada de ação/consultoria refinada e concluída como saneamento da Action Layer** (Dia 14.1).
- **Discovery endpoint** bloqueado em alguns fluxos (fallback por orders); **atributos comerciais** ausentes em parte dos anúncios da categoria; **score visual** concentrado em faixa alta no conjunto testado; **oportunidade futura:** alertas de ROAS negativo.
- **Operação — freshness/jobs**: investigação do comportamento real (lock_key/scheduler/JobRunner) concluída parcialmente; correção mínima segura ainda pendente de decisão.

---

## Nova direção estratégica — Três pilares

A evolução do SuperSeller IA foca em **três pilares principais** de sucesso em marketplace:

| Pilar | Responsabilidade |
|-------|------------------|
| **TÍTULO** | Descoberta nas buscas |
| **IMAGEM** | Clique no anúncio |
| **DESCRIÇÃO** | Decisão de compra e SEO interno |

Outros fatores continuam relevantes (categoria, preço, promoções, logística, atributos), mas **só impactam depois** que os três pilares estão bem estruturados.

---

## Visão estratégica — Execução Assistida / 1-Click Fix

**Decisão estratégica:** O maior salto de valor futuro continua sendo **Execução Assistida / 1-Click Fix**. Antes disso, o produto precisa entregar de forma excelente: **diagnóstico**, **priorização**, **clareza** e **ação recomendada**. O gap atual não é falta de dados (Data/Visual/Ads Intelligence validados); é transformar a inteligência em ações claras, cards diretos e linguagem útil para o seller na tela.

---

## 🧭 Roadmap (alto nível)

➡️ **Referência ativa:** `docs/ROADMAP.md`

- ✅ ONDA 1/2: Score V2 + UX (concluído)
- ✅ ONDA 3: IA como amplificador (concluído)
- ✅ Dia 09: Consultant Engine V3 + Bottleneck + Opportunity Impact + Execution Roadmap
- ✅ **Dia 10 — UX Premium:** CONCLUÍDO
- ✅ **Dia 11 — Data Layer + Jobs:** CONCLUÍDO (validado em produção — 21/21 testes PASS)
- ✅ **Dia 12 — IA Visual:** CONCLUÍDO (validado em produção)
- ✅ **Dia 13 — Ads Intelligence:** CONCLUÍDO (validado em produção)
- 🔄 **Dia 14 — Refinamento da IA:** IMPLEMENTADO NO BACKEND; fase de refinamento final na camada de ação/consultoria
- ✅ **Dia 14.1 — Action Layer Refinement:** concluído como saneamento da Action Layer (seller-friendly + alinhamento end-to-end)

**Próxima fase (pós-14.1):** Recommendation Engine V2 + validação real; paralelamente, tratar freshness/jobs como risco operacional

Referência completa: `docs/ROADMAP.md`. Contexto Dia 14: `docs/DIA14_REFINEMENT_CONTEXT.md`. Escopo Dia 14.1: `docs/DIA14_1_ACTION_LAYER_REFINEMENT.md`.

---

## Estado Atual do Produto

O produto possui **Data Intelligence**, **Visual Intelligence**, **Ads Intelligence** e **Root Cause Intelligence** (backend implementado), com a **camada consultiva já refinada** (Dia 14.1 concluído como saneamento da Action Layer).

### Engine 1 — Data Intelligence

- Sync de marketplace (visitas, pedidos, promoções, preço)
- Métricas persistidas; dataFreshness no analyze
- Estruturação de logística real, atributos comerciais, semântica de preço/promo
- Reputação/prova social e histórico enxuto de conteúdo/mídia na análise

### Engine 2 — Visual Intelligence

- Análise da imagem principal (VisualAssetResolver, VisualSignalsBuilder, VisualAnalysisLLMService, VisualAnalysisNormalizer, VisualAnalysisRepository, VisualAnalysisOrchestrator)
- Tabela própria de análise visual; cache por image_hash + prompt_version
- Score visual, critérios e melhorias; card no frontend; persistência e cache validados em produção

### Engine 3 — Ads Intelligence

- Fundação de Ads Intelligence; investigação real de Mercado Ads
- Advertiser discovery real; Product Ads acessível com OAuth; associação item_id/listing_id
- Ingestão real de Product Ads; persistência em listing_ads_metrics_daily
- Bloco adsIntelligence no analyze; card Ads Intelligence no frontend
- Status available / partial / unavailable funcionando corretamente

### Sinais disponíveis para a IA

- **Sinais de imagem** (visual)
- **Sinais de ads** (campanhas, métricas de ads)
- **Sinais comerciais** (preço, promoções, atributos)
- **Sinais de atributos** (comerciais por categoria)
- **Sinais sociais** (reputação, prova social)
- **Sinais de pricing/promotions** (semântica limpa)

### Painel de análise (fluxo unificado)

- Veredito → Diagnóstico do funil → Ganho potencial → Plano de execução → Cards de ação → Detalhes executáveis
- Diagnóstico de gargalo SEARCH/CLICK/CONVERSION; plano priorizado; estimativa de impacto; geração de títulos e descrição; hacks ML; ScoreActionEngine e ActionDetails (V1/V2). Clip não exibido na UX (decisão por inconsistência na detecção).

---

## Camada de Execução Assistida (Modelo B)

Esta é a camada que transforma "diagnóstico" em **execução guiada**, com foco em produto premium e controle de risco/custo.

### Separação entre ação estrutural e plano detalhado

- **Ação estrutural (listing_actions)**: título/descrição curtos + status (A_IMPLEMENTAR/IMPLEMENTADO/DESCARTADO) + metadados (prioridade/impacto).
- **Plano detalhado (action details)**: conteúdo longo e operacional exibido apenas sob demanda (por que importa, como fazer, checklist, copy, benchmark).

### Geração sob demanda

- O frontend só busca detalhes quando o usuário clica em **“Detalhes / Ver como fazer”**.
- Evita poluir o Kanban e mantém UX rápida.

### Cache por actionId

- Persistir `details_json` por (`listingId`, `actionId`) e versionar por `prompt_version`.
- Permite **cache hit** imediato e reduz chamadas repetidas.

### Controle de custo LLM

- Lazy generation (gera apenas quando solicitado)
- Cache persistido
- TTL/invalidations quando houver nova análise (novo batch) ou mudança de prompt
- Rate-limit por tenant (se necessário)

### Evolução futura (execução automática)

- O Modelo B prepara o caminho para execução real via API:
  - consentimento explícito
  - histórico e auditoria
  - rollback
  - feature premium (DIA 16–18)

## 🧠 Estado atual do produto (2026-02-XX — Pós-HOTFIX DIA 09.5 + 09.6)

**Dia atual do projeto:** DIA 09 + HOTFIX 09.5 + 09.6 implementados (validação PROD pendente)  
**Fase ativa:** Aguardando validação final em PROD → Fechamento DIA 09 → Início DIA 10  
**Status:** Produto entrega valor prático imediato — diagnóstico, priorização inteligente (Top 3), conteúdo gerado contextual, promo confiável, execução assistida funcional, robustez de mídia/preço, sincronização automática multi-tenant, HackEngine v1 com feedback persistente, UX 2.0 dos cards, Opportunity Score + Prioridade

- **SuperSeller IA agora possui:**
  - ✅ **Diagnóstico:** Análise profunda de anúncio com IA especialista
  - ✅ **Priorização inteligente (Top 3):** rankGaps() com regra dura (máx 3 criticalGaps), ordenação por Impact DESC → Effort ASC → Confidence DESC
  - ✅ **Conteúdo gerado contextual:** Títulos, bullets, descrição prontos para copy/paste
  - ✅ **Promo confiável:** Anti-regressão implementada, TTL + feature flag, observabilidade completa, sem cálculo (fonte única de verdade)
  - ✅ **Dashboard consistente:** Visits, orders, gmv separados e confiáveis
  - ✅ **Execução Assistida:** Botão "Registrar como aplicado", modal antes/depois, badge "Implementado", Plano de Execução navegável
  - ✅ **Robustez de mídia:** Clips com tri-state (true/false/null), detecção robusta, persistência "true é sticky"
  - ✅ **Infra com power orchestration:** Lambda orchestrator, CodeBuild para NAT, RDS controlado

- **Dia 6 concluído:** Execução Assistida (ApplyAction + Clips + Promo + Plano + Badges)
  - **Backend:** AppliedActionService, rota apply-action com validação flexível, ml-video-extractor tri-state, promo sem cálculo, filtro appliedActions por análise
  - **Frontend:** Botões "Registrar como aplicado", ApplyActionModal, badges "Implementado", estado local imediato, Plano navegável
  - **Hotfixes:** CI fix (req.tenantId), clips robustez, promo sem fallback, badges reset correto

- **Dia 7 concluído:** Cadastro Manual + Anúncios sem Venda
  - **Backend:** Endpoint POST /api/v1/listings/import, validação de MLB ID, sync inicial automático
  - **Frontend:** Botão "Adicionar anúncio", modal de import, tratamento de anúncios sem métricas

- **Dia 9 concluído (implementações):** HackEngine v1 + Feedback + UX 2.0 + Opportunity Score
  - **Backend:** SignalsBuilder, HackEngine v1 (5 hacks determinísticos), ListingHacksService (feedback persistente), CategoryBreadcrumbService (cache 24h)
  - **Frontend:** HackCardUX2 (UX 2.0), HacksPanel (ordenação + Top 3), Opportunity Score helper (cálculo determinístico)
  - **Hotfixes:** 09.1 (signals variations + full gate + feedback ui), 09.2 (variations_count DB + fetch-latest), 09.3 (loop fix), 09.4 (payload normalization), 09.5 (UX 2.0 + categoria acionável), 09.6 (Opportunity Score + prioridade)
  - **Status:** Implementações concluídas, validação PROD pendente (ver `docs/RUNBOOK_VALIDATION_DAY09.md`)
  - **Score Engine:** Proteção contra divisão por zero, performanceScore = 0 quando sem dados

- **Dia 8 concluído:** Jobs Automáticos Multi-tenant
  - **Backend:** JobQueue interface, DbJobQueue, JobRunner, TenantSyncOrchestrator, ListingSyncWorker
  - **Infra:** Locks + cooldowns, dedupe por lock_key, timestamptz(3), índice único parcial
  - **Frontend:** Auto-sync com guard, polling controlado, SyncStatusBar
  - **Hotfixes:** Request storm, timezone inconsistente, dedupe TENANT_SYNC, self-lock
  - **Status:** ✅ Implementação completa e validada em produção

- **Dia 9 concluído:** HackEngine v1 — Hacks ML Contextuais e Reais
  - **Backend:** SignalsBuilder determinístico, HackEngine v1 (5 hacks), ListingHacksService, persistência de feedback
  - **Frontend:** HacksPanel com tooltip Confidence, botões de feedback funcionais
  - **Hotfix 09.1:** Correção SignalsBuilder (variationsCount), gate adicional para ml_full_shipping, UI feedback corrigida, padronização "clip", tooltip Confidence
  - **Status:** ✅ Implementação completa, ⏳ Validação final pendente (MINI-CHECKLIST)

- **Decisão estratégica:** Produto deixa de ser "auditor" e passa a ser "consultor estratégico baseado em dados" com hacks específicos e acionáveis

**Limitação atual:**
- Benchmark ML ainda depende de desbloqueio 403 (fora do controle atual)
- Pequeno desalinhamento de fuso (-1 dia) tolerado temporariamente
- HOTFIX DIA 09.1 aguardando validação final (MINI-CHECKLIST)

**Estado Atual do Produto:**
- ✅ **ML Data Audit:** Concluído — dados confiáveis e auditáveis
- ✅ **Score Engine:** Estável — cálculo determinístico sem alucinações
- ✅ **Benchmark:** Fallback controlado — funciona mesmo com 403
- ✅ **HackEngine v1:** Implementado — 5 hacks específicos e acionáveis
- ✅ **Feedback persistente:** Ativo — sistema respeita histórico do usuário
- ✅ **Hotfix 09.1:** Aplicado — correções de validação implementadas
- ✅ **Sistema pronto para fase comercial:** Todas as funcionalidades core implementadas

**Produto já entrega valor prático imediato com execução assistida funcional, sincronização automática validada, e HackEngine v1 com feedback persistente.**

## Estado Atual — Sync Engine (Dia 08)

**Arquitetura atual:**
- Driver de fila: DB (preparado para SQS)
- JobRunner embutido na API (ENABLE_JOB_RUNNER=true)
- Locks por tenant e por listing
- Cooldowns:
  - Auto-sync: 24h
  - Manual-sync: 15min
  - Listing-sync: 10min

**Decisão estratégica:**
Manter DB Queue até:
- Crescimento real de tenants (necessidade de escala)
- Necessidade de desacoplamento via SQS/EventBridge

**Status:**
- ✅ Implementação técnica completa
- ✅ Hotfixes aplicados (timezone, dedupe, request storm)
- ⏳ Validação final em produção pendente

## ⚠️ PROBLEMAS ABERTOS (INFRA/DEPLOY — NÃO CONCEITUAIS)

### 1️⃣ Inconsistência de rotas em produção (INFRA/DEPLOY)
**Status:** 🔴 BLOQUEADOR DE VALIDAÇÃO

Endpoints novos retornam 404 em produção:
- `POST /api/v1/sync/mercadolivre/listings/:listingIdExt/force-refresh`
- `GET /api/v1/ai/debug-payload/:listingIdExt`
- `GET /api/v1/meta`

**Endpoint antigo funciona:** `/api/v1/sync/mercadolivre/refresh`

**Causa raiz (suspeita):**
- Problema de deploy/gateway/envoy/cache
- Rotas podem não estar sendo registradas corretamente em produção
- Mismatch entre código deployado e código em execução

**Ação necessária:**
- Validar qual serviço está rodando atrás de `api.superselleria.com.br`
- Usar `/sync/status` vs `/meta` para identificar mismatch
- Verificar logs de inicialização da API em produção
- Confirmar que build incluiu novos arquivos de rotas

## ✅ Estado atual (2026-01-27)
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

### Análise IA
- **Prompt ml-expert-v1 ativo:** Sistema usa exclusivamente prompt especialista
- **Cache funcional:** Regeneração automática quando `analysisV21` ausente
- **Normalização implementada:** Frontend recebe dados em camelCase
- **Modal renderiza dados reais:** verdict, titleFix, descriptionFix, imagePlan, priceFix, algorithmHacks, finalActionPlan
- **Análises diferem por anúncio:** Bug crítico de listing incorreto resolvido

## 🔥 Prioridade Zero (base do produto)
**ML Data Audit (confiabilidade dos dados) — CONCLUÍDO** ✅

Status: 
- ✅ **Visits funcionando** — dados confiáveis, 0 NULL quando fetch ok
- ✅ **Sistema resiliente a bloqueios da API ML** — PolicyAgent tratado corretamente
- ✅ **Reconciliação de status** — paused vs active sincronizado
- ✅ **Análise IA operacional** — Prompt Expert ativo, cache funcional, normalização implementada

Próximo foco: **Encerrar Dia 2** — corrigir profundidade de descrição, promoção, vídeo e editUrl.

## 📌 Decisões importantes já tomadas
- Score e ações determinísticas (regras) vêm antes de LLM.
- Não automatizar liga/desliga do ambiente agora; criar runbook manual para reduzir custo.
- **Não ingerir dados quando `access_status != accessible`:** Garante que apenas dados acessíveis são processados
- **Backfill manual por enquanto:** Automação de backfill de visits/metrics será implementada futuramente
- **Multi-conexões:** Sistema usa sempre a conexão `active` mais recente; suporte a múltiplas conexões simultâneas será implementado no futuro
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos; caso contrário → resposta condicional
- **Descrição é feature central:** Descrição curta = BUG de produto; densidade mínima obrigatória definida no prompt
- **Prompt especialista é o padrão:** V1 oficialmente aposentado; todo output deve ser "pronto para aplicar"

## 🆔 Padronização de tenant_id
- **Situação atual:** Inconsistência (TEXT x UUID)
- **Curto prazo:** Cast explícito para compatibilidade
- **Decisão registrada:** Padronizar UUID no domínio
- **Mudança planejada, não urgente:** Não é bloqueador atual

## 🚧 Débitos Técnicos (backlog)

### Produto / UX
- **Multi-conexões:** Sistema não suporta múltiplas conexões ativas simultaneamente (usa sempre a mais recente)
- **Inserção manual de anúncios:** Não implementado; sistema depende de sync do Mercado Livre
- **Backfill automático:** Por enquanto, backfill de visits/metrics é manual; automação futura
- **UX com termos técnicos:** "V2.1", "indisponível" precisam refinamento para linguagem de usuário final

### Dados / Engenharia
- **Benchmark ML 403:** Ainda depende de desbloqueio externo (fora do controle atual)
- **Desalinhamento de fuso (-1 dia):** Tolerado temporariamente
- **Reconciliação completa de status:** Job dedicado para verificação periódica
- **Orders x seller_id:** Investigar quando conexão muda de sellerId
- **Limpeza de dados históricos:** Soft delete / reprocess

### Backlog Pós-Dia 10
- Multi-marketplace
- Análise visual de imagens
- Estratégia de Ads
- Execução automática no ML
- Score evolutivo

## 🧭 Próxima entrega crítica
✅ **VISITS reais no banco (valores > 0) e exibidos no overview** — CONCLUÍDO
✅ **Análise IA Expert integrada (backend + frontend)** — TECNICAMENTE FUNCIONAL
⏳ **Encerrar Dia 2:** Corrigir profundidade de descrição, promoção, vídeo e editUrl

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
