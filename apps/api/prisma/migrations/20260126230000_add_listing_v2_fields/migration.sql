-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "price_final" DECIMAL(10,2),
ADD COLUMN     "original_price" DECIMAL(10,2),
ADD COLUMN     "has_promotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discount_percent" INTEGER,
ADD COLUMN     "promotion_type" TEXT,
ADD COLUMN     "promotion_checked_at" TIMESTAMP(3),
ADD COLUMN     "pictures_json" JSONB;
