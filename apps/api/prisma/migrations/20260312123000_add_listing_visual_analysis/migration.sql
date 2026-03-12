CREATE TABLE IF NOT EXISTS "listing_visual_analysis" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "image_hash" TEXT,
  "main_image_url" TEXT,
  "image_source" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "visual_score" INTEGER,
  "visual_summary" TEXT,
  "criteria_json" JSONB,
  "improvements_json" JSONB,
  "signals_json" JSONB,
  "analyzed_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "listing_visual_analysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "listing_visual_analysis_tenant_id_listing_id_analyzed_at_idx"
  ON "listing_visual_analysis"("tenant_id", "listing_id", "analyzed_at" DESC);

CREATE INDEX IF NOT EXISTS "listing_visual_analysis_tenant_id_listing_id_image_hash_prompt_idx"
  ON "listing_visual_analysis"("tenant_id", "listing_id", "image_hash", "prompt_version", "analyzed_at" DESC);

CREATE INDEX IF NOT EXISTS "listing_visual_analysis_listing_id_analyzed_at_idx"
  ON "listing_visual_analysis"("listing_id", "analyzed_at" DESC);

ALTER TABLE "listing_visual_analysis"
  ADD CONSTRAINT "listing_visual_analysis_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_visual_analysis"
  ADD CONSTRAINT "listing_visual_analysis_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
