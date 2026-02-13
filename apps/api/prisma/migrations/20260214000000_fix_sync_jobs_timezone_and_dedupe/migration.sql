-- HOTFIX DIA 08: Converter timestamps para timestamptz e adicionar índice único para dedupe

-- Converter colunas de tenants para timestamptz
ALTER TABLE "tenants" 
  ALTER COLUMN "last_auto_sync_at" TYPE timestamptz(3) USING "last_auto_sync_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_manual_sync_at" TYPE timestamptz(3) USING "last_manual_sync_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_sync_started_at" TYPE timestamptz(3) USING "last_sync_started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_sync_finished_at" TYPE timestamptz(3) USING "last_sync_finished_at" AT TIME ZONE 'UTC';

-- Converter colunas de listings para timestamptz
ALTER TABLE "listings" 
  ALTER COLUMN "last_synced_at" TYPE timestamptz(3) USING "last_synced_at" AT TIME ZONE 'UTC';

-- Converter colunas de sync_jobs para timestamptz
ALTER TABLE "sync_jobs" 
  ALTER COLUMN "run_after" TYPE timestamptz(3) USING "run_after" AT TIME ZONE 'UTC',
  ALTER COLUMN "started_at" TYPE timestamptz(3) USING "started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "finished_at" TYPE timestamptz(3) USING "finished_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

-- HOTFIX: Criar índice único parcial para dedupe de TENANT_SYNC
-- Garante que não pode haver dois jobs com mesmo lock_key em status queued ou running
-- Nota: PostgreSQL não suporta IF NOT EXISTS em CREATE UNIQUE INDEX
-- Se o índice já existir, rodar manualmente antes: DROP INDEX IF EXISTS sync_jobs_lock_key_unique;
CREATE UNIQUE INDEX "sync_jobs_lock_key_unique" ON "sync_jobs" ("lock_key") 
WHERE "status" IN ('queued', 'running');
