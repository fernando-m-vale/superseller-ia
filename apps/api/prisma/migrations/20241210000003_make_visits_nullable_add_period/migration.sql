-- AlterTable: tornar visits e conversion nullable, adicionar period_days
ALTER TABLE "listing_metrics_daily" 
  ALTER COLUMN "visits" DROP NOT NULL,
  ALTER COLUMN "conversion" DROP NOT NULL,
  ADD COLUMN "period_days" INTEGER,
  ALTER COLUMN "impressions" SET DEFAULT 0,
  ALTER COLUMN "clicks" SET DEFAULT 0,
  ALTER COLUMN "orders" SET DEFAULT 0;

