# ML DATA AUDIT — SuperSeller IA (Mercado Livre)

## 🎯 Objetivo
Garantir dados confiáveis e consistentes (por tenant, por dia, por listing) para alimentar:
- Dashboard (Overview)
- Score/IA (futuro)
- Automação (futuro)

## ✅ Estado atual — 2026-01-20

### A) Orders (Pedidos)
**Status:** ✅ OK
- Ingestão via ML funcionando
- Refresh sincroniza orders por range
- Persistência consistente em `orders` e `order_items`

**Correções feitas**
- Corrigido filtro de range na API do ML (from + to, fallback e logs)
- Tratamento de conexão expirada/reauth_required e feedback na UI

**Risco**
- “Dia” pode variar entre ML e UTC → exige validação de timezone

---

### B) Metrics diárias (orders/gmv por listing/dia)
**Tabela:** `listing_metrics_daily`  
**Status:** ✅ OK

**O que funciona**
- Série diária real (range inclusivo, periodDays dias)
- UPSERT por (tenant_id, listing_id, date)
- `orders` e `gmv` preenchidos para dias com venda
- Dias sem venda ficam 0 no /overview (UI coerente)

**Correções feitas**
- `order_items.listing_id` estava nulo (quebrava agregação): corrigido ingestão + backfill
- Cálculo passou a agregar via DB (orders + order_items) e não mais depender de API em tempo real

---

### C) Visits (visitas por listing/dia)
**Status:** ✅ **RESOLVIDO**

**Sintoma original**
- Pipeline rodava e "upsertava" linhas (`rowsUpserted` correto)
- Mas `visits` no DB permanecia 0/NULL em todos os dias
- UI mostrava "visitas indisponíveis" mesmo após refresh

**Causa raiz**
- Parser não suportava formato real da API do ML
- Formato real: `response.data.results[]` com campos `date`, `total` e `visits_detail[]` (quantity)
- Parser buscava `entry.visits` que não existia no formato real
- Datas em formato ISO (`2026-01-22T00:00:00Z`) não eram normalizadas antes de salvar no map

**Fix implementado**
1. Parser ajustado para extrair na ordem:
   - `entry.visits` (se existir)
   - `entry.total` (se existir)
   - soma de `entry.visits_detail[].quantity` (se array)
2. Normalização de datas: ISO → `YYYY-MM-DD` UTC antes de salvar no map
3. Type guard com `VisitPoint` e `isVisitPoint` para filtrar null corretamente
4. Garantia: `0` somente quando fetch ok e dia ausente; erro → `NULL`

**Evidência de resolução**
- `positive_days = 91` (dias com visitas > 0)
- `total_visits_period = 803` (soma total no período)
- `null_days = 36` (esperado quando fetch falha ou dia ausente)
- `zero_days = 29` (dias com fetch ok mas 0 visitas)
- UI Dashboard Overview exibe gráfico de "Visitas" com valores reais
- Tooltip mostra valores corretos (ex: "Visitas: 40")
- **0 NULL visits** quando fetch é bem-sucedido
- **`rowsUpserted` consistentes** com dados reais no DB

**Observabilidade**
- `visits_status`: 'ok' | 'partial' | 'unavailable'
- `failures_summary`: contagem por `errorType` (RATE_LIMIT, FORBIDDEN, etc.)
- Instrumentação: `visitsMap` sum, `intersectionCount`, read-back do DB, DB fingerprint no startup

---

### D) Access Control & PolicyAgent Handling
**Status:** ✅ **RESOLVIDO**

**Sintoma original**
- Alguns listings retornavam `403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES` mesmo com token válido
- UI mostrava "Dados indisponíveis via API" de forma genérica
- Listings "órfãos" (de conexões antigas/revogadas) não eram identificados

