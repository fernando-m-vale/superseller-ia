# Checklist Operacional — Validação Produção DIA 08

**Data:** _______________  
**Executor:** _______________  
**Status:** ⏳ Pendente / ✅ PASS / ❌ FAIL

**Tempo estimado:** 10 minutos

---

## 📋 Pré-requisitos

- [ ] Acesso ao banco PROD (psql ou ferramenta de admin)
- [ ] Acesso ao App Runner (para verificar deploy timestamp)
- [ ] Acesso ao endpoint `/api/v1/sync/jobs/health` (curl ou Postman)
- [ ] Acesso à UI `/listings` (para testar sync manual)

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
- [ ] ✅ **PASS** - `jobRunnerEnabled: true`
- [ ] ❌ **FAIL** - `jobRunnerEnabled: false` ou erro

**Output colado aqui:**
```
_________________________________________________
_________________________________________________
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
- [ ] ✅ **PASS** - Existem jobs com `status=success` (TENANT_SYNC e LISTING_SYNC)
- [ ] ❌ **FAIL** - Apenas `queued` ou `error`, nenhum `success`

**Output colado aqui:**
```
_________________________________________________
_________________________________________________
```

---

## ✅ 3. Skipped lock_running após deploy

**⚠️ PRÉ-REQUISITO:** Preencher `DEPLOY_END_UTC` em `apps/api/docs/HOTFIX_DIA08_VALIDATION.md` (seção "Marco do Deploy")

**Query:**
```sql
-- Substituir '<DEPLOY_END_UTC>' pelo valor preenchido
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

**Resultado:**
- [ ] ✅ **PASS** - Linha "APÓS O DEPLOY" tem `count = 0` (ou não existe)
- [ ] ❌ **FAIL** - Linha "APÓS O DEPLOY" tem `count >= 1`

**Output colado aqui:**
```
_________________________________________________
_________________________________________________
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
- [ ] ✅ **PASS** - Pelo menos 1 listing com `last_synced_at` preenchido e `last_sync_status = 'success'`
- [ ] ❌ **FAIL** - Nenhum listing com `last_synced_at` recente

**Output colado aqui:**
```
_________________________________________________
_________________________________________________
```

**4.2. Evidência UI:**
- [ ] Abrir `/listings` na UI
- [ ] Clicar "Sincronizar agora"
- [ ] Verificar que status muda para "Atualizando..." e depois "Atualizado há X"
- [ ] Verificar que pelo menos 1 listing aparece com `last_synced_at` atualizado

**Screenshot/Nota:**
```
_________________________________________________
_________________________________________________
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
- [ ] ✅ **PASS** - `finished_at IS NOT NULL` e `applied_steps_count > 0`
- [ ] ❌ **FAIL** - `finished_at IS NULL` ou `applied_steps_count = 0` → **PRECISA APLICAR MIGRATION** (ver `apps/api/docs/HOTFIX_DIA08_VALIDATION.md` seção "Migração PROD")

**Output colado aqui:**
```
_________________________________________________
_________________________________________________
```

**Se FAIL:** Seguir procedimento em `apps/api/docs/HOTFIX_DIA08_VALIDATION.md` (seção "Migração PROD — Verificação e Execução Segura")

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
- [ ] ✅ **PASS** - 1 linha retornada com `indexdef` contendo `UNIQUE` e `WHERE status IN ('queued', 'running')`
- [ ] ❌ **FAIL** - 0 linhas retornadas → Índice não existe (aplicar migration)

**Output colado aqui:**
```
_________________________________________________
_________________________________________________
```

---

## 📊 Resumo Final

**Critérios obrigatórios para fechar DIA 08:**

1. [ ] JobRunner habilitado (PASS)
2. [ ] Jobs sendo processados (PASS - existem success)
3. [ ] **0 skipped lock_running após deploy** (PASS)
4. [ ] Listings.last_synced_at atualizado (PASS)
5. [ ] **Migration aplicada** (PASS - finished_at preenchido)
6. [ ] Índice parcial presente (PASS)

**Decisão:**
- [ ] ✅ **DIA 08 FECHADO** → Todos os critérios PASS
- [ ] ⚠️ **AJUSTES NECESSÁRIOS** → Documentar abaixo
- [ ] 🔴 **BLOQUEADOR** → Escalar e resolver

**Observações:**
```
_________________________________________________
_________________________________________________
_________________________________________________
```

---

## 📚 Referências

- Documentação completa: `apps/api/docs/HOTFIX_DIA08_VALIDATION.md`
- Log de execução: `docs/DAILY_EXECUTION_LOG.md`
- Próximos passos: `docs/NEXT_SESSION_PLAN.md`
