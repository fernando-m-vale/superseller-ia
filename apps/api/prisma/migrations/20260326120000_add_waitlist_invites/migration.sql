-- Add approved fields to waitlist
ALTER TABLE "waitlist"
  ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);

-- CreateTable waitlist_invites
CREATE TABLE IF NOT EXISTS "waitlist_invites" (
    "id" SERIAL NOT NULL,
    "waitlist_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_invites_token_key" ON "waitlist_invites"("token");

-- AddForeignKey
ALTER TABLE "waitlist_invites"
  ADD CONSTRAINT "waitlist_invites_waitlist_id_fkey"
  FOREIGN KEY ("waitlist_id") REFERENCES "waitlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
