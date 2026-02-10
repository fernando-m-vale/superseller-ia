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
