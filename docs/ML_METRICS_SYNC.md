# Sincronização de Métricas do Mercado Livre

## Visão Geral

Este documento descreve como funciona a sincronização de métricas de performance dos anúncios do Mercado Livre para o banco de dados `listing_metrics_daily`.

## Endpoints

### POST /api/v1/sync/mercadolivre/metrics
### POST /api/v1/sync/mercadolivre/performance (alias)

**Query Params:**
- `days`: Número de dias para buscar métricas (default: 30, max: 90)

**Resposta:**
```json
{
  "message": "Sincronização de performance concluída com sucesso",
  "data": {
    "listingsProcessed": 10,
    "rowsUpserted": 10,
    "min_date": "2024-12-01",
    "max_date": "2024-12-10",
    "duration": "5000ms"
  }
}
```

## Fontes de Dados

A sincronização busca métricas de múltiplas fontes:

1. **ml_orders_period**: Orders e GMV do período via Orders API (`/orders/search`)
   - **Fonte confiável**: Busca pedidos pagos do período (últimos N dias)
   - Calcula `orders_30d` = soma de quantidades de itens vendidos no período
   - Calcula `gmv_30d` = soma de `unit_price * quantity` dos itens vendidos
   - **NÃO usa `sold_quantity` do `/items/{id}`** (é lifetime, não período)

2. **ml_items_aggregate**: Visitas do endpoint `/items/{id}` (se disponível)
   - Campo: `visits` (pode ser lifetime ou período, não é garantido)
   - Se `visits` não estiver disponível → `visits = null` (unknown)

3. **unknown**: Quando não há dados disponíveis
   - `visits = null` (não gravar 0 como se fosse real)
   - `orders = 0` (se não houver pedidos no período)

## Estratégia de Persistência

### Não Distribuição Uniforme

**IMPORTANTE**: A API do Mercado Livre não fornece métricas diárias diretamente. O sistema **NÃO distribui uniformemente** os valores pelos dias do período, pois isso criaria dados falsos.

### Agregação no Dia Atual

Em vez de distribuir, o sistema:
1. Busca métricas agregadas do endpoint `/items/{id}`
2. Salva como um **ponto único no dia atual** (representando o agregado do período)
3. Marca a origem dos dados no campo `source`

### Campo `source`

O campo `source` em `listing_metrics_daily` indica a origem dos dados:
- `ml_orders_period`: Orders e GMV do período via Orders API (fonte confiável)
- `ml_items_aggregate`: Visitas do endpoint `/items/{id}` (pode ser lifetime)
- `ml_orders_period,ml_items_aggregate`: Ambos disponíveis
- `unknown`: Sem dados disponíveis

### Campo `period_days`

O campo `period_days` indica o período agregado (ex: 30 para agregado de 30 dias).

### Campo `visits` (Nullable)

O campo `visits` é nullable:
- `null` = unknown (não disponível via API)
- `0` = zero real (confirmado)
- `> 0` = valor conhecido

**IMPORTANTE**: Não gravar `0` quando visits é unknown. Use `null` para diferenciar.

## Limitações

1. **Métricas Diárias**: A API do ML não fornece série temporal diária. Os dados são agregados e salvos como 1 registro no dia atual com `period_days`.

2. **Visitas Unknown**: Se `visits` não estiver disponível via API, o sistema salva `visits = null` (unknown) com `source='unknown'` ou `source='ml_orders_period'` (se orders estiverem disponíveis). **NÃO grava 0 como se fosse real**.

3. **Orders Lifetime vs Período**: O campo `sold_quantity` do `/items/{id}` é lifetime (total desde sempre), não período. Por isso, orders vêm exclusivamente da Orders API do período.

4. **Atualização de Agregados**: O sistema atualiza `visits_last_7d` e `sales_last_7d` no `listing` com base nas métricas diárias salvas, mas se houver apenas um ponto agregado, esses valores podem não refletir exatamente os últimos 7 dias.

## Uso no Payload da IA

O `buildAIAnalyzeInput` usa `listing_metrics_daily` quando disponível:
- Agrega `visits` (tratando `null` como unknown), `orders`, `gmv` dos últimos 30 dias
- Calcula `conversionRate` apenas se `visits` for conhecido (não null)
- Calcula `ctr` médio apenas se `visits` for conhecido
- Adiciona warnings quando:
  - Visitas são unknown (`visits_unknown_via_api`) - **IA não pode concluir "zero visitas"**
  - Não há métricas diárias (`no_daily_metrics`)
  - Visitas estão zeradas mas métricas existem (`visits_zero_but_metrics_exist`)
  - Não há métricas disponíveis (`no_metrics_available`)

## Verificação de Dados

Para verificar se os dados foram sincronizados corretamente:

### Verificação de Métricas Agregadas

