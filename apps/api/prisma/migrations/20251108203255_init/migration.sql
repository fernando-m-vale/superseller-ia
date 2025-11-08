-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'operator');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('shopee', 'mercadolivre', 'amazon', 'magalu');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('active', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'paused', 'deleted');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "Marketplace" NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "status" "ConnectionStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "listing_id_ext" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_metrics_daily" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "ctr" DECIMAL(5,4) NOT NULL,
    "visits" INTEGER NOT NULL,
    "conversion" DECIMAL(5,4) NOT NULL,
    "orders" INTEGER NOT NULL,
    "gmv" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "marketplace_connections_tenant_id_idx" ON "marketplace_connections"("tenant_id");

-- CreateIndex
CREATE INDEX "marketplace_connections_tenant_id_type_idx" ON "marketplace_connections"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "listings_tenant_id_idx" ON "listings"("tenant_id");

-- CreateIndex
CREATE INDEX "listings_tenant_id_marketplace_idx" ON "listings"("tenant_id", "marketplace");

-- CreateIndex
CREATE INDEX "listings_tenant_id_status_idx" ON "listings"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listings_tenant_id_marketplace_listing_id_ext_key" ON "listings"("tenant_id", "marketplace", "listing_id_ext");

-- CreateIndex
CREATE INDEX "listing_metrics_daily_tenant_id_idx" ON "listing_metrics_daily"("tenant_id");

-- CreateIndex
CREATE INDEX "listing_metrics_daily_listing_id_idx" ON "listing_metrics_daily"("listing_id");

-- CreateIndex
CREATE INDEX "listing_metrics_daily_date_idx" ON "listing_metrics_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "listing_metrics_daily_tenant_id_listing_id_date_key" ON "listing_metrics_daily"("tenant_id", "listing_id", "date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_connections" ADD CONSTRAINT "marketplace_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_metrics_daily" ADD CONSTRAINT "listing_metrics_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_metrics_daily" ADD CONSTRAINT "listing_metrics_daily_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
