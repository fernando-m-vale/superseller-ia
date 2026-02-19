# DAILY EXECUTION LOG — 2026-02-19 (HOTFIX DIA 09.1 — Correções de Validação)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do hotfix
**Correções de problemas encontrados na validação do HackEngine v1 em PROD**

## 📌 Problemas enfrentados (antes)
- UI: botões Confirmar/Não se aplica não clicáveis (ou não disparavam request)
- Hack 1 (Full) aparecia com shippingMode: unknown — recomendação genérica
- Hack 3 (Variações) sugerido mesmo com anúncio tendo muitas variações (ex.: 11) → SignalsBuilder lendo variações errado
- "Vídeo/Clip" inconsistente: sistema sugeria vídeo/clip mesmo quando anúncio tem vídeo (bug de nomenclatura ou detecção)
- UX: Confidence aparecia como número sem explicação — precisava legenda/tooltip

## 🔧 Implementações (entregas do hotfix)

### A) Backend — Fix SignalsBuilder (Variações)
- ✅ Extração de `variationsCount` corrigida: tenta extrair de `pictures_json` ou default 0
- ✅ `hasVariations` calculado corretamente: `variationsCount > 0`
- ✅ Teste atualizado para garantir que `variationsCount === 11` quando há 11 variações

### B) Backend — Gate para Hack 1 (Full) quando shippingMode unknown
- ✅ Gate adicionado: Se `shippingMode === 'unknown'` E `isFullEligible !== true` → omit
- ✅ Regra especial: Se `shippingMode === 'unknown'` MAS `isFullEligible === true` → permitir com confidence cap ≤ 35
- ✅ Teste unitário adicionado para validar gate

### C) Frontend — Fix botões não clicáveis (feedback)
- ✅ Botões corrigidos: `onClick` com `e.preventDefault()` e `e.stopPropagation()`
- ✅ `z-index` ajustado: `relative z-10` nos botões
- ✅ Loading state melhorado: mostra "Processando..." durante request
- ✅ Toast de sucesso/erro funcionando
- ✅ Estado persistido após reload (recarrega history)

### D) Frontend/Backend — "Vídeo" vs "Clip"
- ✅ Padronização: usar termo "clip" consistentemente (não "vídeo" ou "clip (vídeo)")
- ✅ `media-verdict.ts` atualizado: todas as mensagens usam apenas "clip"
- ✅ Comentários atualizados para refletir padronização

### E) UX — Legenda/Tooltip do Confidence
- ✅ Tooltip adicionado ao lado do badge de Confidence
- ✅ Texto explicativo: "A confiança do sistema na recomendação, baseada nos dados do anúncio..."
- ✅ Legenda de bandas: Alta (≥70%), Média (40-69%), Baixa (0-39%)
- ✅ Componente Tooltip reutilizável (shadcn/radix)

### F) Documentação
- ✅ `HACK_ENGINE_CONTRACT.md` atualizado:
  - Seção "Confidence — como interpretar" adicionada
  - Gates do Hack 1 (Full) atualizados com regra de shippingMode unknown
  - Tabela-resumo atualizada
- ✅ `DAILY_EXECUTION_LOG.md` atualizado com entrada do hotfix

## 🧪 Evidências / Testes executados (após)
- ✅ Botões feedback clicáveis e funcionando (Network mostra request)
- ✅ Após confirm/dismiss, UI atualiza e persiste após reload
- ✅ Hack "Variações" NÃO aparece quando variationsCount >= 5 (ex.: 11)
- ✅ Hack "Full" NÃO aparece quando shippingMode unknown e isFullEligible != true
- ✅ Texto "clip" consistente (sem falar "vídeo" indevidamente)
- ✅ Tooltip/legenda de Confidence presente e clara
- ✅ Testes unitários atualizados/passing (API + Web build)

## 📌 Status do HOTFIX DIA 09.1
✅ **CONCLUÍDO**
- ✅ Todas as correções implementadas
- ✅ Documentação atualizada
- ✅ Builds passando

**Critérios de aceite (DoD):**
1. ✅ Botões feedback clicáveis e funcionando
2. ✅ Após confirm/dismiss, UI atualiza e persiste após reload
3. ✅ Hack "Variações" NÃO aparece quando variationsCount >= 5
4. ✅ Hack "Full" NÃO aparece quando shippingMode unknown e isFullEligible != true
5. ✅ Texto "clip" consistente
6. ✅ Tooltip/legenda de Confidence presente e clara
7. ✅ Testes unitários atualizados/passing

## 🔄 Estado Atual do Sistema (Pós-HOTFIX 09.1)

### Builds e Infraestrutura
- ✅ Build API passando (`pnpm --filter @superseller/api build`)
- ✅ Build Web passando (`pnpm --filter web build`)
- ✅ Migration aplicada (`20260219000000_add_listing_hacks`)

### Funcionalidades
- ✅ Feedback persistente: sistema salva e respeita histórico de hacks
- ✅ Gates atualizados: Hack 1 (Full) com gate adicional para shippingMode unknown
- ✅ Tooltip implementado: Confidence com explicação e bandas
- ✅ UI corrigida: botões de feedback funcionando corretamente

### Documentação
- ✅ `HACK_ENGINE_CONTRACT.md` alinhado com correções
- ✅ `DAILY_EXECUTION_LOG.md` atualizado
- ✅ `NEXT_SESSION_PLAN.md` atualizado

## ⏸️ Pendência Intencional

**Aguardar execução do MINI-CHECKLIST de validação final amanhã antes de declarar DIA 09 oficialmente fechado.**

O hotfix foi implementado e testado em desenvolvimento, mas é necessário validar em ambiente de produção/staging antes de considerar o DIA 09 completamente encerrado.

**Próxima ação:** Executar MINI-CHECKLIST HOTFIX 09.1 na próxima sessão.

---

# DAILY EXECUTION LOG — 2026-02-19 (Dia 9 — HackEngine v1 Completo)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**HackEngine v1 — Sistema determinístico de hacks contextualizados baseados em dados reais do anúncio**

## ✅ Entregas realizadas

### Backend
- ✅ Prisma model `listing_hacks` criado com campos e índices
- ✅ Migration `20260219000000_add_listing_hacks` criada
- ✅ SignalsBuilder implementado (extração determinística de signals)
- ✅ `isKitHeuristic` implementado (determinístico, sem LLM)
- ✅ HackEngine v1 com 5 hacks e confidence scoring
- ✅ ListingHacksService para persistir feedback
- ✅ Endpoint `POST /api/v1/listings/:listingId/hacks/:hackId/feedback`
- ✅ Integração no endpoint analyze (fresh e cache)

### Frontend
- ✅ Componente `HacksPanel` criado
- ✅ Integração no `ListingAIAnalysisPanel`
- ✅ Botões "Confirmar implementação" e "Não se aplica"
- ✅ Badges de impact e confidence
- ✅ Estado persistido após feedback

### Documentação
- ✅ `docs/HACK_ENGINE_CONTRACT.md` criado (contrato completo)
- ✅ Testes unitários para SignalsBuilder e HackEngine
- ✅ Documentação atualizada (ARCHITECTURE_DECISIONS, NEXT_SESSION_PLAN)

## 🧠 Decisão estratégica
**Sistema agora gera hacks específicos e acionáveis baseados em dados reais, não genéricos. 100% determinístico, auditável e preparado para futura automação.**

## 📌 Problemas enfrentados (antes)
- Hacks genéricos não agregavam valor real
- Sistema não respeitava histórico do usuário
- Confidence não era determinística
- Sem persistência de feedback

## 🔧 Implementações (entregas do dia)

### A) SignalsBuilder
- Extração determinística de signals de listing, pricing, shipping, metrics, benchmark
- `isKitHeuristic` implementado com regras explícitas (sem LLM)
- Interface `ListingSignals` completa

### B) HackEngine v1
- 5 hacks implementados com regras detalhadas:
  - `ml_full_shipping`: Gates, pontuação, blocking
  - `ml_bundle_kit`: Gates, pontuação, impact dinâmico
  - `ml_smart_variations`: Pontuação baseada em signals
  - `ml_category_adjustment`: Gates, blocking, pontuação
  - `ml_psychological_pricing`: Gates, pontuação, impact dinâmico
- Confidence scoring com bandas fixas (0-39/40-69/70-100)
- Respeita histórico (confirmed nunca sugere, dismissed 30d cooldown)

### C) Persistência de Feedback
- Model `listing_hacks` com status `confirmed`/`dismissed`
- Service para salvar e buscar histórico
- Endpoint REST para feedback

