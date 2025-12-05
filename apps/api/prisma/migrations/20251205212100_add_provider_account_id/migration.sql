-- AlterTable
ALTER TABLE "marketplace_connections" ADD COLUMN "provider_account_id" TEXT NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "marketplace_connections_tenant_id_type_idx";

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_connections_tenant_id_type_provider_account_id_key" ON "marketplace_connections"("tenant_id", "type", "provider_account_id");
