-- AlterTable: change listings_count from INTEGER to TEXT
-- USING cast is required by PostgreSQL when converting numeric to text.
-- This migration is idempotent: if the column is already TEXT it will succeed
-- because TEXT->TEXT cast is a no-op in PostgreSQL.
ALTER TABLE "waitlist"
  ALTER COLUMN "listings_count" TYPE TEXT USING listings_count::text;