### D) Integração no Analyze
- HackEngine integrado no fluxo de análise (fresh e cache)
- Retorna `growthHacks` e `growthHacksMeta` no payload
- Não quebra análise se hacks falharem (graceful degradation)

### E) UI Frontend
- Componente `HacksPanel` com cards por hack
- Badges de impact e confidence
- Botões de feedback com estado persistido
- Integrado no `ListingAIAnalysisPanel`

## 🧪 Evidências / Testes executados (após)

### Desenvolvimento
- ✅ Migration criada
- ✅ Prisma generate executado
- ✅ Build API passando
- ✅ Build WEB passando
- ✅ Testes unitários criados (SignalsBuilder e HackEngine)

### Testes Unitários
- ✅ `isKitHeuristic`: palavras-chave, variações, case-insensitive
- ✅ `buildSignals`: construção básica, isKitHeuristic
- ✅ `generateHacks`: gates, histórico, cenários completos
- ✅ Cooldown 30 dias: dismissed < 30d não sugere, >= 30d pode sugerir

## 📌 Status do Dia 09
✅ **CONCLUÍDO**
- ✅ Implementação técnica completa
- ✅ UI integrada
- ✅ Documentação completa
- ✅ Testes unitários criados

**Critérios de aceite (DoD):**
1. ✅ Hacks aparecem para um anúncio real
2. ✅ Confidence coerente com regras (bandas 0-39/40-69/70-100)
3. ✅ Feedback persistido e respeitado
4. ✅ Engine nunca sugere hack dismissed (<30d) ou confirmed
5. ✅ Documentação completa gerada
6. ✅ Testes unitários determinísticos
7. ✅ UI com confirmação e estado persistido
8. ✅ Build verde (API e WEB)

## 📋 Backlog / Débitos técnicos gerados (não bloqueadores)
- Extrair shipping mode de listing (hoje null)
- Extrair variationsCount de listing.pictures_json
- Extrair p25/p75 de benchmark (hoje null)
- Melhorar evidências com mais dados contextuais
- Automação futura: integrar com APIs do ML para aplicar hacks automaticamente

## ➡️ Próximo passo claro
**DIA 10 — Empacotamento Comercial + Go Live**
- Landing simples
- Planos (Starter / Growth / Pro)
- Onboarding guiado
- Primeiro anúncio analisado automaticamente
- Lista de espera / early users

---

# DAILY EXECUTION LOG — 2026-02-18 (Dia 8 — Fechamento: HOTFIX lock_running + Migration PROD)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Fechamento do DIA 08 — Validação final em produção com critérios objetivos PASS/FAIL**

## ✅ Validações Executadas

### 1. Bug Self-Lock Corrigido
- **Problema original:** JobRunner se auto-bloqueava após `dequeue()`, marcando jobs como `skipped` com erro `Lock ativo: lock_running`
- **Correção aplicada:** Removido `checkLock` do JobRunner após `dequeue()` (commit `808ed02`)
- **Deploy baseline:** `2026-02-18 17:42:30 UTC`
- **Validação:**
  - Query executada: Contar skipped lock_running antes/após deploy
  - Resultado: ANTES DO DEPLOY = 10 (históricos), APÓS O DEPLOY = 0 ✅
  - **Critério PASS:** ✅ 0 ocorrências após deploy

### 2. Migration Aplicada em PROD
- **Migration:** `20260214000000_fix_sync_jobs_timezone_and_dedupe`
- **Status:** Aplicada com sucesso
- **Evidência:**
  - `finished_at = 2026-02-18 21:00:25.504304+00` (UTC)
  - `applied_steps_count = 1`
- **Resultado:** ✅ Timestamps convertidos para `timestamptz(3)`, índice único parcial criado

### 3. Índice Único Parcial Criado
- **Índice:** `sync_jobs_lock_key_unique`
- **Definição:** `CREATE UNIQUE INDEX ... ON sync_jobs(lock_key) WHERE status IN ('queued','running')`
- **Status:** ✅ Presente em PROD

### 4. JobRunner Funcionando
- **Health endpoint:** `/api/v1/sync/jobs/health` retorna `jobRunnerEnabled: true`, `driver=db`
- **Stats:** `success=11`, `skipped=3`, `error=0`
- **Status:** ✅ Funcionando corretamente

### 5. Listings Sincronizando
- **Evidência:** `listings.last_synced_at` sendo atualizado para anúncios sincronizados
- **Status:** ✅ `last_sync_status = 'success'` para listings sincronizados

## 📊 Critérios de Fechamento (Todos PASS)

1. ✅ JobRunner habilitado e processando jobs
2. ✅ Jobs TENANT_SYNC e LISTING_SYNC completando com success
3. ✅ **0 skipped lock_running após deploy** (confirmado via query SQL)
4. ✅ Listings.last_synced_at sendo atualizado
5. ✅ **Migration 20260214000000 aplicada no PROD** (finished_at preenchido)

## ⚠️ Pendência (Housekeeping — Não Bloqueador)

**Secret `prod/DB_URL` no Secrets Manager:**
- Secret estava com placeholder literal `<DB_ENDPOINT>`
- Devin usou `prod/DB_SSELLERIA` com string correta para aplicar migration
- **Ação corretiva:** Atualizar `prod/DB_URL` para endpoint real: `superseller-prod-db.ctei6kco4072.us-east-2.rds.amazonaws.com`
- **Risco:** Não bloqueador do DIA 08, mas deve ser corrigido para padronização

## 📌 Status do Dia 08
✅ **CONCLUÍDO**
- ✅ Implementação técnica completa
- ✅ Hotfixes aplicados
- ✅ Validação final em produção concluída
- ✅ Todos os critérios objetivos PASS

**Checklist completo:** Ver `docs/DIA08_PROD_VALIDATION_CHECKLIST.md`

---

# DAILY EXECUTION LOG — 2026-02-14 (Dia 8 — Jobs Automáticos Multi-tenant)

## ⏳ STATUS: PARCIALMENTE CONCLUÍDO (Validação Final Pendente)

## 🎯 Foco do dia
**Jobs Automáticos Multi-tenant (Hotfix + Hardening) — Transformar sincronização em sistema robusto, multi-tenant, com dedupe, locks e preparação para escala futura**

## ✅ Entregas realizadas

### Backend
- ✅ Conversão de todos os timestamps críticos para timestamptz(3) (Tenant, Listing, SyncJob)
- ✅ Migration aplicada assumindo UTC para colunas existentes
- ✅ Dedupe TENANT_SYNC por lock_key (verificação antes de criar novo job)
- ✅ Índice único parcial para evitar duplicação (UNIQUE(lock_key) WHERE status IN ('queued','running'))
- ✅ Claim atômico no DbJobQueue usando transação e FOR UPDATE SKIP LOCKED
- ✅ Comparação run_after <= now() consistente usando NOW() no banco
- ✅ Logs estruturados com requestId e tenantId
- ✅ Endpoint /api/v1/sync/jobs/health (debug)
- ✅ Heartbeat do JobRunner (com DEBUG_JOB_RUNNER=1)
- ✅ HOTFIX contra request storm no frontend (fire once guard + polling controlado)

### Frontend
- ✅ Auto-sync com guard (useRef + sessionStorage) para disparar apenas 1x por sessão/tenant
- ✅ Polling inteligente de status (5s quando running, 30s quando idle)
- ✅ SyncStatusBar sem auto-sync interno (apenas exibe status e botão manual)
- ✅ Retry: 0 em todas as mutations/queries para evitar loops

### Infra
- ✅ JobRunner com guard rails (ENABLE_JOB_RUNNER=true)
- ✅ Arquitetura preparada para SQS (interface JobQueue + stub SqsJobQueue)

## 🧠 Decisão estratégica
**Sistema agora possui sincronização automática escalável, preparada para múltiplos tenants e futura migração para SQS/EventBridge. Mantém DB Queue até crescimento real de tenants.**

## 📌 Problemas enfrentados (antes)

### Request Storm
- Frontend disparava múltiplas requisições "auto" em loop, causando "Network Error"
- Auto-sync sem guard re-disparava a cada mudança de status
- Polling agressivo amplificava o problema

### Jobs não processavam
- Múltiplos TENANT_SYNC com status=queued e started_at NULL
- Query run_after <= now() retornava vazio (timezone inconsistente)
- Cálculo now() - last_auto_sync_at gerava valores negativos
- **BUG CRÍTICO:** JobRunner se auto-bloqueava após dequeue (checkLock encontrava o próprio job como "lock ativo")

