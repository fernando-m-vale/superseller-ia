CREATE TABLE "ai_model_metrics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "model_version" TEXT NOT NULL DEFAULT 'v1.1',
    "mae" DECIMAL(10,4) NOT NULL,
    "rmse" DECIMAL(10,4) NOT NULL,
    "r_squared" DECIMAL(5,4) NOT NULL,
    "training_date" TIMESTAMP(3) NOT NULL,
    "samples_count" INTEGER NOT NULL,
    "features_used" TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_model_metrics_tenant_id_idx" ON "ai_model_metrics"("tenant_id");

CREATE INDEX "ai_model_metrics_model_version_idx" ON "ai_model_metrics"("model_version");

CREATE INDEX "ai_model_metrics_training_date_idx" ON "ai_model_metrics"("training_date");

ALTER TABLE "ai_model_metrics" ADD CONSTRAINT "ai_model_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
