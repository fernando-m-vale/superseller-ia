-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('idle', 'running', 'success', 'error');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('TENANT_SYNC', 'LISTING_SYNC');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('queued', 'running', 'success', 'error', 'skipped');

-- CreateEnum
CREATE TYPE "SyncJobPriority" AS ENUM ('interactive', 'background');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "last_auto_sync_at" TIMESTAMP(3),
ADD COLUMN "last_manual_sync_at" TIMESTAMP(3),
ADD COLUMN "last_sync_status" "SyncStatus" NOT NULL DEFAULT 'idle',
ADD COLUMN "last_sync_error" TEXT,
ADD COLUMN "last_sync_started_at" TIMESTAMP(3),
ADD COLUMN "last_sync_finished_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "listings" ADD COLUMN "last_synced_at" TIMESTAMP(3),
ADD COLUMN "last_sync_status" "SyncStatus" NOT NULL DEFAULT 'idle',
ADD COLUMN "last_sync_error" TEXT;

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'queued',
    "priority" "SyncJobPriority" NOT NULL DEFAULT 'background',
    "payload" JSONB NOT NULL,
    "lock_key" TEXT NOT NULL,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_jobs_status_priority_run_after_idx" ON "sync_jobs"("status", "priority", "run_after");

-- CreateIndex
CREATE INDEX "sync_jobs_tenant_id_status_idx" ON "sync_jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "sync_jobs_lock_key_status_idx" ON "sync_jobs"("lock_key", "status");

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