### Duplicação de jobs
- Request storm gerava 7+ TENANT_SYNC iguais para o mesmo tenant
- Sem dedupe por lock_key

## 🔧 Hotfixes implementados (entregas do dia)

### A) Timezone / Tipos de coluna
- Conversão de todos os campos críticos para timestamptz(3) no Prisma schema
- Migration para converter colunas existentes assumindo UTC
- Comparações de tempo usando NOW() no banco (não no aplicativo)

### B) Dedupe TENANT_SYNC
- Verificação de jobs existentes (queued/running) com mesmo lock_key antes de criar
- Índice único parcial para garantir dedupe mesmo com race conditions
- lock_key inclui tipo: `tenant:${tenantId}:TENANT_SYNC`

### C) Claim atômico de jobs
- DbJobQueue.dequeue usa transação e FOR UPDATE SKIP LOCKED
- Comparação run_after <= NOW() no banco (timezone consistente)
- Atualização atômica de status para 'running'

### D) JobRunner em produção
- Logs explícitos de startup e heartbeat
- Guard rails (ENABLE_JOB_RUNNER=true)
- Endpoint /sync/jobs/health para debug
- **HOTFIX CRÍTICO:** Removido checkLock após dequeue (causava self-lock)

### E) Frontend (Request Storm)
- Auto-sync com fire once guard (useRef + sessionStorage)
- Polling controlado (5s running, 30s idle, retry: 0)
- SyncStatusBar não dispara auto-sync internamente

## 🧪 Evidências / Testes executados (após)

### Desenvolvimento
- ✅ Migration aplicada com sucesso (local)
- ✅ Build passando (API e WEB)
- ✅ Deploy realizado

### Produção (Validação Parcial)
- ✅ **JobRunner habilitado:** `ENABLE_JOB_RUNNER=true` e `JOB_QUEUE_DRIVER=db` configurados
- ✅ **Endpoint health:** `GET /api/v1/sync/jobs/health` retorna `jobRunnerEnabled: true`
- ✅ **Sync manual funcionando:** `POST /api/v1/sync/tenant/manual` retorna `{ started: true, jobId: ... }`
- ✅ **Jobs sendo processados:** Existem `TENANT_SYNC` e `LISTING_SYNC` com `status=success` no banco
- ✅ **Listings atualizando:** `listings.last_synced_at` começou a ser preenchido para alguns anúncios
- ✅ HOTFIX self-lock aplicado (checkLock removido do JobRunner)

### ⚠️ Pontos de Atenção em Produção
- ⚠️ **Jobs skipped lock_running:** Ainda existem alguns jobs com `status=skipped` e `error="Lock ativo: lock_running"` — **A confirmar se são históricos ou novos**
- ⚠️ **Migration pendente:** Migration `20260214000000_fix_sync_jobs_timezone_and_dedupe` aparece com `finished_at NULL` e `applied_steps_count 0` em `_prisma_migrations` — **Suspeita de que NÃO foi aplicada no banco PROD**

## 📌 Status do Dia 08
⏳ **Parcialmente concluído — Validação Final Pendente**
✅ Implementação técnica completa
✅ Hotfixes aplicados
✅ JobRunner funcionando em produção (evidências confirmadas)

**Condições para fechar DIA 08:**
1. ✅ JobRunner habilitado e processando jobs
2. ✅ Jobs TENANT_SYNC e LISTING_SYNC completando com success
3. ⏳ **0 skipped lock_running após deploy** (usar `DEPLOY_END_UTC` em `apps/api/docs/HOTFIX_DIA08_VALIDATION.md`)
4. ✅ Listings.last_synced_at sendo atualizado
5. ⏳ **Migration 20260214000000 aplicada no PROD** (ver `apps/api/docs/HOTFIX_DIA08_VALIDATION.md` seção "Migração PROD")

**Checklist operacional:** Ver `docs/DIA08_PROD_VALIDATION_CHECKLIST.md` (10 minutos para completar)

## 📋 Backlog / Débitos técnicos gerados (não bloqueadores)
- Migração para SQS quando necessário (arquitetura pronta)
- Observabilidade avançada (métricas CloudWatch, alertas)
- Testes automatizados de job processing
- Retry policy configurável por tipo de job

## ➡️ Próximo passo claro
**DIA 08 — Validação Final (Produção): Rodar queries SQL de validação, validar logs do JobRunner, confirmar processamento real de jobs (TENANT_SYNC → LISTING_SYNC → listings.last_synced_at atualizado), validar timestamps após migration, confirmar que dedupe está funcionando, validar que jobs não são mais marcados como skipped por lock_running**

---

# DAILY EXECUTION LOG — 2026-02-12 (Dia 6 — Execução Assistida + Clips + Promo + Plano + Badges)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Execução Assistida (Modo Aplicar Sugestão) — ApplyAction funcional — Robustez de detecção de clips (tri-state) — Promo/preço sem cálculo — Plano de Execução navegável — Reset de badges ao regerar — Badges aparecem imediatamente após aplicar**

## ✅ Entregas consolidadas

### Backend
- ✅ AppliedAction model e migration (Prisma)
- ✅ AppliedActionService com suporte a actionTypes granulares (seo_title, seo_description, media_images, promo_cover_badge, promo_banner) e legados
- ✅ Rota POST /api/v1/listings/:listingId/apply-action com validação flexível e normalização
- ✅ Fix CI: remover req.user?.tenantId, usar req.tenantId (injetado pelo authGuard)
- ✅ ml-video-extractor com tri-state (true/false/null) e proteção contra shape drift
- ✅ Persistência "true é sticky" (não sobrescreve true com null/false)
- ✅ Promo/preço: remover fallback perigoso, buildPromoText não inventa "de X por Y" sem dados da fonte
- ✅ Filtro de appliedActions por analysis.created_at para reset ao regerar
- ✅ Instrumentação de debug (logs estruturados com counts, min/max appliedAt)

### Frontend
- ✅ Botão "Registrar como aplicado" em todos os blocos executáveis (Título, Descrição, Imagens)
- ✅ ApplyActionModal com scroll e footer fixo (DIA 06.3)
- ✅ Badge "Implementado" quando ação aplicada
- ✅ Estado local (localAppliedActions) atualizado imediatamente após aplicar (sem forceRefresh)
- ✅ Plano de Execução com navegação corrigida (section IDs corretos)
- ✅ Scroll robusto com fallback para topo
- ✅ UI de promo: só mostra "de X por Y" quando originalPriceForDisplay existe

## 🧠 Decisão estratégica
**Produto agora permite "execução assistida": usuário vê sugestão, compara antes/depois, confirma e registra. Sistema não publica no ML ainda, mas cria percepção de valor imediato.**

## 📌 Problemas enfrentados (antes)

### ApplyAction
- ApplyAction retornava 400 por divergência de enum/actionType (granular vs legado)
- Validação/normalização inconsistentes entre schema Zod e lógica manual
- CI/Deploy falhando com TS2339: req.user não existe no type FastifyRequest

### Clips
- Sistema sugeria "Adicionar vídeo" mesmo quando anúncio tinha clip publicado
- Detecção instável: shape drift (HTML/string inesperada), permissões (403), falta de evidência positiva

### Promo/Preço
- Em alguns blocos a IA "calculava" e aplicava desconto em cima do preço já com desconto
- Fallback perigoso: originalPriceForDisplay = listing.price quando hasPromotion=true
- Texto promo inventado sem dados da fonte

### Plano de Execução
- Botões "Aplicar" não navegavam para a seção correta (section IDs incorretos)
- Scroll não tinha fallback quando elemento não existia

### Badges
- Regerar análise mantinha badges "Implementado" (deveria resetar)
- Após correção de reset: badges pararam de aparecer mesmo com apply-action 200 (frontend fazia forceRefresh automático e/ou filtro de appliedActions incorreto)

## 🔧 Hotfixes implementados (entregas do dia)

### A) ApplyAction (backend + frontend)
- Backend: aceitar payload flexível (actionType/action_type, beforePayload/before/before_payload, afterPayload/after/after_payload)
- Aceitar actionTypes granulares: seo_title, seo_description, media_images, promo_cover_badge, promo_banner (+ legados seo, midia, cadastro, competitividade)
- Normalização de legados para granulares quando necessário (seo → seo_title/seo_description baseado em payload)
- Frontend: montar payload correto e exibir erro detalhado do backend
- CI fix: remover uso de req.user?.tenantId e padronizar req.tenantId (injetado pelo authGuard)

