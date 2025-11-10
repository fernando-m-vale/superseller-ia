CREATE TYPE "QualityStatus" AS ENUM ('pass', 'warning', 'critical');

CREATE TABLE "data_quality_checks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "check_date" DATE NOT NULL,
    "status" "QualityStatus" NOT NULL,
    "missing_days" INTEGER NOT NULL DEFAULT 0,
    "outlier_count" INTEGER NOT NULL DEFAULT 0,
    "total_listings" INTEGER NOT NULL,
    "listings_checked" INTEGER NOT NULL,
    "issues_found" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_quality_checks_tenant_id_idx" ON "data_quality_checks"("tenant_id");

CREATE INDEX "data_quality_checks_check_date_idx" ON "data_quality_checks"("check_date");

CREATE INDEX "data_quality_checks_status_idx" ON "data_quality_checks"("status");

CREATE UNIQUE INDEX "data_quality_checks_tenant_id_check_date_key" ON "data_quality_checks"("tenant_id", "check_date");

ALTER TABLE "data_quality_checks" ADD CONSTRAINT "data_quality_checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
