-- AlterTable: multi-contas e anti-burla em tenants
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "active_connection_id" TEXT,
  ADD COLUMN IF NOT EXISTS "trial_used" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: nickname na conexão do marketplace
ALTER TABLE "marketplace_connections"
  ADD COLUMN IF NOT EXISTS "nickname" TEXT;
