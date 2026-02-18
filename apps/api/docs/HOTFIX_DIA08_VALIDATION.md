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

## 📊 Estado Atual em Produção (Evidências Confirmadas)

### ✅ Evidências Positivas

1. **JobRunner ativo:**
   - App Runner configurado com `ENABLE_JOB_RUNNER=true` e `JOB_QUEUE_DRIVER=db`
   - Endpoint `GET /api/v1/sync/jobs/health` com `x-debug=1` retorna `jobRunnerEnabled: true`

2. **Sync manual funcionando:**
   - Ao clicar "Sincronizar agora" em `/listings`, `POST /api/v1/sync/tenant/manual` retorna `{ started: true, jobId: ... }`

3. **Jobs sendo processados:**
   - Existem jobs `TENANT_SYNC` e `LISTING_SYNC` com `status=success` no banco
   - `listings.last_synced_at` começou a ser preenchido para alguns anúncios

### ⚠️ Pontos de Atenção

1. **Jobs skipped com lock_running:**
   - Ainda existem alguns jobs com `status=skipped` e `error="Lock ativo: lock_running"`
   - **A confirmar:** Se são resíduos históricos (antes do fix) ou se ainda estão sendo gerados

2. **Migration pendente:**
   - Em `_prisma_migrations`, a migration `20260214000000_fix_sync_jobs_timezone_and_dedupe` aparece com `finished_at NULL` e `applied_steps_count 0`
   - **Suspeita:** Migration pode não ter sido aplicada no banco PROD

---

## ✅ Checklist de Validação (Critérios Objetivos)

### 1. JobRunner Habilitado
**Critério:** `GET /api/v1/sync/jobs/health` com `x-debug=1` retorna `jobRunnerEnabled: true`

**Query de validação:**
```bash
curl -H "x-debug: 1" https://api.superselleria.com.br/api/v1/sync/jobs/health
```

**PASS:** `jobRunnerEnabled: true`  
**FAIL:** `jobRunnerEnabled: false` ou endpoint retorna erro

**Status atual:** ✅ **PASS** (confirmado em produção)

---

### 2. Sync Manual Gera Jobs e Processa
**Critério:** Clicar "Sincronizar agora" gera `TENANT_SYNC` com `status=success` e cria `LISTING_SYNC` jobs que também completam com `status=success`

**Query de validação:**
```sql
-- Buscar último TENANT_SYNC manual (criado após sync manual)
SELECT 
  id,
  type,
  status,
  created_at,
  started_at,
  finished_at,
  error
FROM sync_jobs
WHERE type = 'TENANT_SYNC'
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 1;

-- Verificar LISTING_SYNC criados por esse TENANT_SYNC
SELECT 
  id,
  type,
  status,
  payload->>'listingId' as listing_id,
  created_at,
  started_at,
  finished_at,
  error
FROM sync_jobs
WHERE type = 'LISTING_SYNC'
  AND created_at >= (
    SELECT created_at - INTERVAL '1 minute'
    FROM sync_jobs
    WHERE type = 'TENANT_SYNC'
    ORDER BY created_at DESC
    LIMIT 1
  )
ORDER BY created_at DESC;
```

**PASS:** 
- Existe pelo menos 1 `TENANT_SYNC` com `status=success` e `finished_at` preenchido
- Existem `LISTING_SYNC` jobs criados após o `TENANT_SYNC`
- Pelo menos 1 `LISTING_SYNC` tem `status=success`

**FAIL:** 
- `TENANT_SYNC` com `status=skipped` ou `error` não nulo
- Nenhum `LISTING_SYNC` criado
- Todos `LISTING_SYNC` com `status=error` ou `skipped`

**Status atual:** ✅ **PASS** (confirmado em produção)

---

### 3. Listings.last_synced_at Atualizado
**Critério:** Após sync manual, pelo menos N anúncios têm `last_synced_at` atualizado recentemente

**Query de validação:**
```sql
SELECT 
  listing_id_ext,
  last_synced_at,
  last_sync_status,
  last_sync_error,
  NOW() - last_synced_at as age
FROM listings
WHERE last_synced_at >= NOW() - INTERVAL '1 hour'
ORDER BY last_synced_at DESC
LIMIT 20;
```

**PASS:** 
- Pelo menos 1 listing tem `last_synced_at` preenchido nos últimos 30 minutos
- `last_sync_status = 'success'` para listings sincronizados

**FAIL:** 
- Nenhum listing com `last_synced_at` recente
- `last_sync_status = 'error'` para todos

**Status atual:** ✅ **PASS** (confirmado em produção - alguns anúncios atualizados)

---

### 4. Não Surgem Novos Skipped lock_running Após Deploy
**Critério:** Após o deploy do commit que corrigiu o self-lock, não devem surgir novos jobs `skipped` com `error LIKE '%lock_running%'`

**Query de validação:**
```sql
-- Contar skipped por janela recente
SELECT 
  type,
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN error LIKE '%lock_running%' THEN 1 END) as skipped_by_lock
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '30 minutes'
GROUP BY type, status
ORDER BY type, status;

-- Listar apenas os skipped recentes
SELECT 
  id,
  type,
  status,
  error,
  lock_key,
  created_at,
  started_at,
  finished_at
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '30 minutes'
  AND status = 'skipped'
ORDER BY created_at DESC;
```

**PASS:** 
- `skipped_by_lock = 0` para jobs criados após o deploy do fix
- Ou todos os `skipped` com `lock_running` têm `created_at` anterior ao deploy do fix

**FAIL:** 
- Existem jobs `skipped` com `error LIKE '%lock_running%'` criados após o deploy do fix

**Status atual:** ⚠️ **A CONFIRMAR** (existem skipped lock_running, mas não sabemos se são históricos ou novos)

