# Migration PROD: Adicionar campos de erro e status reauth_required

**Data:** 2026-01-20  
**Migration:** `20260120222324_add_connection_error_fields_and_reauth_status`

## Objetivo

Adicionar campos de rastreamento de erro (`last_error_code`, `last_error_at`, `last_error_message`) e o status `reauth_required` ao enum `ConnectionStatus` na tabela `marketplace_connections`.

## Problema

O schema Prisma foi atualizado, mas o banco PROD não tem as colunas novas, causando erro `P2022` ao tentar atualizar conexões:

```
{
  "error":"DB_PERSIST_FAILED",
  "dbError":{
    "code":"P2022",
    "meta":{
      "modelName":"MarketplaceConnection",
      "column":"marketplace_connections.last_error_code"
    }
  }
}
```

## Solução

### Opção 1: Usar Prisma Migrate (Recomendado)

```bash
# 1. Conectar ao ambiente PROD
export DATABASE_URL="postgresql://user:password@host:port/database"

# 2. Aplicar migration
cd apps/api
pnpm prisma migrate deploy

# Ou com caminho explícito do schema:
pnpm prisma migrate deploy --schema=./prisma/schema.prisma
```

**Verificação:**
```bash
# Verificar status das migrations
pnpm prisma migrate status
```

### Opção 2: SQL Manual (Fallback)

Se o Prisma Migrate não funcionar, execute manualmente:

```sql
-- 1. Adicionar colunas de erro (se não existirem)
ALTER TABLE "marketplace_connections" 
  ADD COLUMN IF NOT EXISTS "last_error_code" TEXT,
  ADD COLUMN IF NOT EXISTS "last_error_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_message" TEXT;

-- 2. Adicionar valor 'reauth_required' ao enum ConnectionStatus
-- Nota: PostgreSQL não permite ALTER TYPE ... ADD VALUE em transação
-- Execute cada comando separadamente

-- Verificar se já existe
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'ConnectionStatus'
) 
AND enumlabel = 'reauth_required';

-- Se não existir, adicionar:
ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'reauth_required';
```

**Nota sobre enum:** Se `IF NOT EXISTS` não funcionar no seu PostgreSQL, use:

```sql
DO $$ 
BEGIN
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
        ALTER TYPE "ConnectionStatus" ADD VALUE 'reauth_required';
    END IF;
END $$;
```

### Verificação Pós-Migration

```sql
-- Verificar colunas adicionadas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'marketplace_connections'
  AND column_name IN ('last_error_code', 'last_error_at', 'last_error_message');

-- Verificar enum atualizado
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'ConnectionStatus'
)
ORDER BY enumsortorder;
```

**Resultado esperado:**
- 3 colunas novas: `last_error_code`, `last_error_at`, `last_error_message`
- Enum `ConnectionStatus` contém: `active`, `expired`, `revoked`, `reauth_required`

## Rollback (Se necessário)

```sql
-- Remover colunas (CUIDADO: perde dados de erro)
ALTER TABLE "marketplace_connections" 
  DROP COLUMN IF EXISTS "last_error_code",
  DROP COLUMN IF EXISTS "last_error_at",
  DROP COLUMN IF EXISTS "last_error_message";

-- Remover valor do enum (NÃO RECOMENDADO - pode quebrar dados existentes)
-- PostgreSQL não permite remover valores de enum facilmente
-- Se necessário, criar novo enum, migrar dados, e substituir
```

## DoD (Definition of Done)

- [ ] Migration aplicada no PROD
- [ ] Colunas `last_error_*` existem na tabela `marketplace_connections`
- [ ] Enum `ConnectionStatus` contém `reauth_required`
- [ ] Reconectar ML não retorna mais `P2022`
- [ ] `marketplace_connections` atualiza `status` e `last_error_*` com sucesso
- [ ] Teste manual: reconectar conta ML e verificar campos preenchidos

## Troubleshooting

### Erro: "cannot alter type because it is used by a table"

Se o enum estiver em uso, você pode precisar:

1. Verificar se há dados usando o enum:
```sql
SELECT DISTINCT status FROM marketplace_connections;
```

2. Se necessário, migrar dados antes de alterar o enum (não é o caso aqui, pois estamos apenas adicionando um valor)

### Erro: "column already exists"

As colunas já existem. Pule a parte de adicionar colunas e apenas adicione o enum.

### Erro: "enum value already exists"

O valor `reauth_required` já existe no enum. Migration já foi aplicada.

## Próximos Passos

Após aplicar a migration:

1. Testar reconexão do Mercado Livre
2. Verificar logs para confirmar que não há mais `P2022`
3. Confirmar que campos `last_error_*` são preenchidos quando houver erro 401/403
