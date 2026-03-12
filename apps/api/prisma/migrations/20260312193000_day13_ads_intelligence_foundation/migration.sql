-- DIA 13 - Ads Intelligence foundation
CREATE TABLE "listing_ads_metrics_daily" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unavailable',
    "impressions" INTEGER,
    "clicks" INTEGER,
    "ctr" DECIMAL(7,4),
    "cpc" DECIMAL(10,4),
    "spend" DECIMAL(12,2),
    "orders_attributed" INTEGER,
    "revenue_attributed" DECIMAL(12,2),
    "roas" DECIMAL(10,4),
    "conversion_rate_ads" DECIMAL(7,4),
    "source" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_ads_metrics_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "listing_ads_metrics_daily_tenant_id_listing_id_date_key"
ON "listing_ads_metrics_daily"("tenant_id", "listing_id", "date");

CREATE INDEX "listing_ads_metrics_daily_tenant_id_status_idx"
ON "listing_ads_metrics_daily"("tenant_id", "status");

CREATE INDEX "listing_ads_metrics_daily_listing_id_date_idx"
ON "listing_ads_metrics_daily"("listing_id", "date" DESC);

ALTER TABLE "listing_ads_metrics_daily"
ADD CONSTRAINT "listing_ads_metrics_daily_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_ads_metrics_daily"
ADD CONSTRAINT "listing_ads_metrics_daily_listing_id_fkey"
FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
