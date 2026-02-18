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

## 🕐 Marco do Deploy (UTC)

**IMPORTANTE:** Preencha este campo com o timestamp UTC do fim do deploy do commit que corrigiu o self-lock (commit `808ed02` ou posterior).

**Como obter:**
1. Acesse AWS App Runner → Service `superseller-api-prod`
2. Vá em **Activity** → **Update service**
3. Encontre o deploy do commit `808ed02` (ou commit mais recente que inclui o fix)
4. Copie o timestamp **"Ended"** (formato: `YYYY-MM-DD HH:MM:SS UTC`)

**Exemplo:** `2026-02-14 15:30:00 UTC`

```bash
# PREENCHER AQUI:
DEPLOY_END_UTC = "<PREENCHER AQUI>"
```

**Uso:** Este timestamp será usado nas queries abaixo para classificar jobs `skipped lock_running` como **históricos** (antes do deploy) ou **novos** (após o deploy).

---

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

**⚠️ PRÉ-REQUISITO:** Preencher `DEPLOY_END_UTC` na seção "Marco do Deploy" acima antes de rodar estas queries.

**Query 1: Listar skipped lock_running e classificar período (antes/após deploy)**
```sql
-- Substituir '<DEPLOY_END_UTC>' pelo valor preenchido na seção "Marco do Deploy"
SELECT 
  id,
  type,
  status,
  error,
  lock_key,
  created_at,
  started_at,
  finished_at,
  CASE 
    WHEN created_at < '<DEPLOY_END_UTC>'::timestamptz THEN 'ANTES DO DEPLOY (histórico)'
    ELSE 'APÓS O DEPLOY (novo - BUG ainda ocorre)'
  END as periodo
FROM sync_jobs
WHERE status = 'skipped'
  AND error LIKE '%lock_running%'
ORDER BY created_at DESC;
```

**Query 2: Contar skipped lock_running antes/após deploy**
```sql
-- Substituir '<DEPLOY_END_UTC>' pelo valor preenchido na seção "Marco do Deploy"
SELECT 
  CASE 
    WHEN created_at < '<DEPLOY_END_UTC>'::timestamptz THEN 'ANTES DO DEPLOY'
    ELSE 'APÓS O DEPLOY'
  END as periodo,
  COUNT(*) as count
FROM sync_jobs
WHERE status = 'skipped'
  AND error LIKE '%lock_running%'
GROUP BY periodo
ORDER BY periodo;
```

**Query 3: (Opcional) Listar lock_key e job "running" que estaria conflitando**
```sql
-- Para cada skipped lock_running, verificar se existe job running com mesmo lock_key
SELECT 
  s.id as skipped_id,
  s.lock_key,
  s.created_at as skipped_created_at,
  r.id as running_id,
  r.status as running_status,
  r.started_at as running_started_at,
  r.created_at as running_created_at
FROM sync_jobs s
LEFT JOIN sync_jobs r ON r.lock_key = s.lock_key 
  AND r.status = 'running'
  AND r.started_at IS NOT NULL
WHERE s.status = 'skipped'
  AND s.error LIKE '%lock_running%'
  AND s.created_at >= '<DEPLOY_END_UTC>'::timestamptz  -- Apenas os novos
ORDER BY s.created_at DESC;
```

**Critério PASS/FAIL:**
- ✅ **PASS:** `count = 0` na linha "APÓS O DEPLOY" da Query 2
- ❌ **FAIL:** `count >= 1` na linha "APÓS O DEPLOY" da Query 2

**Status atual:** ⚠️ **A CONFIRMAR** (preencher DEPLOY_END_UTC e rodar queries acima)

---

## 🔧 Migração PROD — Verificação e Execução Segura

### Passo 1: Verificar se Migration Está Pendente

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
- Se `finished_at IS NULL` e `applied_steps_count = 0`: Migration **NÃO foi aplicada** no banco PROD → **PRECISA APLICAR**
- Se `finished_at IS NOT NULL` e `applied_steps_count > 0`: Migration foi aplicada com sucesso → **PULAR para Passo 4 (validação)**

**Status atual:** ⚠️ **SUSPEITA** - Migration `20260214000000_fix_sync_jobs_timezone_and_dedupe` com `finished_at NULL` e `applied_steps_count 0`

---

### Passo 2: Verificar Índice Existente (Pré-check)

