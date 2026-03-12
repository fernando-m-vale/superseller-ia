-- DIA 11.5: data layer phase 2

ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "is_free_shipping" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "shipping_mode" TEXT,
  ADD COLUMN IF NOT EXISTS "is_full_eligible" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "listing_type_id" TEXT,
  ADD COLUMN IF NOT EXISTS "brand" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "gtin" TEXT,
  ADD COLUMN IF NOT EXISTS "condition" TEXT,
  ADD COLUMN IF NOT EXISTS "warranty" TEXT,
  ADD COLUMN IF NOT EXISTS "quality_grade" TEXT,
  ADD COLUMN IF NOT EXISTS "moderation_status" TEXT,
  ADD COLUMN IF NOT EXISTS "moderation_sub_status" TEXT,
  ADD COLUMN IF NOT EXISTS "price_base" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "price_effective" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "promo_id" TEXT,
  ADD COLUMN IF NOT EXISTS "promo_start_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "promo_end_at" TIMESTAMPTZ(3);

CREATE TABLE IF NOT EXISTS "listing_content_history" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description_hash" TEXT,
  "pictures_count" INTEGER,
  "main_image_url" TEXT,
  "has_clips" BOOLEAN,
  "category_id" TEXT,
  "brand" TEXT,
  "model" TEXT,
  "gtin" TEXT,
  "is_free_shipping" BOOLEAN,
  "shipping_mode" TEXT,
  "is_full_eligible" BOOLEAN,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "listing_content_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "listing_content_history_tenant_id_created_at_idx"
  ON "listing_content_history"("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "listing_content_history_listing_id_created_at_idx"
  ON "listing_content_history"("listing_id", "created_at" DESC);

ALTER TABLE "listing_content_history"
  ADD CONSTRAINT "listing_content_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_content_history"
  ADD CONSTRAINT "listing_content_history_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