### B) Clips tri-state + evidências (robustez)
- Extrator ml-video-extractor com tri-state (true/false/null) e proteção contra shape drift
- True só com evidência positiva; false só com 200 + evidência negativa confiável; null em erro/permissão/shape inesperado
- Persistência "true é sticky" (não sobrescreve true com null/false)
- UI/insights: só sugerir clip quando hasClips === false, nunca quando null
- Instrumentação: clipsEvidence com source, status, signals, rawShape

### C) Promo/Preço "sem cálculo"
- Remover fallback perigoso: originalPriceForDisplay = listing.price quando hasPromotion
- buildPromoText não inventa "de X por Y" sem originalPrice da fonte
- Frontend só exibe "de X por Y" quando originalPriceForDisplay existe
- Aplicado em análise nova, cache payload e cache response

### D) Plano de Execução
- Corrigir mapeamento de section IDs: section-title → section-seo-title, section-images → section-media-images
- Scroll robusto: checa existência do elemento, fallback para topo

### E) Regerar análise e Badges (applied actions)
- Reset badges somente em "Regerar análise" (forceRefresh=true)
- Backend: filtrar appliedActions por applied_at >= analysis.created_at para análise atual
- Bug: badges não apareciam pois o frontend chamava onRegenerate() após apply
- Fix final: remover onRegenerate automático; aplicar estado local imediato (localAppliedActions) e sincronizar quando props mudarem

## 🧪 Evidências / Testes executados (após)
- ✅ apply-action retorna 200 e badge aparece imediatamente (sem refetch)
- ✅ refresh (F5) mantém badge (backend retorna appliedActions corretos)
- ✅ clicar "Regerar análise" reseta badges
- ✅ clips: não acusa falta quando null e não sugere quando detectado
- ✅ promo: não calcula desconto em cima de desconto; texto promo só com fonte confiável
- ✅ plano: clicar "Aplicar" navega para seção correta

## 📌 Status do Dia 06
✅ **Concluído**
✅ Execução Assistida funcional (ApplyAction + badges)
✅ Robustez de mídia/preço (tri-state clips, promo sem cálculo)
✅ UX navegação (Plano de Execução)
✅ Reset correto de badges

## 📋 Backlog / Débitos técnicos gerados (não bloqueadores)
- Permitir "desmarcar implementado" (com confirmação) ou histórico/undo
- Melhorar observabilidade: logs estruturados + correlationId por request
- Melhorar benchmark ML (403) + fallback e telemetria de falhas
- Testes automatizados cobrindo: apply->badge, regenerate->reset, clips tri-state

## ➡️ Próximo passo claro
**DIA 07 — Cadastro Manual + Anúncios sem Venda: Permitir importar anúncio por URL/ID (MLB...) e analisar mesmo sem venda/pausados/novos**

---

# DAILY EXECUTION LOG — 2026-02-11 (Dia 5 — Benchmark → Action Engine → Conteúdo Gerado)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Benchmark → Action Engine → Conteúdo Gerado (Core Value) — Priorização inteligente (máx 3 criticalGaps) — UI clara de wins/losses — Geração de conteúdo contextual (títulos, bullets, descrição) — Promo estruturado — Fallback heurístico quando benchmark indisponível — Correções de promo regression — Correções Dashboard (visits, orders, gmv) — Conversion armazenada como FRAÇÃO (0..1)**

## ✅ Entregas consolidadas

### Backend
- ✅ BenchmarkInsightsService implementado
- ✅ rankGaps() com regra dura (máx 3 criticalGaps)
- ✅ Ordenação por Impact DESC → Effort ASC → Confidence DESC
- ✅ GeneratedContentService contextual
- ✅ Promo estruturado no /ai/analyze
- ✅ Anti-regressão de promo no BD
- ✅ Fallback heurístico quando benchmark unavailable
- ✅ Conversion armazenada como FRAÇÃO (0..1) — HOTFIX P0
- ✅ Separação de visits e ordersMetrics
- ✅ Correção numeric overflow (PostgresError 22003)
- ✅ Dashboard consistente

### Frontend
- ✅ BenchmarkInsightsPanel implementado
- ✅ GeneratedContentPanel implementado
- ✅ Badge de confiança (high/medium/low/unavailable)
- ✅ Banner de fallback quando benchmark indisponível
- ✅ Conteúdo copiável (título, bullets, descrição)
- ✅ UI resiliente para benchmark indisponível

### Infra
- ✅ Lambda power-orchestrator criada
- ✅ CodeBuild para NAT toggle
- ✅ RDS controlado via orquestração

## 🧠 Decisão estratégica
**Produto deixa de ser "auditor" e passa a ser "assistente vendedor".**

## 📌 Status do Dia 05
✅ **Concluído**
⚠ Benchmark ML ainda depende de desbloqueio 403 (fora do controle atual)
⚠ Pequeno desalinhamento de fuso (-1 dia) tolerado temporariamente

## ➡️ Próximo passo claro
**DIA 06 — Execução Assistida (Modo Aplicar): Botão "Aplicar sugestão", Modal Antes/Depois, Confirmação humana, Registro interno de ação aplicada, Badge "Implementado"**

---

# DAILY EXECUTION LOG — 2026-02-09 (Dia 4 — Promo Pricing Confiável + TTL + Feature Flag)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Promo pricing confiável (source of truth) — Correção definitiva do bug de promoção — Robustez infra + observabilidade — Preparação para Action Engine (Dia 05)**

## ✅ Planejado
- [x] Validar persistência correta de preço promocional
- [x] Integrar /items/{id}/prices com TTL escalável (sem allowlist)
- [x] Criar feature flag via Secrets Manager (USE_ML_PRICES_FOR_PROMO)
- [x] Garantir rate-limit safety (TTL padrão 12h)
- [x] Corrigir UX do benchmark (403 tratado como indisponível, não bug)
- [x] Criar override manual para debug (forcePromoPrices=true)
- [x] Parser robusto para feature flags (plaintext + JSON)
- [x] Observabilidade completa no force-refresh

## 🧠 Descobertas
- **App Runner NÃO injeta secrets automaticamente:** Secrets precisam estar explicitamente configurados no Terraform (`runtime_environment_secrets`)
- **Secrets plaintext vs JSON exigem parser robusto:** AWS Secrets Manager pode retornar `"true"` (plaintext) ou `{"USE_ML_PRICES_FOR_PROMO":"true"}` (JSON key/value), exigindo `getBooleanEnv()` que suporta ambos
- **/prices é a única fonte confiável para promo real no Mercado Livre:** `/items?ids=...` (multiget) não retorna dados suficientes de promoção; `/items/{id}/prices` retorna exatamente o que o comprador vê
- **TTL é obrigatório para evitar abuso de rate-limit:** Sem TTL, múltiplas chamadas seguidas ao `force-refresh` causariam rate limit desnecessário; `promotion_checked_at` controla quando buscar novamente
- **Observabilidade no force-refresh é essencial para debug de produção:** Response inclui `config`, `enrichment.applied`, `enrichment.reason` para diagnóstico sem logs

## ⚠️ Bloqueios / riscos
- Nenhum bloqueio ativo
- Benchmark ML Search pode continuar retornando 403 (tratado como indisponível, não bug)

## 📌 Decisões tomadas
- **/items/{id}/prices é source of truth para promo:** Nunca usar heurística de desconto quando `/prices` estiver disponível
- **TTL padrão de promo pricing = 12h:** `PROMO_PRICES_TTL_HOURS` configurável via env var (default 12h)
- **Feature flag USE_ML_PRICES_FOR_PROMO via Secrets Manager:** Permite ativar/desativar sem deploy
- **Override manual via query param forcePromoPrices=true:** Ignora TTL para debug/manual force quando necessário
- **Benchmark 403 tratado como indisponível (UX):** Mensagem amigável "Benchmark indisponível no momento (Mercado Livre retornou 403)." evita aparência de bug
- **Nenhuma allowlist por anúncio:** Sistema escalável para milhares de anúncios; TTL garante rate-limit safety sem hardcoding

## ➡️ Próximo passo claro
**Iniciar DIA 05: Benchmark → Action Engine → Conteúdo Gerado (core value)**

---

# DAILY EXECUTION LOG — 2026-02-09 (Dia 4)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Final Closure Dia 04 — Benchmark (backend + UI) — Unificação de versões de prompt — forceRefresh e cache consistency — Estabilização de CI/Deploy**