**Query para verificar se índice já existe:**
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sync_jobs'
  AND indexname = 'sync_jobs_lock_key_unique';
```

**Interpretação:**
- Se retornar 0 linhas: Índice não existe → Migration pode ser aplicada normalmente
- Se retornar 1 linha: Índice já existe → Ver Passo 3 (procedimento alternativo)

---

### Passo 3: Executar Migration

**Pré-checks obrigatórios:**
1. ✅ Backup/snapshot do banco PROD (via RDS Console → Snapshots)
2. ✅ Janela de manutenção agendada (migration é rápida, mas backup é essencial)
3. ✅ Validar que migration não foi aplicada (Passo 1)
4. ✅ Validar índice (Passo 2)

**Executar migration (CloudShell recomendado):**

```bash
# 1. Conectar ao CloudShell AWS (ou máquina com acesso ao PROD)
# 2. Clonar repositório (ou fazer pull)
git clone https://github.com/fernando-m-vale/superseller-ia.git
cd superseller-ia

# 3. Configurar DATABASE_URL do PROD (NÃO usar env local)
export DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname"
# OU usar Secrets Manager / Parameter Store se disponível

# 4. Instalar dependências (se necessário)
pnpm install

# 5. Rodar migration
pnpm --filter @superseller/api prisma migrate deploy

# OU usando Prisma diretamente
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

**Se migration falhar por índice já existir:**
```sql
-- 1. Dropar índice existente
DROP INDEX IF EXISTS sync_jobs_lock_key_unique;

-- 2. Re-executar migration
-- (voltar ao passo 3 acima)
```

---

### Passo 4: Pós-checks (Validação)

**4.1. Confirmar migration aplicada:**
```sql
SELECT 
  migration_name,
  finished_at,
  applied_steps_count
FROM _prisma_migrations
WHERE migration_name = '20260214000000_fix_sync_jobs_timezone_and_dedupe';
```

**Esperado:**
- `finished_at IS NOT NULL` (timestamp preenchido)
- `applied_steps_count > 0` (pelo menos 1 step aplicado)

**4.2. Confirmar tipos de coluna são timestamptz(3):**
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name IN ('tenants', 'listings', 'sync_jobs')
  AND (column_name LIKE '%_at' OR column_name LIKE '%_after')
ORDER BY table_name, column_name;
```

**Esperado:** `data_type = 'timestamp with time zone'` ou `udt_name = 'timestamptz'` para todas as colunas

**4.3. Confirmar índice único parcial existe:**
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sync_jobs'
  AND indexname = 'sync_jobs_lock_key_unique';
```

**Esperado:** 1 linha retornada com `indexdef` contendo `UNIQUE` e `WHERE status IN ('queued', 'running')`

**4.4. Validar timestamps não geram diferenças negativas:**
```sql
SELECT 
  id,
  last_auto_sync_at,
  NOW() - last_auto_sync_at as diff,
  EXTRACT(EPOCH FROM (NOW() - last_auto_sync_at)) / 60 as diff_minutes
FROM tenants
WHERE last_auto_sync_at IS NOT NULL
  AND NOW() - last_auto_sync_at < INTERVAL '0 minutes'
LIMIT 10;
```

**Esperado:** 0 linhas (nenhum diff negativo)

---

## 🔍 Investigação: Skipped lock_running (Usar DEPLOY_END_UTC)

**⚠️ IMPORTANTE:** Esta seção usa o campo `DEPLOY_END_UTC` preenchido na seção "Marco do Deploy" acima.

As queries abaixo classificam jobs `skipped lock_running` como **históricos** (antes do deploy) ou **novos** (após o deploy).

**Critério PASS/FAIL:**
- ✅ **PASS:** 0 ocorrências de `skipped lock_running` após `DEPLOY_END_UTC`
- ❌ **FAIL:** >=1 ocorrência após `DEPLOY_END_UTC` → Bug ainda ocorre, investigar

### Query 1: Listar skipped lock_running e classificar período

```sql
-- Substituir '<DEPLOY_END_UTC>' pelo valor preenchido na seção "Marco do Deploy"
SELECT 
  id,
  type,
  status,
  error,
  lock_key,
  created_at,
  started_at,
  finished_at,
  CASE 
    WHEN created_at < '<DEPLOY_END_UTC>'::timestamptz THEN 'ANTES DO DEPLOY (histórico)'
    ELSE 'APÓS O DEPLOY (novo - BUG ainda ocorre)'
  END as periodo
FROM sync_jobs
WHERE status = 'skipped'
  AND error LIKE '%lock_running%'
ORDER BY created_at DESC;
```

