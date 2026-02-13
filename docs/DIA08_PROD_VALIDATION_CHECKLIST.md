# Checklist — Validação Produção DIA 08

**Data:** 2026-02-14  
**Status:** ⏳ Pendente de validação

---

## A. Validar JobRunner

### 1. Confirmar ENABLE_JOB_RUNNER=true
- [ ] Verificar variável de ambiente no App Runner
- [ ] Confirmar que JobRunner iniciou (logs: "JobRunner enabled")

### 2. Verificar logs
- [ ] Buscar "JobRunner enabled" nos logs de inicialização
- [ ] Buscar "Job claimed" quando jobs são processados
- [ ] Buscar "Job finished" quando jobs completam
- [ ] (Opcional) Se DEBUG_JOB_RUNNER=1, verificar heartbeat logs

### 3. Endpoint de health
- [ ] GET /api/v1/sync/jobs/health retorna:
  - `jobRunnerEnabled: true`
  - `jobQueueDriver: "db"`
  - `nowUtc` e `dbNow` consistentes
  - Contadores de jobs (queuedCount, processingCount, failedCount)

---

## B. Validar Banco

### 1. Não existir múltiplos TENANT_SYNC queued simultâneos
```sql
SELECT 
  tenant_id,
  COUNT(*) as queued_count
FROM sync_jobs
WHERE type = 'TENANT_SYNC'
  AND status = 'queued'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY tenant_id
HAVING COUNT(*) > 1;
```
**Esperado:** 0 linhas

### 2. Jobs devem transicionar: queued → processing → succeeded
```sql
SELECT 
  id,
  type,
  status,
  started_at,
  finished_at,
  error,
  created_at
FROM sync_jobs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```
**Esperado:** 
- Jobs recentes têm `started_at` preenchido
- Jobs concluídos têm `finished_at` preenchido
- Status transiciona corretamente

### 3. last_auto_sync_at não pode gerar minutos negativos
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

### 4. listings.last_synced_at deve atualizar após sync
```sql
SELECT 
  id,
  listing_id_ext,
  last_synced_at,
  last_sync_status,
  last_sync_error
FROM listings
WHERE last_synced_at >= NOW() - INTERVAL '1 hour'
ORDER BY last_synced_at DESC
LIMIT 10;
```
**Esperado:** 
- `last_synced_at` atualizado recentemente
- `last_sync_status` = 'success' ou 'error' (não 'idle')

---

## C. Validar UI

### 1. Abrir /listings
- [ ] No máximo 1 TENANT_SYNC criado (verificar Network tab)
- [ ] SyncStatusBar exibe status correto
- [ ] Não ocorre "Network Error" por excesso de requisições

### 2. Clicar "Sincronizar agora"
- [ ] Respeita cooldown (15 min) se já sincronizou recentemente
- [ ] Mostra "Atualizando..." quando running
- [ ] Atualiza status após conclusão

### 3. Polling controlado
- [ ] Com status idle: polling a cada 30-60s (não agressivo)
- [ ] Com status running: polling a cada 2-5s
- [ ] Total de requisições de status < 100 em 5 minutos

### 4. Nenhum "Network Error"
- [ ] Listagem carrega normalmente
- [ ] Não há erros de rede no console
- [ ] UI responsiva

---

## D. Validar Timestamps (Timezone)

### 1. Verificar tipos de coluna
```sql
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name IN ('tenants', 'listings', 'sync_jobs')
  AND column_name LIKE '%_at' OR column_name LIKE '%_after'
ORDER BY table_name, column_name;
```
**Esperado:** `data_type = 'timestamp with time zone'` ou `udt_name = 'timestamptz'`

### 2. Verificar consistência de timestamps
```sql
SELECT 
  'tenants' as table_name,
  COUNT(*) as total,
  COUNT(last_auto_sync_at) as has_auto_sync,
  COUNT(last_manual_sync_at) as has_manual_sync
FROM tenants
UNION ALL
SELECT 
  'listings',
  COUNT(*),
  COUNT(last_synced_at),
  0
FROM listings
UNION ALL
SELECT 
  'sync_jobs',
  COUNT(*),
  COUNT(started_at),
  COUNT(finished_at)
FROM sync_jobs;
```
**Esperado:** Contadores consistentes (sem NULLs inesperados)

---

## E. Validar Dedupe

### 1. Verificar índice único parcial
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sync_jobs'
  AND indexname LIKE '%lock_key%';
```
**Esperado:** Índice único parcial existe

### 2. Tentar criar job duplicado (teste manual)
- [ ] Chamar POST /api/v1/sync/tenant/auto duas vezes rapidamente
- [ ] Verificar que apenas 1 job é criado (ou segundo retorna job existente)

---

## F. Evidências de Sucesso

### Logs esperados
```
[INFO] JobRunner enabled (driver: db, pollInterval: 3000ms)
[INFO] Job claimed: {jobId: "...", type: "TENANT_SYNC", tenantId: "..."}
[INFO] TenantSyncOrchestrator: Enqueued 15 LISTING_SYNC jobs
[INFO] Job finished: {jobId: "...", status: "success"}
```

### Banco esperado
- Jobs transicionam corretamente
- Timestamps consistentes (sem negativos)
- Dedupe funciona (máximo 1 TENANT_SYNC queued por tenant)

### UI esperada
- Auto-sync dispara 1x por sessão
- Polling controlado (sem request storm)
- Status atualiza corretamente

---

## G. Decisão Final

Após validação:

- [ ] ✅ **DIA 08 FECHADO** → Iniciar DIA 09 (Hacks ML Contextualizados)
- [ ] ⚠️ **AJUSTES NECESSÁRIOS** → Documentar e corrigir
- [ ] 🔴 **BLOQUEADOR** → Escalar e resolver

---

## Notas

- Validação deve ser feita em produção (não staging)
- Queries SQL podem ser executadas via psql ou ferramenta de admin
- Logs podem ser consultados via CloudWatch ou App Runner logs
- UI pode ser testada manualmente ou via ferramenta de monitoramento