**Ação:** Rodar queries acima e comparar `created_at` com timestamp do deploy do commit `808ed02` (fix self-lock)

---

## 🔧 Migration no PROD — Validação e Execução Segura

### Verificar Migrations Pendentes

**Query para checar migrations relacionadas a sync_jobs:**
```sql
SELECT 
  migration_name,
  finished_at,
  applied_steps_count,
  started_at,
  logs
FROM _prisma_migrations
WHERE migration_name LIKE '%fix_sync_jobs%' 
   OR migration_name LIKE '%add_sync_jobs%'
ORDER BY finished_at DESC NULLS LAST;
```

**Interpretação:**
- Se `finished_at IS NULL` e `applied_steps_count = 0`: Migration **NÃO foi aplicada** no banco PROD
- Se `finished_at IS NOT NULL`: Migration foi aplicada com sucesso

**Status atual:** ⚠️ **SUSPEITA** - Migration `20260214000000_fix_sync_jobs_timezone_and_dedupe` com `finished_at NULL` e `applied_steps_count 0`

### Procedimento Seguro para Aplicar Migration em PROD

**Pré-checks obrigatórios:**
1. ✅ Backup/snapshot do banco PROD
2. ✅ Janela de manutenção agendada
3. ✅ Validar que migration não foi aplicada (query acima)

**Executar migration:**
```bash
# IMPORTANTE: Apontar explicitamente para DATABASE_URL do PROD
# NÃO depender de env local

export DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname"

# Rodar migration
pnpm --filter @superseller/api prisma migrate deploy

# OU usando Prisma diretamente
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

**Se migration falhar por índice já existir:**
```sql
-- Verificar se índice existe
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sync_jobs'
  AND indexname = 'sync_jobs_lock_key_unique';

-- Se existir, dropar e recriar (se necessário)
DROP INDEX IF EXISTS sync_jobs_lock_key_unique;
CREATE UNIQUE INDEX sync_jobs_lock_key_unique ON sync_jobs (lock_key) 
WHERE status IN ('queued', 'running');
```

**Pós-checks:**
1. Rodar query de verificação de migrations novamente
2. Validar tipos de coluna (query abaixo)
3. Validar índice único parcial (query abaixo)

**Query para validar tipos de coluna após migration:**
```sql
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name IN ('tenants', 'listings', 'sync_jobs')
  AND (column_name LIKE '%_at' OR column_name LIKE '%_after')
ORDER BY table_name, column_name;
```

**Esperado:** `data_type = 'timestamp with time zone'` ou `udt_name = 'timestamptz'`

---

## 🔍 Investigação: Skipped lock_running

### Queries para Provar se Problema Ainda Ocorre

#### 1. Contar skipped por janela recente
```sql
SELECT 
  type,
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN error LIKE '%lock_running%' THEN 1 END) as skipped_by_lock
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '30 minutes'
GROUP BY type, status
ORDER BY type, status;
```

#### 2. Listar apenas os skipped recentes
```sql
SELECT 
  id,
  type,
  status,
  error,
  lock_key,
  created_at,
  started_at,
  finished_at
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '30 minutes'
  AND status = 'skipped'
ORDER BY created_at DESC;
```

#### 3. Comparar com timestamp do deploy do fix
```sql
-- Substituir '2026-02-14 12:00:00' pelo timestamp real do deploy do commit 808ed02
SELECT 
  id,
  type,
  status,
  error,
  created_at,
  CASE 
    WHEN created_at < '2026-02-14 12:00:00'::timestamptz THEN 'ANTES DO FIX (histórico)'
    ELSE 'APÓS O FIX (novo)'
  END as periodo
FROM sync_jobs
WHERE status = 'skipped'
  AND error LIKE '%lock_running%'
ORDER BY created_at DESC;
```

### Interpretação

**Se NÃO aparecem novos `lock_running` após o fix:**
- ✅ Marcar como **"resíduo histórico"**
- ✅ Bug corrigido com sucesso
- ✅ Pode limpar jobs históricos se necessário

**Se aparecem novos `lock_running` após o fix:**
- 🔴 Criar ticket/ação corretiva no `NEXT_SESSION_PLAN`
- 🔴 Investigar onde ainda está sendo setado `lock_running`
- 🔴 Possíveis causas:
  - Código antigo ainda em execução (deploy não completo)
  - Outro ponto no código ainda chama `checkLock` após `dequeue`
  - Race condition não coberta

**Status atual:** ⚠️ **A CONFIRMAR** - Rodar queries acima para determinar se são históricos ou novos

---

## 📊 Queries SQL para Validação (Atualizadas)

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

### 6) Métricas 30d (CORRIGIDO — com JOIN para listing_id_ext)

**IMPORTANTE:** `listing_metrics_daily.listing_id` é UUID interno (não MLB...). Para buscar por `listing_id_ext`, usar JOIN:

```sql
SELECT 
  m.*,
  l.listing_id_ext
FROM listing_metrics_daily m
JOIN listings l ON l.id = m.listing_id
WHERE l.listing_id_ext = 'MLB4167251409'  -- Substituir pelo MLB desejado
ORDER BY m.date DESC
LIMIT 30;
```

**Ou para verificar métricas de listings sincronizados recentemente:**
```sql
SELECT 
  l.listing_id_ext,
  COUNT(m.date) as metrics_days,
  MAX(m.date) as latest_metric_date,
  SUM(m.visits) as total_visits_30d,
  SUM(m.orders) as total_orders_30d
FROM listings l
LEFT JOIN listing_metrics_daily m ON m.listing_id = l.id
WHERE l.last_synced_at >= NOW() - INTERVAL '1 hour'
GROUP BY l.id, l.listing_id_ext
ORDER BY l.last_synced_at DESC
LIMIT 10;
```

---

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
