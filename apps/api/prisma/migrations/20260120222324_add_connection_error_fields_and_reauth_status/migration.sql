-- AlterEnum
ALTER TYPE "ConnectionStatus" ADD VALUE 'reauth_required';

-- AlterTable
ALTER TABLE "marketplace_connections" ADD COLUMN     "last_error_at" TIMESTAMP(3),
ADD COLUMN     "last_error_code" TEXT,
ADD COLUMN     "last_error_message" TEXT;
