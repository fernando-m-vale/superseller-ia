-- CreateEnum
CREATE TYPE "ListingActionDetailStatus" AS ENUM ('READY', 'GENERATING', 'FAILED');

-- CreateTable
CREATE TABLE "listing_action_details" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "status" "ListingActionDetailStatus" NOT NULL DEFAULT 'GENERATING',
    "detailsJson" JSONB,
    "generatedAt" TIMESTAMP(3),
    "model" TEXT,
    "promptVersion" TEXT,
    "costTokensIn" INTEGER,
    "costTokensOut" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_action_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listing_action_details_actionId_key" ON "listing_action_details"("actionId");

-- CreateIndex
CREATE INDEX "listing_action_details_listingId_batchId_idx" ON "listing_action_details"("listingId", "batchId");

-- CreateIndex
CREATE INDEX "listing_action_details_status_generatedAt_idx" ON "listing_action_details"("status", "generatedAt");

-- AddForeignKey
ALTER TABLE "listing_action_details" ADD CONSTRAINT "listing_action_details_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "listing_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
