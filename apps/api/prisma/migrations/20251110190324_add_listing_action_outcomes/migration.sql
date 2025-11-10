CREATE TYPE "ActionType" AS ENUM ('title_optimization', 'image_audit', 'attribute_completion', 'price_adjustment', 'stock_update');

CREATE TABLE "listing_action_outcomes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "ctr_before" DECIMAL(5,4),
    "ctr_after" DECIMAL(5,4),
    "cvr_before" DECIMAL(5,4),
    "cvr_after" DECIMAL(5,4),
    "revenue_before" DECIMAL(10,2),
    "revenue_after" DECIMAL(10,2),
    "effectiveness_score" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_action_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "listing_action_outcomes_tenant_id_idx" ON "listing_action_outcomes"("tenant_id");

CREATE INDEX "listing_action_outcomes_listing_id_idx" ON "listing_action_outcomes"("listing_id");

CREATE INDEX "listing_action_outcomes_action_type_idx" ON "listing_action_outcomes"("action_type");

CREATE INDEX "listing_action_outcomes_executed_at_idx" ON "listing_action_outcomes"("executed_at");

CREATE UNIQUE INDEX "listing_action_outcomes_tenant_id_action_id_key" ON "listing_action_outcomes"("tenant_id", "action_id");

ALTER TABLE "listing_action_outcomes" ADD CONSTRAINT "listing_action_outcomes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_action_outcomes" ADD CONSTRAINT "listing_action_outcomes_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
