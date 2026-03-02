-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('A_IMPLEMENTAR', 'IMPLEMENTADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "listing_actions" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "priority" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'A_IMPLEMENTAR',
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),

    CONSTRAINT "listing_actions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "listing_actions" ADD CONSTRAINT "listing_actions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "listing_actions_listingId_idx" ON "listing_actions"("listingId");

-- CreateIndex
CREATE INDEX "listing_actions_listingId_batchId_idx" ON "listing_actions"("listingId", "batchId");

-- CreateIndex
CREATE INDEX "listing_actions_status_idx" ON "listing_actions"("status");
