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

**Observabilidade**
- `visits_status`: 'ok' | 'partial' | 'unavailable'
- `failures_summary`: contagem por `errorType` (RATE_LIMIT, FORBIDDEN, etc.)
- Instrumentação: `visitsMap` sum, `intersectionCount`, read-back do DB, DB fingerprint no startup

---

## 📌 Próximas ações (prioridade)
1) ✅ **Confirmar endpoint real e payload de VISITS** — CONCLUÍDO
2) ✅ **Ajustar integração/parse** — CONCLUÍDO
3) ✅ **Reprocessar visits e validar no DB** — CONCLUÍDO
4) Validar comportamento de orders quando connection active muda de sellerId
5) Estabilizar testes quebrados (ai-recommendations, metrics.test)
6) Validar botão "Atualizar dados" no UI

## 🔍 Pendências / Pontos de atenção

### Orders — Limit clamp
**Status:** ✅ RESOLVIDO
- **Incidente:** Erro 400 "Limit must be a lower or equal than 51" em produção
- **Fix:** Clamp explícito `limit = Math.min(requestedLimit ?? 51, 51)` em `fetchOrders` e `fetchOrdersFallback`
- **Decisão:** Erro 400 de orders não interrompe refresh de metrics/visits; apenas 401/403 interrompem

### Orders — Connection active vs revoked
**Status:** 🟡 PONTO DE ATENÇÃO
- Existem múltiplas conexões ML no banco (active vs revoked)
- Sistema usa sempre a conexão `active` mais recente
- **Risco:** Se connection active mudou de `sellerId`, orders podem não refletir seller atual
- **Ação:** Investigar se orders=0 quando connection mudou de sellerId é comportamento esperado

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
