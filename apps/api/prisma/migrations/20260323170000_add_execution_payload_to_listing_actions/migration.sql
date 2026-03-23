ALTER TABLE "listing_actions"
ADD COLUMN IF NOT EXISTS "execution_payload" JSONB;
