-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('seo', 'image', 'price', 'conversion', 'stock', 'content');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('pending', 'applied', 'dismissed', 'expired');

-- AlterTable
ALTER TABLE "listing_metrics_daily" ALTER COLUMN "impressions" DROP NOT NULL,
ALTER COLUMN "impressions" DROP DEFAULT,
ALTER COLUMN "clicks" DROP NOT NULL,
ALTER COLUMN "clicks" DROP DEFAULT,
ALTER COLUMN "ctr" DROP NOT NULL;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "description" TEXT,
ADD COLUMN     "has_video" BOOLEAN DEFAULT false,
ADD COLUMN     "pictures_count" INTEGER DEFAULT 0,
ADD COLUMN     "sales_last_7d" INTEGER DEFAULT 0,
ADD COLUMN     "score_breakdown" JSONB,
ADD COLUMN     "super_seller_score" INTEGER DEFAULT 0,
ADD COLUMN     "thumbnail_url" TEXT,
ADD COLUMN     "visits_last_7d" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact_estimate" TEXT,
    "rule_trigger" TEXT,
    "score_impact" INTEGER,
    "metadata" JSONB,
    "applied_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendations_tenant_id_idx" ON "recommendations"("tenant_id");

-- CreateIndex
CREATE INDEX "recommendations_listing_id_idx" ON "recommendations"("listing_id");

-- CreateIndex
CREATE INDEX "recommendations_tenant_id_status_idx" ON "recommendations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "recommendations_type_idx" ON "recommendations"("type");

-- CreateIndex
CREATE INDEX "recommendations_priority_idx" ON "recommendations"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_tenant_id_listing_id_type_rule_trigger_key" ON "recommendations"("tenant_id", "listing_id", "type", "rule_trigger");

-- CreateIndex
CREATE INDEX "listings_super_seller_score_idx" ON "listings"("super_seller_score");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
