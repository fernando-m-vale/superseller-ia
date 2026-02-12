-- CreateTable
CREATE TABLE "applied_actions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "before_payload" JSONB NOT NULL,
    "after_payload" JSONB NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applied_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applied_actions_tenant_id_idx" ON "applied_actions"("tenant_id");

-- CreateIndex
CREATE INDEX "applied_actions_listing_id_idx" ON "applied_actions"("listing_id");

-- CreateIndex
CREATE INDEX "applied_actions_action_type_idx" ON "applied_actions"("action_type");

-- CreateIndex
CREATE UNIQUE INDEX "applied_actions_tenant_id_listing_id_action_type_key" ON "applied_actions"("tenant_id", "listing_id", "action_type");

-- AddForeignKey
ALTER TABLE "applied_actions" ADD CONSTRAINT "applied_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_actions" ADD CONSTRAINT "applied_actions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
