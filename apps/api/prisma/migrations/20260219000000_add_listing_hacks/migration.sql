-- CreateTable
CREATE TABLE "listing_hacks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "hack_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_hacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listing_hacks_listing_id_hack_id_key" ON "listing_hacks"("listing_id", "hack_id");

-- CreateIndex
CREATE INDEX "listing_hacks_tenant_id_updated_at_idx" ON "listing_hacks"("tenant_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "listing_hacks_listing_id_idx" ON "listing_hacks"("listing_id");

-- CreateIndex
CREATE INDEX "listing_hacks_hack_id_idx" ON "listing_hacks"("hack_id");

-- CreateIndex
CREATE INDEX "listing_hacks_status_idx" ON "listing_hacks"("status");

-- AddForeignKey
ALTER TABLE "listing_hacks" ADD CONSTRAINT "listing_hacks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_hacks" ADD CONSTRAINT "listing_hacks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
