# HOTFIX DIA 08 — Validação e Queries SQL

## 🐛 Bug Crítico Corrigido: Self-Lock no JobRunner

### Problema
O JobRunner estava se auto-bloqueando e marcando jobs como `skipped` com erro `Lock ativo: lock_running`.

**Evidência:**
- `sync_jobs` mostrava TENANT_SYNC como `skipped` com `error = 'Lock ativo: lock_running'`
- `started_at`/`finished_at` preenchidos (runner pegou o job e pulou)
- `listings.last_synced_at` continuava NULL (nenhum LISTING_SYNC efetivo)

### Causa Raiz
Em `JobRunner.ts`, após `dequeue()` (que faz claim e marca o job como `running`), o runner chamava `checkLock(job.lockKey)`.
`checkLock()` procurava job `running` pelo `lock_key` e encontrava o **PRÓPRIO job** (acabara de ser marcado running).
Resultado: `isLocked=true` => runner chamava `markSkipped()` => nenhum job executava.

### Correção Aplicada (Abordagem A)
**Removido o `checkLock` do JobRunner após `dequeue()`.**

**Justificativa:**
- O `dequeue()` já faz claim atômico com transação (`updateMany` com `status='queued'`)
- O `enqueue()` já tem dedupe por `lock_key` (verifica jobs existentes antes de criar)
- O índice único parcial (`UNIQUE(lock_key) WHERE status IN ('queued','running')`) garante que não há duplicação
- Verificar lock após o claim causava self-lock desnecessário

**Nota:** O `checkLock` ainda é usado em `sync.routes.ts` **antes** de enfileirar jobs, o que está correto.

### Queries Esperadas Pós-Fix

#### 1. Jobs devem transicionar corretamente (não skipped por lock_running)
```sql
SELECT 
  status,
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN error LIKE '%lock_running%' THEN 1 END) as skipped_by_lock
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY status, type
ORDER BY status, type;
```
**Esperado:** `skipped_by_lock = 0` para jobs recentes

#### 2. TENANT_SYNC deve criar LISTING_SYNC jobs
```sql
SELECT 
  t.id as tenant_sync_id,
  t.status as tenant_status,
  COUNT(l.id) as listing_sync_count,
  COUNT(CASE WHEN l.status = 'success' THEN 1 END) as listing_success_count
FROM sync_jobs t
LEFT JOIN sync_jobs l ON l.payload->>'listingId' IS NOT NULL
  AND l.created_at BETWEEN t.created_at AND t.created_at + INTERVAL '5 minutes'
WHERE t.type = 'TENANT_SYNC'
  AND t.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY t.id, t.status
ORDER BY t.created_at DESC
LIMIT 10;
```
**Esperado:** `listing_sync_count > 0` e `listing_success_count > 0`

#### 3. Listings devem ter last_synced_at atualizado
```sql
SELECT 
  listing_id_ext,
  last_synced_at,
  last_sync_status,
  last_sync_error
FROM listings
WHERE last_synced_at >= NOW() - INTERVAL '1 hour'
ORDER BY last_synced_at DESC
LIMIT 20;
```
**Esperado:** `last_synced_at` preenchido e `last_sync_status = 'success'`

#### 4. Métricas 30d devem estar atualizadas
```sql
SELECT 
  l.listing_id_ext,
  COUNT(m.date) as metrics_days,
  MAX(m.date) as latest_metric_date
FROM listings l
LEFT JOIN listing_metrics_daily m ON m.listing_id = l.id
WHERE l.last_synced_at >= NOW() - INTERVAL '1 hour'
GROUP BY l.id, l.listing_id_ext
ORDER BY l.last_synced_at DESC
LIMIT 10;
```
**Esperado:** `metrics_days > 0` e `latest_metric_date` recente

---

## Queries SQL para Validação

### 1) Contar jobs por status nas últimas 24h

```sql
SELECT 
  status,
  COUNT(*) as count
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status;
```

### 2) Verificar 10 jobs mais recentes

```sql
SELECT 
  id,
  type,
  status,
  lock_key,
  run_after,
  started_at,
  finished_at,
  attempts,
  created_at
FROM sync_jobs
ORDER BY created_at DESC
LIMIT 10;
```

