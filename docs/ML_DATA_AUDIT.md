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
**Status:** 🟡 PARCIAL (pipeline roda, mas valores ainda 0)

**O que funciona**
- Endpoint/serviço roda e “upserta” linhas no range
- Não grava mais NULL quando fetch ok (default 0)
- coverage no /overview não acusa mais indisponível quando preenchido

**Problema atual**
- Todos os valores persistidos ainda estão 0 (mesmo com visitas no painel do Mercado Livre)
- Precisa validar:
  - endpoint correto
  - shape do payload
  - permissões/escopo do token
  - timezone/dia
  - formato do itemId

**DoD**
- `SUM(visits) > 0` para pelo menos alguns dias
- /overview exibindo série de visitas > 0 e coverage correto

---

## 📌 Próximas ações (prioridade)
1) Confirmar endpoint real e payload de VISITS do ML com request manual (1 item)
2) Ajustar integração/parse/identificador conforme necessário
3) Reprocessar visits (7 e 30 dias) e validar no DB
4) Só depois seguir para IA Score V2

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