**Causa raiz**
- Listings podem estar vinculados a conexões antigas/revogadas
- PolicyAgent do Mercado Livre bloqueia acesso a anúncios de outros sellers ou conexões antigas
- Sistema não distinguia entre "erro genérico da API" e "bloqueio específico por PolicyAgent"
- Sync processava listings bloqueados, gerando `NULL` em visits/metrics sem motivo claro

**Fix implementado**
1. **Introdução de `access_status`:**
   - `accessible`: Listing acessível via API
   - `unauthorized`: Erro de autenticação/autorização (401/403 não-PolicyAgent)
   - `blocked_by_policy`: Bloqueado por PolicyAgent (403 com `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`)
2. **Campos de diagnóstico:**
   - `access_blocked_code`: Código do erro (ex: `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`)
   - `access_blocked_reason`: Mensagem do erro
   - `access_blocked_at`: Timestamp do bloqueio
3. **Reconciliação de status:**
   - Batch API `/items?ids=...` autenticada para verificar status real
   - Mapeia resultados por índice (ordem dos IDs enviados)
   - Atualiza `status` (active/paused) quando divergente do ML
   - Marca `access_status` quando bloqueado por PolicyAgent
   - **Não altera `status` quando bloqueado** (status real fica desconhecido)
4. **Filtros de sync:**
   - Processa apenas listings com `access_status='accessible'` E `status IN ('active', 'paused')`
   - Exclui explicitamente `blocked_by_policy` e `unauthorized`
5. **UX/UI:**
   - Mensagens específicas: "Anúncio bloqueado por PolicyAgent do Mercado Livre" (com código)
   - Não mostra "Dados indisponíveis via API" genérico para bloqueios específicos

**Evidência de resolução**
- Listings bloqueados marcados corretamente: `access_status='blocked_by_policy'`
- `reconcile.blockedByPolicy >= 1` para listings com 403 PolicyAgent
- `reconcile.details` inclui `actionTaken='marked_blocked_by_policy'`
- UI exibe mensagem específica para listings bloqueados
- Sync não processa listings bloqueados (visits/metrics não tentam buscar dados inacessíveis)
- **Reconciliação funciona:** Listings `paused` no DB mas `active` no ML são atualizados

**Observabilidade**
- `/refresh` retorna `reconcile.details` com:
  - `listing_id_ext`, `oldStatus`, `mlStatus`, `httpStatus`, `errorCode`, `blockedBy`, `message`, `actionTaken`
- Logs estruturados (limitados aos primeiros 10 listings)
- Estatísticas: `candidates`, `checked`, `updated`, `blockedByPolicy`, `unauthorized`, `skipped`, `errors`

---

## 📌 Próximas ações (prioridade)
1) ✅ **Confirmar endpoint real e payload de VISITS** — CONCLUÍDO
2) ✅ **Ajustar integração/parse** — CONCLUÍDO
3) ✅ **Reprocessar visits e validar no DB** — CONCLUÍDO
4) ✅ **Análise IA Expert integrada (backend + frontend)** — TECNICAMENTE FUNCIONAL
5) ⏳ **Encerrar Dia 2:** Corrigir profundidade de descrição, promoção, vídeo e editUrl
6) Validar comportamento de orders quando connection active muda de sellerId
7) Estabilizar testes quebrados (ai-recommendations, metrics.test)
8) Validar botão "Atualizar dados" no UI

## 🔍 Pendências / Pontos de atenção

### Orders — Limit clamp
**Status:** ✅ RESOLVIDO
- **Incidente:** Erro 400 "Limit must be a lower or equal than 51" em produção
- **Fix:** Clamp explícito `limit = Math.min(requestedLimit ?? 51, 51)` em `fetchOrders` e `fetchOrdersFallback`
- **Decisão:** Erro 400 de orders não interrompe refresh de metrics/visits; apenas 401/403 interrompem

