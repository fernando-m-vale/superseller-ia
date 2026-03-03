-- AlterTable: adicionar schemaVersion e mudar unique constraint
-- Permite coexistência de V1 e V2 para mesma actionId

-- Step 1: Adicionar coluna schemaVersion com default 'v1'
ALTER TABLE "listing_action_details" ADD COLUMN "schema_version" TEXT NOT NULL DEFAULT 'v1';

-- Step 2: Remover constraint unique antigo em actionId
ALTER TABLE "listing_action_details" DROP CONSTRAINT IF EXISTS "listing_action_details_actionId_key";

-- Step 3: Criar unique constraint composto (actionId, schemaVersion)
CREATE UNIQUE INDEX "listing_action_details_actionId_schemaVersion_key" ON "listing_action_details"("actionId", "schema_version");

-- Step 4: Criar índice para queries por actionId + schemaVersion
CREATE INDEX "listing_action_details_actionId_schemaVersion_idx" ON "listing_action_details"("actionId", "schema_version");

-- Step 5: Atualizar relação no Prisma (mudança de detail para details[])
-- Isso é feito automaticamente pelo Prisma ao regenerar o cliente