```sql
SELECT
  l.id, l.listing_id_ext,
  -- Visits: tratar null como unknown
  CASE 
    WHEN COUNT(m.id) = 0 THEN 'NO_METRICS'
    WHEN COUNT(m.id) FILTER (WHERE m.visits IS NULL) = COUNT(m.id) THEN 'VISITS_UNKNOWN'
    ELSE COALESCE(SUM(m.visits), 0)::TEXT
  END AS visits_30d_status,
  COALESCE(SUM(m.visits), 0) AS visits_30d_sum, -- Soma (null = 0 para cálculo)
  COUNT(m.id) FILTER (WHERE m.visits IS NULL) AS visits_null_count,
  -- Orders e GMV: sempre somar (0 se não houver)
  COALESCE(SUM(m.orders), 0) AS orders_30d,
  COALESCE(SUM(m.gmv), 0)    AS gmv_30d,
  MIN(m.date) AS min_date, 
  MAX(m.date) AS max_date,
  MAX(m.period_days) AS period_days,
  COUNT(DISTINCT m.source) AS sources_count,
  STRING_AGG(DISTINCT m.source, ', ') AS sources
FROM listings l
LEFT JOIN listing_metrics_daily m
  ON m.listing_id = l.id
 AND m.tenant_id  = l.tenant_id
 AND m.date >= CURRENT_DATE - INTERVAL '30 days'
WHERE l.tenant_id = '<TENANT_ID>'
  AND l.marketplace='mercadolivre'
  AND l.listing_id_ext='<ITEM_ID>'
GROUP BY l.id, l.listing_id_ext;
```

### Comparar Orders do BD vs Orders API

```sql
-- Orders calculados do BD (listing_metrics_daily)
SELECT 
  l.listing_id_ext,
  COALESCE(SUM(m.orders), 0) AS orders_30d_from_metrics,
  COALESCE(SUM(m.gmv), 0) AS gmv_30d_from_metrics,
  MAX(m.source) AS source
FROM listings l
LEFT JOIN listing_metrics_daily m
  ON m.listing_id = l.id
 AND m.tenant_id = l.tenant_id
 AND m.date >= CURRENT_DATE - INTERVAL '30 days'
WHERE l.tenant_id = '<TENANT_ID>'
  AND l.marketplace='mercadolivre'
  AND l.listing_id_ext='MLB4217107417'
GROUP BY l.listing_id_ext;

-- Orders reais do período (orders table)
SELECT 
  l.listing_id_ext,
  COUNT(DISTINCT o.id) AS orders_count_30d,
  SUM(oi.quantity) AS items_sold_30d,
  SUM(oi.total_price) AS gmv_30d
FROM listings l
INNER JOIN order_items oi ON oi.listing_id_ext = l.listing_id_ext
INNER JOIN orders o ON o.id = oi.order_id
WHERE l.tenant_id = '<TENANT_ID>'
  AND l.marketplace='mercadolivre'
  AND l.listing_id_ext='MLB4217107417'
  AND o.status IN ('paid', 'shipped', 'delivered')
  AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY l.listing_id_ext;
```

### Listar Itens com Visits Unknown

```sql
SELECT 
  l.id,
  l.listing_id_ext,
  l.title,
  COUNT(m.id) AS metrics_count,
  COUNT(m.id) FILTER (WHERE m.visits IS NULL) AS visits_null_count,
  MAX(m.source) AS source,
  MAX(m.period_days) AS period_days
FROM listings l
INNER JOIN listing_metrics_daily m
  ON m.listing_id = l.id
 AND m.tenant_id = l.tenant_id
 AND m.date >= CURRENT_DATE - INTERVAL '30 days'
WHERE l.tenant_id = '<TENANT_ID>'
  AND l.marketplace='mercadolivre'
  AND m.visits IS NULL
GROUP BY l.id, l.listing_id_ext, l.title
ORDER BY visits_null_count DESC;
```

## Troubleshooting

### Visitas Unknown (null) mas Painel Mostra Valores

**Causa**: O endpoint `/items/{id}` pode não retornar `visits` ou não ter permissão para acessar métricas de visitas.

**Solução**: 
1. Verificar se o token do ML tem permissões para acessar métricas de visitas
2. Verificar se o item realmente tem visitas no painel
3. O sistema salva `visits = null` (unknown) - isso é correto, não gravar 0 como se fosse real
4. A IA não pode concluir "zero visitas" quando `visits_unknown_via_api` está no warning

### Orders Inflados (usando sold_quantity lifetime)

**Causa**: Sistema anterior usava `sold_quantity` do `/items/{id}` que é lifetime, não período.

**Solução**: 
1. Sistema atualizado usa Orders API do período (`/orders/search`)
2. Orders são calculados apenas de pedidos pagos do período
3. Verificar se `source` contém `ml_orders_period` na métrica

### Métricas Não Atualizadas

**Causa**: O sistema só atualiza se novos valores forem maiores que os existentes.

**Solução**: 
1. Verificar logs do sync
2. Verificar se o token está válido
3. Verificar se o listing está ativo

## Próximos Passos

1. **Endpoint de Métricas Específico**: Se a API do ML fornecer endpoint específico de métricas (ex: `/items/{id}/metrics`), usar esse endpoint em vez de `/items/{id}`.

2. **Série Temporal Real**: Se a API fornecer série temporal diária, persistir cada dia separadamente com `source='ml_metrics_api'`.

3. **Validação de Discrepâncias**: Adicionar validação para detectar quando visitas no BD estão zeradas mas o painel mostra valores, e adicionar warning explícito.

