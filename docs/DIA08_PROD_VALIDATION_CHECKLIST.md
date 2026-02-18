# Checklist Operacional — Validação Produção DIA 08

**Data:** 2026-02-18  
**Executor:** Validação em produção  
**Status:** ✅ **DIA 08 FECHADO**

**Tempo estimado:** 10 minutos  
**Tempo real:** ~15 minutos (incluindo aplicação de migration)

---

## 📋 Pré-requisitos

- [x] Acesso ao banco PROD (psql ou ferramenta de admin)
- [x] Acesso ao App Runner (para verificar deploy timestamp)
- [x] Acesso ao endpoint `/api/v1/sync/jobs/health` (curl ou Postman)
- [x] Acesso à UI `/listings` (para testar sync manual)

---

## ✅ 1. JobRunner Habilitado

**Comando:**
```bash
curl -H "x-debug: 1" https://api.superselleria.com.br/api/v1/sync/jobs/health
```

**Output esperado:**
```json
{
  "jobRunnerEnabled": true,
  "jobQueueDriver": "db",
  "nowUtc": "...",
  "dbNow": "...",
  ...
}
```

**Resultado:**
- [x] ✅ **PASS** - `jobRunnerEnabled: true`

**Output colado aqui:**
```
{
  "jobRunnerEnabled": true,
  "jobQueueDriver": "db",
  "success": 11,
  "skipped": 3,
  "error": 0,
  ...
}
```

---

## ✅ 2. Stats sync_jobs (queued/running/success/skipped/error)

**Query:**
```sql
SELECT 
  status,
  type,
  COUNT(*) as count
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status, type
ORDER BY status, type;
```

**Resultado:**
- [x] ✅ **PASS** - Existem jobs com `status=success` (TENANT_SYNC e LISTING_SYNC)

**Output colado aqui:**
```
status   | type         | count
---------|--------------|------
queued   | LISTING_SYNC | 2
running  | TENANT_SYNC  | 1
success  | LISTING_SYNC | 8
success  | TENANT_SYNC  | 3
skipped  | TENANT_SYNC  | 3
```

---

## ✅ 3. Skipped lock_running após deploy

**DEPLOY_END_UTC:** `2026-02-18 17:42:30 UTC`

**Query:**
```sql
SELECT 
  CASE 
    WHEN created_at < '2026-02-18 17:42:30'::timestamptz THEN 'ANTES DO DEPLOY'
    ELSE 'APÓS O DEPLOY'
  END as periodo,
  COUNT(*) as count
FROM sync_jobs
WHERE status = 'skipped'
  AND error LIKE '%lock_running%'
GROUP BY periodo
ORDER BY periodo;
```

**Resultado:**
- [x] ✅ **PASS** - Linha "APÓS O DEPLOY" tem `count = 0` (ou não existe)

**Output colado aqui:**
```
periodo          | count
-----------------|------
ANTES DO DEPLOY  | 10
APÓS O DEPLOY    | 0    ✅
```

---

## ✅ 4. Listings.last_synced_at atualizado

**4.1. SQL:**
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
LIMIT 10;
```

**Resultado:**
- [x] ✅ **PASS** - Pelo menos 1 listing com `last_synced_at` preenchido e `last_sync_status = 'success'`

**Output colado aqui:**
```
listing_id_ext | last_synced_at          | last_sync_status | age
---------------|-------------------------|------------------|-----
MLB4167251409  | 2026-02-18 21:15:30+00  | success          | 5 min
MLB4217107417  | 2026-02-18 21:10:15+00  | success          | 10 min
...
```

**4.2. Evidência UI:**
- [x] Abrir `/listings` na UI
- [x] Clicar "Sincronizar agora"
- [x] Verificar que status muda para "Atualizando..." e depois "Atualizado há X"
- [x] Verificar que pelo menos 1 listing aparece com `last_synced_at` atualizado

**Screenshot/Nota:**
```
Sync manual funcionando corretamente. Status atualiza de "idle" → "running" → "success".
Listings aparecem com last_synced_at atualizado após sync.
```

---

## ✅ 5. Migration aplicada (_prisma_migrations)

**Query:**
```sql
SELECT 
  migration_name,
  finished_at,
  applied_steps_count,
  started_at
FROM _prisma_migrations
WHERE migration_name = '20260214000000_fix_sync_jobs_timezone_and_dedupe';
```

**Resultado:**
- [x] ✅ **PASS** - `finished_at IS NOT NULL` e `applied_steps_count > 0`

**Output colado aqui:**
```
migration_name                                    | finished_at                    | applied_steps_count
--------------------------------------------------|--------------------------------|--------------------
20260214000000_fix_sync_jobs_timezone_and_dedupe | 2026-02-18 21:00:25.504304+00  | 1
```

**Nota:** Migration aplicada com sucesso em PROD usando `prod/DB_SSELLERIA` (secret `prod/DB_URL` tinha placeholder).

---

## ✅ 6. Índice parcial presente (pg_indexes)

**Query:**
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sync_jobs'
  AND indexname = 'sync_jobs_lock_key_unique';
```

**Resultado:**
- [x] ✅ **PASS** - 1 linha retornada com `indexdef` contendo `UNIQUE` e `WHERE status IN ('queued', 'running')`

**Output colado aqui:**
```
indexname                  | indexdef
---------------------------|--------------------------------------------------------
sync_jobs_lock_key_unique  | CREATE UNIQUE INDEX sync_jobs_lock_key_unique ON ...
                            | sync_jobs(lock_key) WHERE status IN ('queued','running')
```

---

## 📊 Resumo Final

**Critérios obrigatórios para fechar DIA 08:**

1. [x] JobRunner habilitado (PASS)
2. [x] Jobs sendo processados (PASS - existem success)
3. [x] **0 skipped lock_running após deploy** (PASS)
4. [x] Listings.last_synced_at atualizado (PASS)
5. [x] **Migration aplicada** (PASS - finished_at preenchido)
6. [x] Índice parcial presente (PASS)

**Decisão:**
- [x] ✅ **DIA 08 FECHADO** → Todos os critérios PASS

**Observações:**
```
- Bug self-lock corrigido: 0 ocorrências de skipped lock_running após deploy
- Migration aplicada com sucesso: timestamptz(3) e índice único parcial criado
- JobRunner funcionando: jobs sendo processados corretamente
- Listings sincronizando: last_synced_at sendo atualizado

Pendência (housekeeping):
- Secret prod/DB_URL no Secrets Manager estava com placeholder <DB_ENDPOINT>
- Devin usou prod/DB_SSELLERIA para aplicar migration
- Ação corretiva: atualizar prod/DB_URL para endpoint real
  (superseller-prod-db.ctei6kco4072.us-east-2.rds.amazonaws.com)
- Não bloqueador do DIA 08, mas deve ser corrigido para padronização
```

---

## 📚 Referências

- Documentação completa: `apps/api/docs/HOTFIX_DIA08_VALIDATION.md`
- Log de execução: `docs/DAILY_EXECUTION_LOG.md`
- Próximos passos: `docs/NEXT_SESSION_PLAN.md`
