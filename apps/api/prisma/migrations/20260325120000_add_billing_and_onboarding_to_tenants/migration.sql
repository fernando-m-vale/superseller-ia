-- AlterTable: add billing and onboarding fields to tenants
ALTER TABLE "tenants" ADD COLUMN "plan"                 TEXT      NOT NULL DEFAULT 'free';
ALTER TABLE "tenants" ADD COLUMN "plan_status"          TEXT      NOT NULL DEFAULT 'active';
ALTER TABLE "tenants" ADD COLUMN "trial_ends_at"        TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "plan_expires_at"      TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id"   TEXT;
ALTER TABLE "tenants" ADD COLUMN "stripe_sub_id"        TEXT;
ALTER TABLE "tenants" ADD COLUMN "onboarding_completed" BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "onboarding_step"      INTEGER   NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");
CREATE UNIQUE INDEX "tenants_stripe_sub_id_key" ON "tenants"("stripe_sub_id");
