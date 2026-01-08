-- CreateTable
CREATE TABLE "listing_ai_analysis" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "period_days" INTEGER NOT NULL DEFAULT 30,
    "fingerprint" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "prompt_version" TEXT NOT NULL DEFAULT 'ai-v1.2',
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_ai_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_ai_analysis_tenant_id_idx" ON "listing_ai_analysis"("tenant_id");

-- CreateIndex
CREATE INDEX "listing_ai_analysis_listing_id_idx" ON "listing_ai_analysis"("listing_id");

-- CreateIndex
CREATE INDEX "listing_ai_analysis_fingerprint_idx" ON "listing_ai_analysis"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "listing_ai_analysis_tenant_id_listing_id_period_days_finger_key" ON "listing_ai_analysis"("tenant_id", "listing_id", "period_days", "fingerprint");

-- AddForeignKey
ALTER TABLE "listing_ai_analysis" ADD CONSTRAINT "listing_ai_analysis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_ai_analysis" ADD CONSTRAINT "listing_ai_analysis_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
