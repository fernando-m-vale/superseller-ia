-- AlterTable: Add error tracking fields to marketplace_connections
ALTER TABLE "marketplace_connections" 
  ADD COLUMN IF NOT EXISTS "last_error_code" TEXT,
  ADD COLUMN IF NOT EXISTS "last_error_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_message" TEXT;

-- AlterEnum: Add 'reauth_required' to ConnectionStatus enum
-- PostgreSQL não suporta IF NOT EXISTS diretamente em ALTER TYPE ADD VALUE
-- Usamos um bloco DO para verificar antes de adicionar
DO $$ 
BEGIN
    -- Check if 'reauth_required' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'reauth_required' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'ConnectionStatus'
        )
    ) THEN
        -- Add the new enum value
        ALTER TYPE "ConnectionStatus" ADD VALUE 'reauth_required';
    END IF;
END $$;