## ✅ Planejado
- [x] Integrar Benchmark no backend e frontend
- [x] Garantir benchmark nunca null (sempre objeto com confidence='unavailable' se falhar)
- [x] Unificar AI_PROMPT_VERSION em fonte única (apps/api/src/utils/prompt-version.ts)
- [x] Expor promptVersion e schemaVersion no response
- [x] Corrigir TS build (setVersionHeader definido antes do uso)
- [x] Ajustar pipelines App Runner (aguardar estado RUNNING antes de start-deployment)
- [x] Integrar BenchmarkPanel na UI (ListingAIAnalysisPanel)
- [x] Adicionar benchmark aos tipos TypeScript (AIAnalysisResponse)
- [x] Fix /api/v1/meta — gitShaShort não pode ser "unknown" em produção
- [x] Diagnóstico Benchmark vazio (confidence=unavailable, sampleSize=0)

## 🧠 Descobertas
- **Pipeline WEB falhou por divergência entre payload real e tipos TypeScript:** API retornava `benchmark` corretamente, mas tipo `AIAnalysisResponse` não incluía o campo, causando erro TS em `adaptAIAnalysisResponse`
- **ESLint e TS falhas foram em cadeia:** `BenchmarkPanel` importado mas não usado → erro ESLint → correção adicionou uso → erro TS por tipo ausente
- **App Runner falhava em estados transitórios ≠ RUNNING:** Deploy tentava iniciar quando serviço estava em `OPERATION_IN_PROGRESS`, causando falha "Can't start a deployment ... because it isn't in RUNNING state"
- **Secrets não estavam injetados originalmente no App Runner:** Smoke test inicial falhava por falta de env vars; corrigido com dummy vars no CI
- **Cache não invalidava quando prompt version mudava:** Fingerprint não incluía `AI_PROMPT_VERSION`, causando cache stale após mudança de prompt
- **forceRefresh não atualizava listing antes de analisar:** Análise usava dados stale (preço/promo antigos) mesmo com `forceRefresh=true`

## ⚠️ Bloqueios / riscos
- **CI WEB ainda vermelho no momento do encerramento (tipagem benchmark):** Erro TypeScript em `use-ai-analyze.ts` linha 189 — **RESOLVIDO**
- **Dependência de hotfix final do Cursor para liberar pipeline:** Tipagem `benchmark` em `AIAnalysisResponse` necessária para build passar — **RESOLVIDO**
- **/api/v1/meta retornando gitSha="unknown" em produção:** ENV GIT_SHA não estava sendo propagado para runtime stage — **RESOLVIDO**
- **Benchmark sempre sampleSize=0 sem diagnóstico:** Erros de fetch não eram capturados detalhadamente — **RESOLVIDO**

## 📌 Decisões tomadas
- **Manter benchmark como campo opcional e nunca null:** Sempre retornar objeto com `confidence='unavailable'` quando dados insuficientes; nunca retornar `null`
- **Centralizar promptVersion em fonte única:** Criar `apps/api/src/utils/prompt-version.ts` como única fonte de verdade; remover divergências entre `ml-expert-v21` e `ml-expert-v22`
- **Tornar deploy App Runner resiliente a estados transitórios:** Adicionar pre-check que aguarda estado `RUNNING` antes de `start-deployment`; polling com retry e timeout explícito
- **Propagar GIT_SHA para runtime stage:** Adicionar ARG e ENV GIT_SHA no runtime stage do Dockerfile da API; adicionar ENV COMMIT_SHA para compatibilidade
- **Diagnóstico detalhado de benchmark:** Incluir `_debug` no BenchmarkResult quando `competitors.length === 0`; capturar statusCode, stage e mensagem detalhada; adicionar timeout (7s) e headers (User-Agent, Accept) no fetchCompetitors

## ➡️ Próximo passo claro
**Dia 05 — Validação & Consolidação: Finalizar hotfix de tipagem no WEB, validar pipeline verde, validar benchmark na UI, verificar cacheHit vs fresh, verificar promptVersion em produção, testes end-to-end**

---

# DAILY EXECUTION LOG — 2026-02-09 (Dia 4 - Final Closure)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Final Closure Dia 04 — Correções finais de UI e instrumentação de debug**

## ✅ Planejado
- [x] Fix /api/v1/meta — gitShaShort não pode ser "unknown" em produção
- [x] Diagnóstico Benchmark vazio (confidence=unavailable, sampleSize=0)
- [x] (Opcional UX) Preço "ML você vende por" vs preço para o comprador
- [x] WEB — Ajuste de UI: não duplicar promo nas duas colunas
- [x] API — Instrumentação CONTROLADA para capturar payload do ML /prices (debug)

## 🧠 Descobertas
- **Benchmark._debug agora mostra 403 forbidden:** Quando ML Search API retorna 403 PolicyAgent, `benchmark._debug` inclui `stage='ml-search-forbidden'`, `statusCode=403`, `code` e `message` detalhados
- **Debug controlado de prices:** Implementado mecanismo seguro para capturar payload do ML `/items/{id}/prices` apenas quando `debugPrices=true` e `listingIdExt='MLB4167251409'`
- **UI de preços duplicava promoção:** Coluna "Preço" mostrava original riscado + promo, enquanto "Preço Promocional" também mostrava promo → redundância

## 📌 Decisões tomadas
- **Propagar GIT_SHA para runtime stage:** Adicionar ARG e ENV GIT_SHA no runtime stage do Dockerfile da API; adicionar ENV COMMIT_SHA para compatibilidade
- **Diagnóstico detalhado de benchmark:** Incluir `_debug` no BenchmarkResult quando `competitors.length === 0`; capturar statusCode, stage e mensagem detalhada; adicionar timeout (7s) e headers (User-Agent, Accept) no fetchCompetitors
- **UI de preços sem duplicidade:** Coluna "Preço de venda (comprador)" mostra apenas preço atual (promo se houver); coluna "Preço Promocional" mostra original riscado se houver promoção
- **Debug controlado de prices:** Só executa quando `debugPrices=true` (query param) OU `DEBUG_ML_PRICES=true` (env) E `listingIdExt='MLB4167251409'`; nunca retorna tokens completos; inclui `_debugPrices` no response

## 🧪 Como testar debugPrices

### Via curl:
```bash
# Substituir :uuid pelo UUID do listing que tem listingIdExt='MLB4167251409'
curl -X POST 'https://api.superselleria.com.br/api/v1/ai/analyze/:uuid?forceRefresh=true&debugPrices=true' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json'
```

### Resposta esperada:
```json
{
  "message": "Análise concluída com sucesso",
  "data": {
    "listingId": "...",
    "score": 75,
    "analysisV21": {...},
    "_debugPrices": {
      "listingIdExt": "MLB4167251409",
      "attemptedAt": "2026-02-09T...",
      "url": "https://api.mercadolibre.com/items/MLB4167251409/prices",
      "statusCode": 403,
      "blockedBy": "PolicyAgent",
      "code": "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
      "message": "...",
      "headers": {
        "contentType": "application/json"
      },
      "body": {
        "code": "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
        "message": "..."
      }
    }
  }
}
```

### Observações:
- `benchmark._debug` já mostra `stage='ml-search-forbidden'` e `statusCode=403` quando ML Search API retorna 403
- `_debugPrices` é específico para debug do endpoint `/items/{id}/prices` (diferente do benchmark)
- Sem `debugPrices=true`: comportamento idêntico ao atual (nenhum log extra, nenhum campo novo)

## ➡️ Próximo passo claro
**Dia 05 — Validação & Consolidação: Validar pipeline verde, validar benchmark na UI, verificar cacheHit vs fresh, verificar promptVersion em produção, testes end-to-end**

---

# DAILY EXECUTION LOG — 2026-02-09 (Hotfix Preço Promocional ML)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Hotfix controlado: corrigir divergência de preço promocional do Mercado Livre usando /items/{id}/prices como source of truth**

## ✅ Planejado
- [x] BACKEND: Criar helper extractBuyerPricesFromMlPrices para extrair preços do payload /prices
- [x] BACKEND: Aplicar preços do /prices quando flag USE_ML_PRICES_FOR_PROMO=true e listing MLB4167251409
- [x] BACKEND: Garantir que analysisV21.price_fix usa valores persistidos (já usa via buildAIAnalyzeInputV21)
- [x] FRONTEND: Ajustar nomes e ordem das colunas do grid (Preço original, Preço promocional)
- [x] TESTES: Unit test do helper extractBuyerPricesFromMlPrices (6 casos de teste)

## 🧠 Descobertas
- **Divergência de preço:** UI mostrava R$ 70,23 mas ML público mostra R$ 66,93 para MLB4167251409
- **Endpoint /items/{id}/prices retorna dados corretos:** `_debugPrices.body.prices` mostra `promotion.amount = 66.93` e `standard.amount = 100`
- **buildAIAnalyzeInputV21 já usa valores persistidos:** O método lê `listing.price_final` e `listing.original_price` do DB, então não precisa de mudança adicional

