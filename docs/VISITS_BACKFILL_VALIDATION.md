# Validação Manual - Backfill de Visitas Granular

## Endpoint

`POST /api/v1/sync/mercadolivre/visits/backfill`

## Pré-requisitos

1. Tenant com conexão Mercado Livre ativa
2. Listings populados (via FULL sync ou fallback)
3. Token de autenticação válido

## Validação Manual

### 1. FULL Sync

```bash
curl -X POST http://localhost:3001/api/v1/sync/mercadolivre/full \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
- `listings.itemsProcessed > 0`
- `listings.itemsCreated > 0` ou `listings.itemsUpdated > 0`

**Verificação SQL:**
```sql
SELECT COUNT(*) FROM listings WHERE tenant_id = '<tenant_id>';
```

### 2. Backfill de Visitas

```bash
curl -X POST http://localhost:3001/api/v1/sync/mercadolivre/visits/backfill?days=30 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
```json
{
  "message": "Backfill de visitas concluído com sucesso",
  "data": {
    "days": 30,
    "listingsConsidered": N,
    "batchesPerDay": X,
    "rowsUpserted": Y,
    "rowsWithNull": Z,
    "duration": "...",
    "errors": []
  }
}
```

**Verificações:**
- `listingsConsidered > 0` (listings encontrados)
- `rowsUpserted > 0` (métricas criadas/atualizadas)
- `rowsWithNull >= 0` (dias sem visitas disponíveis)
- `errors.length === 0` (sem erros críticos)

### 3. Validação SQL

#### 3.1 Verificar source e discovery_blocked

```sql
SELECT 
  source, 
  discovery_blocked, 
  COUNT(*) 
FROM listings 
WHERE tenant_id = '<tenant_id>'
GROUP BY source, discovery_blocked;
```

**Resultado esperado:**
- `source = 'discovery'` e `discovery_blocked = false` (fluxo normal)
- `source = 'orders_fallback'` e `discovery_blocked = true` (fallback via Orders)
- `source = NULL` (listings antigos ou resync)

#### 3.2 Verificar métricas diárias populadas

```sql
SELECT 
  COUNT(*) as total_metrics,
  COUNT(visits) as metrics_with_visits,
  COUNT(*) - COUNT(visits) as metrics_with_null_visits
FROM listing_metrics_daily 
WHERE tenant_id = '<tenant_id>'
  AND date >= (CURRENT_DATE - INTERVAL '30 days');
```

**Resultado esperado:**
- `total_metrics > 0` (métricas criadas)
- `metrics_with_visits >= 0` (dias com visitas disponíveis)
- `metrics_with_null_visits >= 0` (dias sem visitas - NULL, não 0)

#### 3.3 Verificar granularidade diária

```sql
SELECT 
  date,
  COUNT(*) as listings_count,
  SUM(CASE WHEN visits IS NULL THEN 1 ELSE 0 END) as null_visits,
  SUM(CASE WHEN visits IS NOT NULL THEN 1 ELSE 0 END) as with_visits
FROM listing_metrics_daily 
WHERE tenant_id = '<tenant_id>'
  AND date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY date
ORDER BY date DESC
LIMIT 10;
```

**Resultado esperado:**
- Uma linha por dia (granularidade diária)
- `listings_count > 0` (métricas por listing)
- `null_visits + with_visits = listings_count` (soma correta)

#### 3.4 Verificar idempotência

```sql
-- Executar backfill duas vezes e verificar que não há duplicatas
SELECT 
  tenant_id,
  listing_id,
  date,
  COUNT(*) as duplicate_count
FROM listing_metrics_daily 
WHERE tenant_id = '<tenant_id>'
  AND date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY tenant_id, listing_id, date
HAVING COUNT(*) > 1;
```

**Resultado esperado:**
- 0 linhas (sem duplicatas - constraint único funciona)

### 4. Validação de Logs

Verificar logs estruturados no console:

```
[ML-VISITS-BACKFILL] [backfill-granular-<timestamp>] Iniciando backfill granular tenantId=<id> days=30 batchSize=50 concurrency=5
[ML-VISITS-BACKFILL] [backfill-granular-<timestamp>] Conexão carregada tenantId=<id> sellerId=<seller_id>
[ML-VISITS-BACKFILL] [backfill-granular-<timestamp>] Listings encontrados: <N> tenantId=<id>
[ML-VISITS-BACKFILL] [backfill-granular-<timestamp>] Criados <X> batches de até 50 itemIds
[ML-VISITS-BACKFILL] [backfill-granular-<timestamp>] Processando batch 1/<X> (<N> itemIds)
[ML-VISITS-BACKFILL] [backfill-granular-<timestamp>] Backfill concluído tenantId=<id> sellerId=<seller_id> durationMs=<ms> rowsUpserted=<Y> rowsWithNull=<Z> errors=<E>
```

**Verificações:**
- `tenantId` presente em todos os logs
- `sellerId` presente após carregar conexão
- `listingsCount` corresponde ao número de listings
- `batchesPerDay` calculado corretamente
- `rowsUpserted` e `rowsWithNull` somam corretamente
- Sem tokens nos logs

### 5. Validação de Erros

#### 5.1 Rate Limit (429)

```bash
# Simular rate limit (se ocorrer)
# O sistema deve fazer backoff e retry automaticamente
```

**Resultado esperado:**
- Log: `Erro 429 para itemId <id>, retry <N>/3 após <ms>ms`
- Retry automático após backoff
- Não aborta todo o processo

#### 5.2 Erro 5xx

```bash
# Simular erro 5xx (se ocorrer)
# O sistema deve fazer backoff e retry automaticamente
```

**Resultado esperado:**
- Log: `Erro <status> para itemId <id>, retry <N>/3 após <ms>ms`
- Retry automático após backoff
- Se falhar após 3 retries, visits = NULL (não 0)

#### 5.3 Erro de Autenticação (401/403)

```bash
# Se token expirar durante o processo
```

**Resultado esperado:**
- Log: `Erro de autenticação (<status>) para itemId <id>`
- Aborta o processo
- Retorna 401 na resposta

## Checklist de Validação

- [ ] FULL sync popula listings (`COUNT(*) FROM listings > 0`)
- [ ] Backfill endpoint não retorna 404 (existe e funciona)
- [ ] `listing_metrics_daily` populada com granularidade diária
- [ ] `visits = NULL` quando API não retorna (nunca 0)
- [ ] Idempotência: rodar duas vezes não cria duplicatas
- [ ] Logs estruturados com `tenantId`, `sellerId`, contadores
- [ ] Sem tokens nos logs
- [ ] Backoff funciona em 429/5xx
- [ ] Controle de concorrência (5 requests paralelas)
- [ ] Batching correto (50 itemIds por batch)

## Notas

- O endpoint processa todos os listings do tenant (não apenas ativos)
- Visits = NULL quando API não retorna dados (não converte para 0)
- Constraint único garante idempotência (`tenant_id`, `listing_id`, `date`)
- Backoff exponencial: 1s, 2s, 4s (max 10s)
- Concorrência limitada a 5 requests paralelas por batch

