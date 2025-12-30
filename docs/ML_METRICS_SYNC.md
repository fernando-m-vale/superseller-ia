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

A sincronização busca métricas de múltiplas fontes, na seguinte ordem de prioridade:

1. **ml_items_aggregate**: Dados do endpoint `/items/{id}` do Mercado Livre
   - Campos: `visits`, `sold_quantity`
   - Representa métricas agregadas do item

2. **listing_aggregates**: Dados já salvos no campo `listing` (visits_last_7d, sales_last_7d)
   - Usado como fallback quando API não retorna dados

3. **estimate**: Estimativa/zero quando não há dados disponíveis

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
- `ml_items_aggregate`: Dados do endpoint `/items/{id}`
- `listing_aggregates`: Dados já salvos no listing
- `estimate`: Estimativa/zero

## Limitações

1. **Métricas Diárias**: A API do ML não fornece série temporal diária. Os dados são agregados.

2. **Visitas Zeradas**: Se `visits` vier como `0` ou `null` do endpoint `/items/{id}`, o sistema salva `0` com flag de origem. Isso pode não refletir o painel do ML se houver discrepância.

3. **Atualização de Agregados**: O sistema atualiza `visits_last_7d` e `sales_last_7d` no `listing` com base nas métricas diárias salvas, mas se houver apenas um ponto agregado, esses valores podem não refletir exatamente os últimos 7 dias.

## Uso no Payload da IA

O `buildAIAnalyzeInput` usa `listing_metrics_daily` quando disponível:
- Agrega `visits`, `orders`, `gmv` dos últimos 30 dias
- Calcula `conversionRate` e `ctr` médio
- Adiciona warnings quando:
  - Não há métricas diárias (`no_daily_metrics`)
  - Visitas estão zeradas mas métricas existem (`visits_zero_but_metrics_exist`)
  - Não há métricas disponíveis (`no_metrics_available`)

## Verificação de Dados

Para verificar se os dados foram sincronizados corretamente:

```sql
SELECT
  l.id, l.listing_id_ext,
  COALESCE(SUM(m.visits),0) AS visits_30d,
  COALESCE(SUM(m.orders),0) AS orders_30d,
  COALESCE(SUM(m.gmv),0)    AS gmv_30d,
  MIN(m.date) AS min_date, MAX(m.date) AS max_date,
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

## Troubleshooting

### Visitas Zeradas no BD mas Painel Mostra Valores

**Causa**: O endpoint `/items/{id}` pode não retornar `visits` ou retornar `0` mesmo quando o painel mostra valores.

**Solução**: 
1. Verificar se o token do ML tem permissões para acessar métricas
2. Verificar se o item realmente tem visitas no painel
3. Considerar usar endpoint específico de métricas (se disponível na API do ML)

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

