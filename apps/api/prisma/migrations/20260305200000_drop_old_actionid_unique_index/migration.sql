-- DropIndex: remove stale unique index on actionId only
-- The previous migration (20260303130000) used DROP CONSTRAINT IF EXISTS
-- which did not drop the index because Prisma created it as an INDEX, not a CONSTRAINT.
-- This migration uses DROP INDEX to properly remove it.

DROP INDEX IF EXISTS "listing_action_details_actionId_key";