### 3) Validar timestamps vs NOW() (sem negativo)

```sql
SELECT 
  id,
  last_auto_sync_at,
  last_manual_sync_at,
  NOW() - last_auto_sync_at as diff_auto,
  NOW() - last_manual_sync_at as diff_manual
FROM tenants
WHERE last_auto_sync_at IS NOT NULL OR last_manual_sync_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### 4) Verificar jobs duplicados (TENANT_SYNC)

```sql
SELECT 
  lock_key,
  COUNT(*) as count,
  array_agg(status) as statuses,
  array_agg(id) as job_ids
FROM sync_jobs
WHERE type = 'TENANT_SYNC'
  AND status IN ('queued', 'running')
GROUP BY lock_key
HAVING COUNT(*) > 1;
```

### 5) Verificar índice único parcial

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sync_jobs'
  AND indexname LIKE '%lock_key%';
```

## Passos para Ativar ENABLE_JOB_RUNNER em Produção

1. **Configurar variável de ambiente:**
   ```bash
   ENABLE_JOB_RUNNER=true
   ```

2. **Rodar migration:**
   ```bash
   pnpm --filter @superseller/api prisma migrate deploy
   ```

3. **Verificar logs do JobRunner:**
   - Deve aparecer: `[JOB_RUNNER] Iniciando runner...`
   - Deve aparecer: `[JOB_RUNNER] Driver: db`
   - Deve aparecer: `[JOB_RUNNER] Process ID: <pid>`

4. **Testar endpoint de health:**
   ```bash
   curl -H "x-debug: 1" https://api.superselleria.com.br/api/v1/sync/jobs/health
   ```

5. **Monitorar jobs:**
   - Verificar que jobs queued estão sendo processados
   - Verificar que started_at e finished_at estão sendo preenchidos
   - Verificar que não há duplicação de TENANT_SYNC

## Riscos e Mitigação

### Risco 1: Migration pode falhar se índice já existir
**Mitigação:** Migration usa `IF NOT EXISTS` (mas PostgreSQL não suporta isso em CREATE UNIQUE INDEX). 
**Solução:** Se falhar, rodar manualmente:
```sql
DROP INDEX IF EXISTS sync_jobs_lock_key_unique;
CREATE UNIQUE INDEX sync_jobs_lock_key_unique ON sync_jobs (lock_key) 
WHERE status IN ('queued', 'running');
```

### Risco 2: Timezone inconsistente em dados existentes
**Mitigação:** Migration usa `AT TIME ZONE 'UTC'` assumindo que valores existentes estão em UTC.
**Validação:** Rodar query 3 acima para verificar diferenças negativas.

### Risco 3: JobRunner não inicia em produção
**Mitigação:** Logs explícitos no startup. Endpoint de health para verificar.
**Validação:** Verificar logs e endpoint `/sync/jobs/health`.

### Risco 4: Dedupe não funciona com múltiplas réplicas
**Mitigação:** Índice único parcial + verificação no enqueue.
**Validação:** Query 4 acima para verificar duplicatas.

## Evidências Esperadas (pós-deploy)

1. **Abrir /listings:**
   - Log: `[AUTO_SYNC] Disparando auto-sync...`
   - Log: `[DB_QUEUE] Job criado: jobId=...`
   - Query: `SELECT COUNT(*) FROM sync_jobs WHERE type='TENANT_SYNC' AND created_at > NOW() - INTERVAL '1 minute'` deve retornar <= 1

2. **JobRunner processando:**
   - Log: `[JOB_RUNNER] Processando job jobId=...`
   - Log: `[TENANT_SYNC] Iniciando tenantId=...`
   - Query: `SELECT COUNT(*) FROM sync_jobs WHERE status='running'` deve retornar > 0 durante execução

3. **Jobs concluídos:**
   - Log: `[JOB_RUNNER] Job concluído jobId=...`
   - Log: `[TENANT_SYNC] Concluído tenantId=...`
   - Query: `SELECT COUNT(*) FROM sync_jobs WHERE status='success' AND finished_at IS NOT NULL` deve aumentar
