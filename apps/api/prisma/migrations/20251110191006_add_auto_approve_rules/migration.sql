CREATE TYPE "RuleStatus" AS ENUM ('active', 'inactive');

CREATE TABLE "auto_approve_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RuleStatus" NOT NULL DEFAULT 'active',
    "ctr_threshold" DECIMAL(5,4),
    "cvr_threshold" DECIMAL(5,4),
    "revenue_impact_min" DECIMAL(10,2),
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_approve_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auto_approve_rules_tenant_id_idx" ON "auto_approve_rules"("tenant_id");

CREATE INDEX "auto_approve_rules_status_idx" ON "auto_approve_rules"("status");

ALTER TABLE "auto_approve_rules" ADD CONSTRAINT "auto_approve_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
