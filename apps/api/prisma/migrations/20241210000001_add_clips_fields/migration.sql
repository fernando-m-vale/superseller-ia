-- AlterTable
ALTER TABLE "listings" ADD COLUMN "has_clips" BOOLEAN,
ADD COLUMN "clips_source" TEXT,
ADD COLUMN "clips_checked_at" TIMESTAMP(3);