## 📌 Decisões tomadas
- **Hotfix controlado via flag:** Implementar correção apenas quando `USE_ML_PRICES_FOR_PROMO=true` e `listingIdExt='MLB4167251409'` para evitar impacto em outros listings
- **Usar /items/{id}/prices como source of truth:** Endpoint `/prices` retorna exatamente o que o comprador vê na página pública do ML
- **Sobrescrever price também:** Além de `price_final`, também atualizar `price` para refletir o preço atual do comprador (garante UI correta)
- **UI: ordem das colunas:** "Preço original" (riscado se promo) → "Preço promocional" (promo destacada)

## ➡️ Próximo passo claro
**Validar em produção:** Com `USE_ML_PRICES_FOR_PROMO=true`, rodar `force-refresh` em MLB4167251409 e verificar que DB e UI mostram R$ 66,93

---

# DAILY EXECUTION LOG — 2026-02-09 (Dia 3)

## ✅ STATUS: CONCLUÍDO COM SUCESSO

## 🎯 Foco do dia
**Análise Profunda de Anúncio — Validação de dados reais (pricing, promoções, métricas) — Desbloqueio do force-refresh e backfill de promoções — Calibração do ScoreActionEngine**

## ✅ Planejado
- [x] Validar rotas novas (meta, debug-payload, force-refresh)
- [x] Sincronizar dados atualizados do anúncio MLB4217107417
- [x] Fix conexão Mercado Livre e token helper (resolver determinístico e refresh só quando necessário)
- [x] Robustez: force-refresh/backfill funcionando; auto-init de conexão/tokens
- [x] Promoção corrigida end-to-end com Prices API (original_price, price_final, has_promotion, discount_percent)
- [x] IA Prompt v22 (ml-expert-v22) com ML Safe Mode (sem emojis/markdown), e promoção com "onde + como"
- [x] Sanitização em todos os caminhos (inclusive cache): sanitizeExpertAnalysis + fingerprint dinâmico por AI_PROMPT_VERSION
- [x] UI Promoção didática (PromotionHighlightPanel com passos e copiar texto)
- [x] ScoreActionEngine calibrado: "promo agressiva + baixa conversão" vira prioridade #1 (title/images/description) com thresholds configuráveis e testes
- [x] Testes e CI verdes; validação manual em listing MLB4217107417

## 🧠 Descobertas
- **App Runner estava rodando versão antiga devido a runtime crash:** Imports inválidos em `@superseller/ai/dist/...` causavam crash na inicialização, fazendo App Runner reverter para versão anterior
- **Deploys estavam sendo revertidos automaticamente:** Runtime crash impedia deploy bem-sucedido
- **Existiam múltiplas conexões Mercado Livre por tenant:** Banco de dados continha 2+ conexões ML com `type='mercadolivre'` e mesmo `tenant_id`
- **Código usava `findFirst` sem ordenação:** Seleção de conexão era não-determinística, podendo escolher conexão antiga/inválida
- **force-refresh exigia refresh_token mesmo com access_token válido:** Lógica incorreta forçava refresh desnecessário, causando falhas quando refresh_token não estava disponível
- **hasClips=false estava sendo usado quando o correto é null:** API do ML não expõe clips de forma confiável via items API; usar `false` afirmava ausência sem certeza
- **Debug-payload confirmou dados corretos de métricas e listing:** Mas pricing vinha de fallback (promoção não sincronizada)
- **Prices API payload structure:** `/items/{id}/prices` retorna estrutura diferente de `/items?ids=...`; necessário enriquecimento específico para capturar promoções ativas
- **Cache fingerprint issue:** Cache não invalidava quando `AI_PROMPT_VERSION` mudava; necessário incluir prompt version no fingerprint
- **Sanitização no caminho cacheado:** Análises em cache não passavam por sanitização; necessário sanitizar tanto retorno fresh quanto cached
- **Necessidade ML safe mode (sem emojis):** Output da IA continha emojis e markdown que quebravam UI; necessário sanitização antes de exibir

## ⚠️ Bloqueios / riscos
- **Sync e backfill falhando por seleção incorreta de conexão:** Código selecionava conexão errada (findFirst sem order/critério), causando 403 forbidden e "Refresh token não disponível" — **RESOLVIDO**
- **Risco de análises inconsistentes enquanto isso não for corrigido:** Análises baseadas em dados de conexão incorreta gerariam insights incorretos — **RESOLVIDO**
- **Promoção não capturada via multiget:** `/items?ids=...` não retorna dados suficientes de promoção; necessário enriquecimento via `/items/{id}/prices` — **RESOLVIDO**

## 📌 Decisões tomadas
- **Criar resolver determinístico de conexão Mercado Livre:** `resolveMercadoLivreConnection()` com critérios explícitos (access_token válido → refresh_token disponível → mais recente)
- **Não exigir refresh_token se access_token ainda válido:** Helper `getValidAccessToken()` usa refresh apenas quando necessário
- **Tratar clips como null quando não detectável:** `hasClips = null` quando API não permite confirmar; `dataQuality.warnings` inclui `clips_not_detectable_via_items_api`
- **Promo detect via /items/{id}/prices:** Prices API é fonte de verdade para promoções; fallback para `/items/{id}` se `/prices` falhar (403/404)
- **Cache invalidation must include prompt version:** Fingerprint dinâmico inclui `AI_PROMPT_VERSION` para invalidar cache quando prompt muda
- **Sanitização deve ocorrer no retorno fresh e cached:** `sanitizeExpertAnalysis()` aplicado tanto em análise nova quanto em cache
- **Regra determinística no engine para promo agressiva + low CR:** ScoreActionEngine aplica boost/penalty baseado em thresholds configuráveis (PROMO_AGGRESSIVE_DISCOUNT_PCT=30, LOW_CR_THRESHOLD=0.006, MIN_VISITS_FOR_CR_CONFIDENCE=150)

## ➡️ Próximo passo claro
**Dia 04 — Benchmark & Comparação com Concorrentes: baseline por categoria, "você perde/ganha", expected vs actual usando média categoria, thresholds derivados do benchmark. UI/resultado mostrando comparação e ações concretas baseadas em gaps.**

---

# DAILY EXECUTION LOG — 2026-01-22

## ✅ STATUS: CONCLUÍDO

## 🎯 Foco do dia
**Correção definitiva do sync de visits + tratamento de bloqueios PolicyAgent**

---

# DAILY EXECUTION LOG — 2026-01-27 (Dia 2)

## ⚠️ STATUS: TECNICAMENTE FUNCIONAL, PRODUTO AINDA NÃO FECHADO

## 🎯 Foco do dia
**Consolidação da Análise IA Expert (ml-expert-v1) + Descontinuação da V1 + Garantia de cache e controle de custo + Estabilização de arquitetura para evolução futura**

## ✅ Planejado / Feito
- [x] Instrumentar `syncVisitsByRange` com logs detalhados (visitsMap sum, intersectionCount, read-back)
- [x] Corrigir parser de visits para formato real do ML (results.total/visits_detail)
- [x] Normalizar datas ISO para YYYY-MM-DD UTC antes de salvar no map
- [x] Adicionar type guard (`VisitPoint`, `isVisitPoint`) para corrigir erro TypeScript TS2322
- [x] Corrigir erro 400 "Limit must be a lower or equal than 51" em orders (clamp explícito)
- [x] Tratamento: erro 400 de orders não interrompe refresh de metrics/visits
- [x] Validar visits no DB: `positive_days = 91`, `total_visits_period = 803`
- [x] Validar UI: gráfico de visitas exibindo valores reais
- [x] **Implementar tratamento de 403 PolicyAgent (PA_UNAUTHORIZED_RESULT_FROM_POLICIES)**
- [x] **Introduzir `access_status` (accessible / unauthorized / blocked_by_policy)**
- [x] **Reconciliação de status paused vs active via batch API autenticada**
- [x] **Observabilidade via `/refresh` (reconcile.details com actionTaken)**
- [x] **Filtros de sync: excluir listings com `access_status != accessible`**
- [x] **Ativar Prompt Especialista (ml-expert-v1) em produção**
- [x] **Remover completamente V1 (sem fallback)**
- [x] **Implementar validação robusta de JSON (response_format, regex extraction, retry)**
- [x] **Corrigir bug crítico de listing incorreto (cache invalidation, prompt_version validation)**
- [x] **Implementar normalização snake_case → camelCase no frontend**
- [x] **Atualizar modal para renderizar dados reais do Expert (verdict, titleFix, descriptionFix, imagePlan, priceFix, algorithmHacks, finalActionPlan)**
- [x] **Remover dependência de savedRecommendations**

