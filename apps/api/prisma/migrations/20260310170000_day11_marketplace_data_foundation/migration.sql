-- DIA 11: base sólida de dados do marketplace

ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SYNC_VISITS';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SYNC_ORDERS';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SYNC_PROMOTIONS';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SYNC_PRICE';

ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "category_id" TEXT,
  ADD COLUMN IF NOT EXISTS "attributes_json" JSONB,
  ADD COLUMN IF NOT EXISTS "variations_json" JSONB,
  ADD COLUMN IF NOT EXISTS "shipping_json" JSONB,
  ADD COLUMN IF NOT EXISTS "logistic_type" TEXT,
  ADD COLUMN IF NOT EXISTS "tags_json" JSONB,
  ADD COLUMN IF NOT EXISTS "installments_json" JSONB,
  ADD COLUMN IF NOT EXISTS "promotions_json" JSONB,
  ADD COLUMN IF NOT EXISTS "reputation_json" JSONB,
  ADD COLUMN IF NOT EXISTS "questions_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "reviews_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "rating_average" DECIMAL(4,2);

CREATE TABLE IF NOT EXISTS "listing_visits_history" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "period_days" INTEGER NOT NULL DEFAULT 30,
  "visits" INTEGER,
  "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  "metadata" JSONB,
  CONSTRAINT "listing_visits_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "listing_orders_history" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "date_from" DATE NOT NULL,
  "date_to" DATE NOT NULL,
  "orders" INTEGER NOT NULL DEFAULT 0,
  "gmv" DECIMAL(10,2) NOT NULL,
  "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  "metadata" JSONB,
  CONSTRAINT "listing_orders_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "listing_price_history" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "price_final" DECIMAL(10,2),
  "original_price" DECIMAL(10,2),
  "discount_percent" INTEGER,
  "promotion_type" TEXT,
  "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  "metadata" JSONB,
  CONSTRAINT "listing_price_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "listing_promotions_history" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "has_promotion" BOOLEAN NOT NULL DEFAULT false,
  "promotion_type" TEXT,
  "discount_percent" INTEGER,
  "original_price" DECIMAL(10,2),
  "price_final" DECIMAL(10,2),
  "promotions_json" JSONB,
  "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  "metadata" JSONB,
  CONSTRAINT "listing_promotions_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "listing_visits_history_tenant_id_captured_at_idx"
  ON "listing_visits_history"("tenant_id", "captured_at" DESC);
CREATE INDEX IF NOT EXISTS "listing_visits_history_listing_id_captured_at_idx"
  ON "listing_visits_history"("listing_id", "captured_at" DESC);

CREATE INDEX IF NOT EXISTS "listing_orders_history_tenant_id_captured_at_idx"
  ON "listing_orders_history"("tenant_id", "captured_at" DESC);
CREATE INDEX IF NOT EXISTS "listing_orders_history_listing_id_captured_at_idx"
  ON "listing_orders_history"("listing_id", "captured_at" DESC);

CREATE INDEX IF NOT EXISTS "listing_price_history_tenant_id_captured_at_idx"
  ON "listing_price_history"("tenant_id", "captured_at" DESC);
CREATE INDEX IF NOT EXISTS "listing_price_history_listing_id_captured_at_idx"
  ON "listing_price_history"("listing_id", "captured_at" DESC);

CREATE INDEX IF NOT EXISTS "listing_promotions_history_tenant_id_captured_at_idx"
  ON "listing_promotions_history"("tenant_id", "captured_at" DESC);
CREATE INDEX IF NOT EXISTS "listing_promotions_history_listing_id_captured_at_idx"
  ON "listing_promotions_history"("listing_id", "captured_at" DESC);

ALTER TABLE "listing_visits_history"
  ADD CONSTRAINT "listing_visits_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_visits_history"
  ADD CONSTRAINT "listing_visits_history_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_orders_history"
  ADD CONSTRAINT "listing_orders_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_orders_history"
  ADD CONSTRAINT "listing_orders_history_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_price_history"
  ADD CONSTRAINT "listing_price_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_price_history"
  ADD CONSTRAINT "listing_price_history_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_promotions_history"
  ADD CONSTRAINT "listing_promotions_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_promotions_history"
  ADD CONSTRAINT "listing_promotions_history_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
