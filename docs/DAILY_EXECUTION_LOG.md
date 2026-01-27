# DAILY EXECUTION LOG — 2026-01-22

## ✅ STATUS: CONCLUÍDO

## 🎯 Foco do dia
**Correção definitiva do sync de visits + tratamento de bloqueios PolicyAgent**

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

## 🧠 Descobertas
- **Formato real da API ML:** `response.data.results[]` com campos `date`, `total` e `visits_detail[]` (quantity)
- Parser anterior buscava `entry.visits` que não existia no formato real
- Datas em formato ISO (`2026-01-22T00:00:00Z`) precisavam normalização antes de salvar no map
- **Múltiplas conexões ML:** existe connection `active` (provider_account_id = 189663082) e `revoked` (2019955315)
- Sistema usa sempre a conexão `active` mais recente; divergências de `sellerId` podem explicar diferenças em orders
- **403 PolicyAgent:** Alguns listings retornam `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` mesmo com token válido (listings "órfãos" de conexões antigas)
- **Batch API `/items?ids=...`:** Retorna array na mesma ordem dos IDs enviados; cada item tem `{code, body}` onde `code=200` → item completo, `code!=200` → erro

## ⚠️ Bloqueios / riscos
- **Erro 400 orders limit:** ocorreu em produção; corrigido com clamp `limit <= 51`
- **Orders com connection active vs revoked:** investigar se orders=0 quando connection mudou de sellerId é comportamento esperado
- **Listings bloqueados por PolicyAgent:** Não são processados em visits/metrics (comportamento correto)

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

### Decisões conscientes (backlog)
- **Backfill manual:** Por enquanto, backfill de visits é manual via endpoint; automação futura
- **Multi-conexões:** Não resolver suporte a múltiplas conexões ativas simultaneamente agora (usa sempre a mais recente `active`)
- **Inserção manual de anúncios:** Não implementado; sistema depende de sync do ML

## ➡️ Próximo passo claro
**Dia 2: Foco em Orders + estrutura multi-contas**
1) Validar comportamento de orders quando connection active mudou de sellerId
2) Investigar estrutura para suportar múltiplas contas/conexões (UX e backend)
3) Corrigir testes quebrados (ai-recommendations, metrics.test)
4) Validar botão "Atualizar dados" no UI
