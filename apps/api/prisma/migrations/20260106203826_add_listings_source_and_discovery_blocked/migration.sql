-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "discovery_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT;
