CREATE TYPE "JobStatus" AS ENUM ('success', 'error', 'running');

CREATE TYPE "JobType" AS ENUM ('shopee_sync', 'mercadolivre_sync', 'amazon_sync', 'magalu_sync', 'metrics_aggregation', 'data_quality_check');

CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "records_processed" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_logs_tenant_id_idx" ON "job_logs"("tenant_id");

CREATE INDEX "job_logs_job_type_idx" ON "job_logs"("job_type");

CREATE INDEX "job_logs_status_idx" ON "job_logs"("status");

CREATE INDEX "job_logs_started_at_idx" ON "job_logs"("started_at");

ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
