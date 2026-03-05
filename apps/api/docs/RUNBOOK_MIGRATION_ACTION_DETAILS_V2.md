# Runbook — Aplicar Migration ActionDetailsV2 em PROD

**Objetivo:** Aplicar migration `20260303130000_add_schema_version_to_action_details` em produção para destravar endpoint `/details`.

**Pré-requisitos:**
- Acesso ao AWS CloudShell ou EC2 com acesso ao RDS
- Credenciais do Secrets Manager para `DATABASE_URL`
- Prisma CLI disponível (`npx prisma`)

---

## Passo 1 — Obter DATABASE_URL do Secrets Manager

```bash
# Via AWS CLI (CloudShell)
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id prod/DATABASE_URL \
  --query SecretString \
  --output text)

# Verificar se obteve (não deve mostrar o valor completo por segurança)
echo "DATABASE_URL obtido: ${DATABASE_URL:0:20}..."
```

**Alternativa (se secret estiver em outro formato):**
```bash
# Se o secret contém JSON
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id prod/DATABASE_URL \
  --query SecretString \
  --output text | jq -r '.DATABASE_URL')
```

---

## Passo 2 — Clonar/Atualizar Repositório

```bash
# Se ainda não tem o repo localmente
git clone https://github.com/fernando-m-vale/superseller-ia.git
cd superseller-ia

# Ou atualizar se já existe
git pull origin main
```

---

## Passo 3 — Navegar para Diretório da API

```bash
cd apps/api
```

---

## Passo 4 — Aplicar Migration

```bash
# Validar schema primeiro (opcional mas recomendado)
npx prisma validate

# Aplicar migration (não cria nova, apenas aplica pendentes)
npx prisma migrate deploy
```

**Saída esperada:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "superseller", schema "public"

Applying migration `20260303130000_add_schema_version_to_action_details`

The following migration(s) have been applied:

migrations/
  └─ 20260303130000_add_schema_version_to_action_details/
    └─ migration.sql

Your database is now in sync with your schema.
```

---

## Passo 5 — Verificar Migration Aplicada

```bash
# Conectar ao banco e verificar coluna
psql $DATABASE_URL -c "
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'listing_action_details' 
AND column_name = 'schema_version';
"

# Verificar índices
psql $DATABASE_URL -c "
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'listing_action_details' 
AND indexname LIKE '%schema_version%';
"
```

**Saída esperada:**
```
 column_name   | data_type | column_default
---------------+-----------+----------------
 schema_version | text     | 'v1'::text

 indexname                                          | indexdef
----------------------------------------------------+--------------------------------------------------
 listing_action_details_actionId_schemaVersion_key | CREATE UNIQUE INDEX ...
 listing_action_details_actionId_schemaVersion_idx | CREATE INDEX ...
```

---

## Passo 6 — Validar Endpoint em PROD

### 6.1 Testar V1 (deve retornar 200)

```bash
# Substituir {listingId}, {actionId} e {token} pelos valores reais
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v1" \
  -H "Authorization: Bearer {token}" \
  -v
```

**Critério PASS:**
- Status HTTP: `200 OK`
- Response JSON contém: `{"data": {...}, "cached": boolean, "version": "action_details_v1"}`

**Critério FAIL:**
- Status HTTP: `500 Internal Server Error`
- Response contém erro relacionado a `schema_version` ou `schemaVersion`

### 6.2 Testar V2 (deve retornar 200 ou 202)

```bash
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v2" \
  -H "Authorization: Bearer {token}" \
  -v
```

**Critério PASS:**
- Status HTTP: `200 OK` (cache hit) ou `202 Accepted` (GENERATING)
- Se 200: Response contém `"version": "action_details_v2"`
- Se 202: Response contém `"status": "GENERATING"`

**Critério FAIL:**
- Status HTTP: `500 Internal Server Error`
- Response contém erro relacionado a schema ou migration

---

## Passo 7 — Verificar Logs do App Runner

```bash
# Via AWS Console ou CLI
aws apprunner describe-service \
  --service-arn arn:aws:apprunner:... \
  --query 'Service.Status' \
  --output text

# Ver logs recentes (últimas 100 linhas)
aws logs tail /aws/apprunner/{service-name}/application \
  --since 5m \
  --filter-pattern "schema_version|schemaVersion|ActionDetails"
```

**O que procurar:**
- Erros relacionados a `schema_version` ou `schemaVersion`
- Queries SQL falhando por coluna não encontrada
- Prisma Client errors relacionados a campos

---

## Checklist de Validação (PASS/FAIL)

### ✅ PASS — Migration aplicada corretamente
- [ ] Migration `20260303130000_add_schema_version_to_action_details` aplicada sem erros
- [ ] Coluna `schema_version` existe na tabela `listing_action_details`
- [ ] Índices `listing_action_details_actionId_schemaVersion_key` e `listing_action_details_actionId_schemaVersion_idx` criados
- [ ] Endpoint `/details?schema=v1` retorna `200 OK`
- [ ] Endpoint `/details?schema=v2` retorna `200 OK` ou `202 Accepted`
- [ ] Logs do App Runner não mostram erros relacionados a `schema_version`

### ❌ FAIL — Problemas detectados
- [ ] Migration falha ao aplicar (erro SQL)
- [ ] Coluna `schema_version` não existe após migration
- [ ] Endpoint `/details?schema=v1` retorna `500 Internal Server Error`
- [ ] Endpoint `/details?schema=v2` retorna `500 Internal Server Error`
- [ ] Logs mostram erros relacionados a `schema_version` ou `schemaVersion`

---

## Troubleshooting

### Erro: "column schema_version does not exist"
**Causa:** Migration não foi aplicada ou falhou silenciosamente.

**Solução:**
1. Verificar se migration está na pasta `prisma/migrations/`
2. Verificar logs do `prisma migrate deploy`
3. Aplicar migration manualmente via SQL se necessário:
   ```sql
   ALTER TABLE "listing_action_details" ADD COLUMN IF NOT EXISTS "schema_version" TEXT NOT NULL DEFAULT 'v1';
   ```

### Erro: "relation listing_action_details_actionId_schemaVersion_key already exists"
**Causa:** Índice já foi criado manualmente ou migration parcialmente aplicada.

**Solução:**
1. Verificar índices existentes: `\d listing_action_details` no psql
2. Se índice existe, migration pode ser marcada como aplicada: `npx prisma migrate resolve --applied 20260303130000_add_schema_version_to_action_details`

### Erro: "Prisma Client out of sync"
**Causa:** Prisma Client não foi regenerado após mudança no schema.

**Solução:**
```bash
cd apps/api
npx prisma generate
# Redeploy do App Runner para usar novo cliente
```

---

## Pós-Validação

Após migration aplicada e endpoints validados:

1. **Monitorar logs por 1 hora** para garantir estabilidade
2. **Validar cache hit/miss** para V1 e V2
3. **Confirmar que V1 continua funcionando** (não quebrou rollout paralelo)
4. **Documentar evidências** (screenshots, logs, responses JSON)

---

## Referências

- Migration: `apps/api/prisma/migrations/20260303130000_add_schema_version_to_action_details/migration.sql`
- Schema: `apps/api/prisma/schema.prisma` (model `ListingActionDetail`)
- Arquitetura: `docs/ACTION_DETAILS_ARCHITECTURE.md`
