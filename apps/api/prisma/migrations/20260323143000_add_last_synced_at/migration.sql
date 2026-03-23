ALTER TABLE "marketplace_connections"
ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP(3);