### Query 2: Contar skipped lock_running antes/após deploy

```sql
-- Substituir '<DEPLOY_END_UTC>' pelo valor preenchido na seção "Marco do Deploy"
SELECT 
  CASE 
    WHEN created_at < '<DEPLOY_END_UTC>'::timestamptz THEN 'ANTES DO DEPLOY'
    ELSE 'APÓS O DEPLOY'
  END as periodo,
  COUNT(*) as count
FROM sync_jobs
WHERE status = 'skipped'
  AND error LIKE '%lock_running%'
GROUP BY periodo
ORDER BY periodo;
```

**Interpretação:**
- Se linha "APÓS O DEPLOY" tem `count = 0`: ✅ **PASS** - Bug corrigido, apenas resíduos históricos
- Se linha "APÓS O DEPLOY" tem `count >= 1`: ❌ **FAIL** - Bug ainda ocorre, ver Query 3

### Query 3: (Opcional) Listar lock_key e job "running" que estaria conflitando

```sql
-- Para cada skipped lock_running NOVO, verificar se existe job running com mesmo lock_key
-- Substituir '<DEPLOY_END_UTC>' pelo valor preenchido na seção "Marco do Deploy"
SELECT 
  s.id as skipped_id,
  s.lock_key,
  s.created_at as skipped_created_at,
  r.id as running_id,
  r.status as running_status,
  r.started_at as running_started_at,
  r.created_at as running_created_at,
  CASE 
    WHEN r.id IS NULL THEN 'Nenhum job running encontrado (self-lock confirmado)'
    WHEN r.started_at < s.created_at THEN 'Job running é anterior (pode ser legítimo)'
    ELSE 'Job running é posterior (investigar)'
  END as analise
FROM sync_jobs s
LEFT JOIN sync_jobs r ON r.lock_key = s.lock_key 
  AND r.status = 'running'
  AND r.started_at IS NOT NULL
WHERE s.status = 'skipped'
  AND s.error LIKE '%lock_running%'
  AND s.created_at >= '<DEPLOY_END_UTC>'::timestamptz  -- Apenas os novos
ORDER BY s.created_at DESC;
```

**Se Query 2 retornar FAIL (count >= 1 após deploy):**
- 🔴 Criar ticket/ação corretiva no `NEXT_SESSION_PLAN`
- 🔴 Investigar onde ainda está sendo setado `lock_running`
- 🔴 Possíveis causas:
  - Código antigo ainda em execução (deploy não completo, múltiplas réplicas)
  - Outro ponto no código ainda chama `checkLock` após `dequeue`
  - Race condition não coberta

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

**IMPORTANTE:** 
- `listing_metrics_daily.listing_id` é **UUID interno** (não MLB...)
- `listings.listing_id_ext` é o **identificador externo** (ex: `MLB4167251409`)
- Para buscar métricas por `listing_id_ext`, **sempre usar JOIN**

**Query para métricas de um listing específico (por listing_id_ext):**
```sql
SELECT 
  m.*,
  l.listing_id_ext,
  l.title
FROM listing_metrics_daily m
JOIN listings l ON l.id = m.listing_id
WHERE l.listing_id_ext = 'MLB4167251409'  -- Substituir pelo MLB desejado
ORDER BY m.date DESC
LIMIT 30;
```

**Query para verificar métricas de listings sincronizados recentemente:**
```sql
SELECT 
  l.listing_id_ext,
  COUNT(m.date) as metrics_days,
  MAX(m.date) as latest_metric_date,
  SUM(m.visits) as total_visits_30d,
  SUM(m.orders) as total_orders_30d,
  SUM(m.gmv) as total_gmv_30d
FROM listings l
LEFT JOIN listing_metrics_daily m ON m.listing_id = l.id
WHERE l.last_synced_at >= NOW() - INTERVAL '1 hour'
GROUP BY l.id, l.listing_id_ext
ORDER BY l.last_synced_at DESC
LIMIT 10;
```

**Esperado:** 
- `metrics_days > 0` (pelo menos alguns dias de métricas)
- `latest_metric_date` recente (últimos 30 dias)
- `total_visits_30d`, `total_orders_30d`, `total_gmv_30d` > 0 para listings com vendas

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