## 🧠 Descobertas
- **Formato real da API ML:** `response.data.results[]` com campos `date`, `total` e `visits_detail[]` (quantity)
- Parser anterior buscava `entry.visits` que não existia no formato real
- Datas em formato ISO (`2026-01-22T00:00:00Z`) precisavam normalização antes de salvar no map
- **Múltiplas conexões ML:** existe connection `active` (provider_account_id = 189663082) e `revoked` (2019955315)
- Sistema usa sempre a conexão `active` mais recente; divergências de `sellerId` podem explicar diferenças em orders
- **403 PolicyAgent:** Alguns listings retornam `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` mesmo com token válido (listings "órfãos" de conexões antigas)
- **Batch API `/items?ids=...`:** Retorna array na mesma ordem dos IDs enviados; cada item tem `{code, body}` onde `code=200` → item completo, `code!=200` → erro
- **OpenAI retorna JSON não-estrito:** Precisa `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Cache pode ter prompt_version antigo:** Validação obrigatória de `prompt_version` antes de usar cache
- **Frontend esperava camelCase mas API retorna snake_case:** Normalização necessária para compatibilidade
- **Análises misturavam dados entre anúncios:** Bug crítico resolvido com reset de state quando `listingId` muda

## ⚠️ Bloqueios / riscos
- **Erro 400 orders limit:** ocorreu em produção; corrigido com clamp `limit <= 51`
- **Orders com connection active vs revoked:** investigar se orders=0 quando connection mudou de sellerId é comportamento esperado
- **Listings bloqueados por PolicyAgent:** Não são processados em visits/metrics (comportamento correto)
- **🔴 Descrição rasa:** IA entregando descrições curtas que não atendem proposta de valor — **BLOQUEADOR DO DIA 2**
- **🔴 Promoção chutada:** IA afirma "não há promoção" sem dados explícitos — **BLOQUEADOR DO DIA 2**
- **🔴 Vídeo com lógica incorreta:** Sugere "Adicionar vídeo" mesmo com `hasClipDetected = null` — **BLOQUEADOR DO DIA 2**
- **🟡 EditUrl ausente:** Botão "Abrir no Mercado Livre" abre página pública, não edição — **MELHORIA**
- **🟡 UX do modal confusa:** Layout funciona mas precisa hierarquia melhor — **MELHORIA**

## 📌 Decisões tomadas

### Visits (NULL vs 0)
- **Visitas:** `0` apenas quando fetch ok e dia ausente no mapa; erro → `NULL`
- **Parser:** extrai na ordem: `entry.visits` → `entry.total` → soma de `visits_detail[].quantity`
- **Normalização:** datas ISO convertidas para `YYYY-MM-DD` UTC antes de salvar no map

### Orders
- **Limit clamp:** `limit` nunca excede 51 (ML API não aceita > 51)
- **Erro 400:** não interrompe refresh de metrics/visits; apenas 401/403 interrompem com `reauth_required`

### Access Control & PolicyAgent
- **`access_status`:** Separação clara entre status do anúncio (`active`/`paused`) e acesso via API (`accessible`/`unauthorized`/`blocked_by_policy`)
- **403 PolicyAgent:** Marca `access_status='blocked_by_policy'` com `access_blocked_code`, `access_blocked_reason`, `access_blocked_at`
- **Não alterar `status`:** Quando bloqueado por PolicyAgent, `status` permanece desconhecido (não alterar)
- **Filtros de sync:** Processar apenas listings com `access_status='accessible'` E `status IN ('active', 'paused')`
- **Reconciliação:** Verifica `paused` no DB vs `active` no ML e atualiza; também verifica se listings bloqueados voltaram a ser acessíveis

### Observabilidade
- **Instrumentação:** adicionada para diagnóstico (visitsMap sum, intersectionCount, read-back, DB fingerprint)
- **`/refresh` response:** Inclui `reconcile.details` com `actionTaken` ('marked_blocked_by_policy', 'updated_status', 'skipped', etc.)
- **Logs limitados:** Apenas primeiros 10 listings para não poluir logs

### Análise IA Expert (ml-expert-v1)
- **V1 oficialmente aposentado:** Sem fallback; sistema usa exclusivamente Prompt Especialista
- **Validação robusta de JSON:** `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Cache com validação de prompt_version:** Regenera automaticamente se `prompt_version` não corresponder
- **Normalização snake_case → camelCase:** Frontend recebe dados normalizados para facilitar uso
- **Bug crítico de listing incorreto resolvido:** Reset de state quando `listingId` muda; validação de `listingId` na resposta

### Decisões conscientes (backlog)
- **Backfill manual:** Por enquanto, backfill de visits é manual via endpoint; automação futura
- **Multi-conexões:** Não resolver suporte a múltiplas conexões ativas simultaneamente agora (usa sempre a mais recente `active`)
- **Inserção manual de anúncios:** Não implementado; sistema depende de sync do ML

### Decisões de produto (registradas)
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos; caso contrário → resposta condicional
- **Descrição é feature central:** Descrição curta = BUG de produto; densidade mínima obrigatória definida no prompt
- **Prompt especialista é o padrão:** V1 oficialmente aposentado; todo output deve ser "pronto para aplicar"

## ➡️ Próximo passo claro
**Encerrar Dia 2: Corrigir bloqueadores de qualidade do output da IA**

1. **Ajustar prompt do Expert para descrição profunda obrigatória**
   - Densidade mínima definida no prompt
   - Estrutura obrigatória (benefícios, tamanhos, confiança, CTA)
   - SEO forte

2. **Corrigir promoção (dados + regra)**
   - Backend deve enviar `has_promotion`, `promotion_price`, `original_price`
   - IA deve dizer "não foi possível confirmar" se dado não existir
   - Não pode afirmar ausência sem certeza

3. **Corrigir lógica de vídeo condicional**
   - `true` → não sugerir
   - `false` → sugerir
   - `null` → sugestão condicional ("se não houver vídeo…")

4. **Implementar editUrl do Mercado Livre**
   - Backend fornece `editUrl`
   - Front prioriza `editUrl` sobre `publicUrl`

5. **Validar novamente output vs expectativa de especialista**
   - Descrição estruturada e profunda
   - Promoção determinística
   - Vídeo com lógica correta
   - Links de edição funcionando

**Só então encerrar Dia 2 oficialmente.**

---

# DAILY EXECUTION LOG — 2026-02-02 (Dia 2 — Especialização da IA Mercado Livre)

## ✅ STATUS: ENCERRADO COM SUCESSO

## 🎯 Foco do dia
**Especialização da IA Mercado Livre: Prompts versionados, validações de qualidade, debug payload e testes com fixture**

## ✅ Planejado / Feito
- [x] **UX V2.1 implementada:** Accordion inline substituindo modal lateral, cards consultor sênior
- [x] **Prompts versionados criados:**
  - `mlExpertV21.ts` — Consultor Sênior com guardrails de qualidade (900 chars, 7 ações, estrutura obrigatória)
  - `mlSalesV22.ts` — Foco em vendas e execução (Plano 7 dias, hypothesis, how_to_execute_today)
  - Registry centralizado (`packages/ai/src/prompts/registry.ts`)
- [x] **Validações de qualidade implementadas:**
  - Description >= 900 caracteres
  - Title >= 45 caracteres (55-60 preferido)
  - Final action plan >= 7 itens
  - Image plan conforme pictures_count
  - **Validação de promoção:** Se `hasPromotion=true`, DEVE mencionar `originalPrice` e `priceFinal`
  - **Validação de clip:** Se `hasClips=null`, NÃO pode afirmar ausência; deve usar frase padrão
- [x] **Retry automático:** Se validação falhar, 1 retry com prompt reforçado
- [x] **Debug payload endpoint:** `GET /api/v1/ai/debug-payload/:listingIdExt` (sanitizado, sem tokens/PII)
- [x] **Fixture e testes:**
  - `item-MLB4217107417.json` criado
  - Testes do registry de prompts (`packages/ai/__tests__/prompts-registry.test.ts`)
  - Testes do validador de qualidade (`apps/api/src/__tests__/ai-quality-validator.test.ts`)
- [x] **Endpoints de promoção:**
  - `POST /api/v1/sync/mercadolivre/listings/:listingIdExt/force-refresh`
  - `POST /api/v1/sync/mercadolivre/listings/backfill-promotions?limit=200`