### Orders — Connection active vs revoked
**Status:** ✅ RESOLVIDO
- Existem múltiplas conexões ML no banco (active vs revoked)
- **Fix:** Sistema usa resolver determinístico (`resolveMercadoLivreConnection()`) com critérios explícitos
- **Prioridade:** access_token válido → refresh_token disponível → mais recente (updated_at DESC)
- **Logs estruturados:** Mostram qual conexão foi usada e por quê (connectionId, providerAccountId, reason)
- **Risco mitigado:** Seleção determinística evita uso de conexão incorreta

### Pricing / Promotions
**Status:** ✅ RESOLVIDO (com TTL escalável e force override)
- **Fonte de verdade:**
  - `price` / `original_price`: API `/items?ids=...` (multiget) ou `/items/{id}`
  - `price_final` / `discount_percent`: API `/items/{id}/prices` (Prices API) — **source of truth para promoções**
- **Fallback:** Se `/prices` falhar (403/404), usa `/items/{id}` como fallback
- **Campos garantidos:** `original_price`, `price_final`, `has_promotion`, `discount_percent`, `promotion_type` preenchidos quando promoção existe
- **Enriquecimento:** `enrichItemPricing()` busca dados completos via Prices API se multiget não trouxer dados suficientes
- **Logs estruturados:** `endpointUsed` (prices/items/none), `hasSalePrice`, `pricesCount`, `referencePricesCount` para diagnóstico
- **Validação:** Listing MLB4217107417 validado com promoção ativa (47% OFF, R$32 final, R$60 cheio)
- **⚠️ Divergência conhecida:** `/items/{id}/prices` pode retornar preço promocional diferente de `/items/{id}` (ex: MLB4167251409 mostra R$ 66,93 no `/prices` vs R$ 70,23 no `/items`). **Nunca usar heurística de desconto quando `/prices` estiver disponível.**
- **TTL (Time To Live) — Rate-limit safety:**
  - Sistema respeita TTL (`PROMO_PRICES_TTL_HOURS`, default 12h) para evitar rate limits
  - `/prices` só é chamado quando:
    - `promotion_checked_at` é `null` (nunca verificado)
    - `now - promotion_checked_at > TTL` (expirado)
    - `USE_ML_PRICES_FOR_PROMO=true` (flag ativa)
  - `promotion_checked_at` é atualizado apenas quando `/prices` é efetivamente chamado
  - **Rate-limit safety é requisito de produto:** TTL garante que sistema não abuse de API do ML
- **Feature flag:**
  - `USE_ML_PRICES_FOR_PROMO` via AWS Secrets Manager (App Runner)
  - Parser robusto suporta plaintext (`"true"`) e JSON (`{"USE_ML_PRICES_FOR_PROMO":"true"}`)
  - Permite ativar/desativar sem deploy
- **Force override:**
  - Endpoint `force-refresh` aceita query param `forcePromoPrices=true` para ignorar TTL
  - Força busca de `/prices` mesmo com `promotion_checked_at` recente
  - Útil para debug/manual force quando necessário
  - Não afeta comportamento padrão (respeita TTL quando ausente)
- **Observabilidade:**
  - Response do `force-refresh` inclui:
    - `config: { useMlPricesForPromo, promoPricesTtlHours, forcePromoPrices }`
    - `enrichment: { endpointUsed, statusCode, applied, payloadSize, appliedValues?, reason? }`
  - `endpointUsed`: `"prices"` (chamou), `"none"` (pulou), `"items"` (fallback)
  - `reason`: `"ttl_not_expired"`, `"flag_off"`, `"promo_not_effective"`, `"fetch_failed"`, `"no_prices_available"`
- **Helper:** `extractBuyerPricesFromMlPrices()` extrai preços do payload `/prices` com regras: `standard.amount` → originalPrice, `promotion.amount` → promotionalPrice, `promotion.regular_amount` → originalPrice (se disponível)

### Video / Clips
**Status:** ✅ **RESOLVIDO — Clips não são detectáveis via API pública**

**Decisão Arquitetural Oficial (2026-02-25):**
- **`has_video`**: Vídeo tradicional do ML (baseado em `video_id`/`videos[]`) — **detectável via API**
- **`has_clips`**: Clips do ML (curtos verticais) — **NÃO detectável via API pública para MLB**
- **Separação semântica**: Não inferir `has_clips` baseado em `video_id` (são coisas diferentes)

