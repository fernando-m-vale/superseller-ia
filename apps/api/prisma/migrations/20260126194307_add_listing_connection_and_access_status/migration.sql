-- CreateEnum
CREATE TYPE "ListingAccessStatus" AS ENUM ('accessible', 'unauthorized', 'blocked_by_policy');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "marketplace_connection_id" TEXT,
ADD COLUMN IF NOT EXISTS "seller_id" TEXT,
ADD COLUMN IF NOT EXISTS "access_status" "ListingAccessStatus" NOT NULL DEFAULT 'accessible',
ADD COLUMN IF NOT EXISTS "access_blocked_code" TEXT,
ADD COLUMN IF NOT EXISTS "access_blocked_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "access_blocked_reason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_tenant_id_marketplace_connection_id_idx" ON "listings"("tenant_id", "marketplace_connection_id");
CREATE INDEX IF NOT EXISTS "listings_marketplace_connection_id_idx" ON "listings"("marketplace_connection_id");
CREATE INDEX IF NOT EXISTS "listings_access_status_idx" ON "listings"("access_status");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_marketplace_connection_id_fkey" FOREIGN KEY ("marketplace_connection_id") REFERENCES "marketplace_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