- [x] **Endpoint de meta:** `GET /api/v1/meta` (gitSha, buildTime, env)
- [x] **Correção de build:** Desabilitado `composite: true` no tsconfig do package ai para gerar `.d.ts` corretamente

## 🧠 Descobertas
- **Prompts versionados:** Estrutura modular permite evolução sem quebrar código existente
- **Validação client-side:** Validação de qualidade antes de retornar ao usuário garante output consistente
- **Retry automático:** 1 retry com prompt reforçado resolve maioria dos casos de validação falha
- **Workaround temporário:** Imports diretos de `@superseller/ai/dist/prompts/*` necessário devido a problema de resolução de módulos TypeScript (registrado como tech debt)
- **Build do package ai:** `composite: true` estava impedindo geração correta de arquivos `.d.ts`

## ⚠️ Bloqueios / Riscos
- **🔴 `/api/v1/meta` retornando 404 em produção:** Suspeita de problema de deploy/gateway/envoy/cache
- **🟡 Workaround de imports diretos:** Registrado como tech debt; precisa corrigir exports do package `@superseller/ai`
- **🟡 Rotas em produção:** Endpoints `force-refresh` e `debug-payload` podem estar retornando 404 (problema de infra/deploy, não conceitual)

## 📌 Decisões tomadas
- **Debug payload é endpoint oficial de transparência da IA:** Permite comparar "o que enviamos" vs "o que volta"
- **Validação de qualidade é gate obrigatório:** Antes de responder usuário, validação garante output consistente
- **Prompts versionados via env:** `AI_PROMPT_VERSION` permite alternar entre V2.1 Expert e V2.2 Sales
- **Registry centralizado:** Facilita acesso e evolução de prompts
- **Fixture para testes:** `item-MLB4217107417.json` permite testes anti-regressão

## ➡️ Próximo passo claro
**Dia 3: Análise Profunda de Anúncio**
1. Validar qual serviço está rodando atrás de `api.superselleria.com.br`
2. Usar `/sync/status` vs `/meta` para identificar mismatch
3. Validar promo e debug-payload com ambiente correto
4. Comparar output da IA com análise humana (MLB4217107417)

---

## ✅ Planejado / Feito (Dia 2 — Detalhado)
- [x] Finalizar prompt e schema da IA Expert (ml-expert-v1)
- [x] Integrar Expert ao backend (`POST /api/v1/ai/analyze/:listingId`)
- [x] Remover completamente V1 (sem fallback)
- [x] Implementar validação robusta de JSON (response_format, regex extraction, retry)
- [x] Garantir cache funcional (regeneração quando `analysisV21` ausente)
- [x] Corrigir bug crítico de listing incorreto (cache invalidation, prompt_version validation)
- [x] Integrar Expert ao frontend (types, hook, componente)
- [x] Implementar normalização snake_case → camelCase
- [x] Remover UI V1 completamente
- [x] Implementar UX de cache (banner quando cacheHit, botão "Regerar análise")
- [x] Corrigir binding completo do `analysisV21` no frontend
- [x] Renderizar diagnóstico, ações, título sugerido, descrição sugerida, análise de preço, plano de imagens, hacks algorítmicos
- [x] Corrigir erros de build TypeScript (tipos, variáveis não declaradas)
- [x] Validar fluxo completo de análise por anúncio
- [x] Remover dependência de savedRecommendations

## 🧠 Descobertas (Dia 2 — Detalhado)
- **Expert gera JSON rico e confiável:** Schema estruturado com `verdict`, `title_fix`, `description_fix`, `image_plan`, `price_fix`, `algorithm_hacks`, `final_action_plan`
- **OpenAI retorna JSON não-estrito:** Precisa `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Binding cuidadoso no frontend:** Schema real da API é `response.data.analysisV21` (não `response.data.data.analysisV21`)
- **Cache é essencial para controle de custos:** OpenAI GPT-4o é caro; cache por listing evita chamadas redundantes
- **Normalização necessária:** API retorna snake_case mas frontend espera camelCase
- **Análises misturavam dados entre anúncios:** Bug crítico resolvido com reset de state quando `listingId` muda
- **Limitações da API do Mercado Livre:** Exigem decisões de produto (ex: backfill manual por enquanto)
- **Problemas atuais são de qualidade do output, não de integração:** Expert funciona bem; desafio é garantir profundidade e precisão

## ⚠️ Bloqueios / Riscos (Dia 2 — Detalhado)
- **Mapping incompleto do analysisV21 no frontend:** Inicialmente tentou acessar campos inexistentes — **RESOLVIDO**
- **🔴 Descrição rasa:** IA entregando descrições curtas que não atendem proposta de valor — **BLOQUEADOR DO DIA 2**
- **🔴 Promoção chutada:** IA afirma "não há promoção" sem dados explícitos — **BLOQUEADOR DO DIA 2**
- **🔴 Vídeo com lógica incorreta:** Sugere "Adicionar vídeo" mesmo com `hasClipDetected = null` — **BLOQUEADOR DO DIA 2**
- **🟡 EditUrl ausente:** Botão "Abrir no Mercado Livre" abre página pública, não edição — **MELHORIA**
- **🟡 UX do modal confusa:** Layout funciona mas precisa hierarquia melhor — **MELHORIA**
- **CI rodando em commit antigo:** Commit `d7d90e9` ainda tinha código antigo; commit `0ad1bf2` corrigiu — **RESOLVIDO**

## 📌 Decisões tomadas (Dia 2 — Detalhado)

### Análise IA Expert (ml-expert-v1)
- **V1 da análise de IA foi oficialmente descontinuada:** Apenas Expert será exibida ao usuário
- **Cache reaproveitado da V1 para Expert:** Cache existente é regenerado automaticamente quando `analysisV21` ausente
- **Sem fallback para V1:** Se Expert falhar, sistema retorna erro 502 com mensagem clara
- **Versionamento de prompt:** `PROMPT_VERSION = 'ml-expert-v1'` para invalidação de cache
- **Validação robusta de JSON:** `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Normalização snake_case → camelCase:** Frontend recebe dados normalizados para facilitar uso

### Backfill e Automação
- **Backfill automático ficará para fase futura:** Decisão consciente de manter manual por enquanto
- **Preparar fundação para análise de imagens:** Armazenar `pictures_json`, `pictures_count` sem ativar IA visual agora

### Frontend
- **Remoção completa da UI V1:** Modal exibe apenas Expert
- **UX de cache:** Banner discreto quando `cacheHit=true` ou `message.includes('(cache)')`
- **Botão "Regerar análise":** Sempre disponível quando `analysisV21` existe; chama endpoint com `forceRefresh=true`
- **Normalização de dados:** Frontend recebe dados em camelCase via `normalizeAiAnalyzeResponse`

### Integração
- **Schema real da API:** `response.data.analysisV21` (não `response.data.data.analysisV21`)
- **Metadados para UX:** `analyzedAt`, `cacheHit`, `message` expostos no hook para feedback ao usuário
- **Bug crítico de listing incorreto resolvido:** Reset de state quando `listingId` muda; validação de `listingId` na resposta

### Decisões de produto (registradas)
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos; caso contrário → resposta condicional
- **Descrição é feature central:** Descrição curta = BUG de produto; densidade mínima obrigatória definida no prompt
- **Prompt especialista é o padrão:** V1 oficialmente aposentado; todo output deve ser "pronto para aplicar"

## ➡️ Próximo passo claro (Dia 2 → Dia 3)
**Encerrar pendências do Dia 2 e estabilizar completamente a Análise IA Expert:**

1. **Ajustar prompt do Expert para descrição profunda obrigatória**
   - Densidade mínima definida no prompt
   - Estrutura obrigatória (benefícios, tamanhos, confiança, CTA)
   - SEO forte

2. **Corrigir promoção (dados + regra)**
   - Backend deve enviar `has_promotion`, `promotion_price`, `original_price`
   - IA deve dizer "não foi possível confirmar" se dado não existir
   - Não pode afirmar ausência sem certeza

3. **Corrigir lógica de vídeo condicional**
   - `true` → não sugerir
   - `false` → sugerir
   - `null` → sugestão condicional ("se não houver vídeo…")

4. **Implementar editUrl do Mercado Livre**
   - Backend fornece `editUrl`
   - Front prioriza `editUrl` sobre `publicUrl`

5. **Validar novamente output vs expectativa de especialista**
   - Descrição estruturada e profunda
   - Promoção determinística
   - Vídeo com lógica correta
   - Links de edição funcionando

**Só então encerrar Dia 2 oficialmente.**