**Investigação Oficial:**
- `/items/{id}/clips` → `404 Not Found` (endpoint não existe)
- `/marketplace/items/{id}/clips` → `403 Forbidden` (PolicyAgent, requer permissões especiais)
- **Conclusão**: Clips não são detectáveis via API pública do Mercado Livre

**Regra de Persistência:**
- **Para MLB, `has_clips` deve ser `NULL` por padrão** (não setar `false` automaticamente)
- **Override manual** via `PATCH /api/v1/listings/:id/clips`:
  - `value: true` → `has_clips = true`, `clips_source = "override"`
  - `value: false` → `has_clips = false`, `clips_source = "override"`
  - `value: null` → `has_clips = null`, `clips_source = "unknown"` (remove override)

**Score e Penalização:**
- **`has_clips === true`**: Não penaliza, adiciona 10 pontos no score de mídia
- **`has_clips === false`**: Penaliza, mostra ganho potencial de +10 pontos
- **`has_clips === null`**: **NÃO penaliza**, mostra mensagem de limitação da API

**Fluxo de Detecção:**
1. **`has_video`**: Detectado via `extractHasVideoFromMlItem` (procura `video_id`, `videos[]`)
2. **`has_clips`**: Sempre `NULL` por padrão (não detectável via API)
3. **Override manual**: Usuário pode setar `true`/`false` via endpoint

**Documentação Completa:**
- Ver `apps/api/docs/CLIPS_API_INVESTIGATION.md` para detalhes da investigação

### Benchmark / Comparação com Concorrentes
**Status:** ✅ IMPLEMENTADO (Dia 04)
- **Fonte de dados:** `/sites/MLB/search` (endpoint público do ML) com `category` e `sort=relevance`
- **Sample size:** Até 20 concorrentes por categoria
- **Timeout:** 7 segundos para evitar travamentos
- **Headers:** User-Agent e Accept para melhor compatibilidade
- **Estatísticas calculadas:**
  - Mediana de `pictures_count`
  - Percentual com vídeo detectável (exclui `null`)
  - Mediana de preço
  - Mediana de tamanho do título
- **Baseline de conversão:** Agregação interna por categoria (últimos 30 dias, mínimo 30 listings ou 1000 visitas)
- **Diagnóstico:** Quando `competitors.length === 0`, inclui `benchmark._debug` com:
  - `stage`: Tipo de erro (ml-search-rate-limited, ml-search-timeout, ml-search-forbidden, etc)
  - `error`: Mensagem detalhada
  - `categoryId`: Categoria que falhou
  - `statusCode`: HTTP status code quando disponível
- **Notes específicos:** Baseados no tipo de erro (rate limit, timeout, forbidden, etc)
- **Confiança:** `high` | `medium` | `low` | `unavailable` baseado em sample size e baseline
- **Nunca retorna null:** Sempre retorna objeto com `confidence='unavailable'` quando dados insuficientes

## 🧪 Queries padrão de auditoria
### Range geral (orders/gmv/visits)
SELECT
  COUNT(*) AS rows,
  COALESCE(SUM(orders),0) AS sum_orders,
  COALESCE(SUM(gmv),0) AS sum_gmv,
  COUNT(visits) AS rows_with_visits,
  COALESCE(SUM(visits),0) AS sum_visits,
  MIN(date) AS min_date,
  MAX(date) AS max_date
FROM listing_metrics_daily
WHERE tenant_id = '<tenant>'
  AND date >= '<from>'
  AND date <= '<to>';

### Série por dia (visits)
SELECT date::date, SUM(visits) AS visits
FROM listing_metrics_daily
WHERE tenant_id = '<tenant>'
  AND date >= '<from>'
  AND date <= '<to>'
GROUP BY 1
ORDER BY 1;
