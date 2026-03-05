# Runbook — Fix V2 Action Details em PROD (2026-03-05)

**Objetivo:** Aplicar migration para remover índice único antigo e deploy API com fixes de coercion Zod.

**Pré-requisitos:**
- Acesso ao AWS CloudShell ou EC2 com acesso ao RDS
- Credenciais do Secrets Manager para `DATABASE_URL`
- Prisma CLI disponível (`npx prisma`)
- ✅ Fixes já mergeados em `main` (commit `fed7387`)

---

## Passo 1 — Verificar Fixes Mergeados

```bash
# Verificar que migration existe
ls -la apps/api/prisma/migrations/20260305200000_drop_old_actionid_unique_index/

# Verificar conteúdo da migration
cat apps/api/prisma/migrations/20260305200000_drop_old_actionid_unique_index/migration.sql
```

**Esperado:**
```sql
-- DropIndex: remove stale unique index on actionId only
DROP INDEX IF EXISTS "listing_action_details_actionId_key";
```

**Status:** ✅ Migration presente, coercion Zod implementada em `apps/api/src/services/schemas/ActionDetailsV2.ts`

---

## Passo 2 — Obter DATABASE_URL do Secrets Manager

```bash
# Via AWS CLI (CloudShell)
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id prod/DATABASE_URL \
  --query SecretString \
  --output text)

# Verificar se obteve (não deve mostrar o valor completo por segurança)
echo "DATABASE_URL obtido: ${DATABASE_URL:0:20}..."
```

---

## Passo 3 — Verificar Estado Atual do Banco

```bash
# Conectar ao banco e verificar índices existentes
psql $DATABASE_URL -c "
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'listing_action_details' 
AND indexname LIKE '%actionId%';
"
```

**Esperado antes da migration:**
- `listing_action_details_actionId_key` (índice único antigo - deve ser removido)
- `listing_action_details_actionId_schemaVersion_key` (unique composto - deve permanecer)
- `listing_action_details_actionId_schemaVersion_idx` (index - deve permanecer)

---

## Passo 4 — Aplicar Migration

```bash
# Navegar para diretório da API
cd apps/api

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

Applying migration `20260305200000_drop_old_actionid_unique_index`

The following migration(s) have been applied:

migrations/
  └─ 20260305200000_drop_old_actionid_unique_index/
    └─ migration.sql

Your database is now in sync with your schema.
```

---

## Passo 5 — Verificar Migration Aplicada

```bash
# Verificar que migration aparece em _prisma_migrations
psql $DATABASE_URL -c "
SELECT migration_name, finished_at 
FROM _prisma_migrations 
WHERE migration_name LIKE '%20260305%' 
ORDER BY finished_at DESC;
"

# Verificar que índice antigo foi removido
psql $DATABASE_URL -c "
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'listing_action_details' 
AND indexname = 'listing_action_details_actionId_key';
"
```

**Critério de sucesso:**
- Migration aparece em `_prisma_migrations` com `finished_at` preenchido
- Query do índice antigo retorna 0 linhas (índice removido)

---

## Passo 6 — Deploy API no App Runner

**Opção A — Deploy Automático (se configurado):**
```bash
# Push para main triggera deploy automático
git push origin main
```

**Opção B — Deploy Manual via AWS Console:**
1. AWS Console → App Runner → Service `superseller-api`
2. Actions → Deploy → Deploy latest revision
3. Aguardar deploy completar (status `RUNNING`)

**Validação:**
```bash
# Verificar status do serviço
aws apprunner describe-service \
  --service-arn arn:aws:apprunner:... \
  --query 'Service.Status' \
  --output text

# Verificar logs iniciais (últimas 50 linhas)
aws logs tail /aws/apprunner/{service-name}/application \
  --since 5m \
  --filter-pattern "ERROR|FATAL"
```

---

## Passo 7 — Validar Endpoints

### 7.1 Testar V1 (deve retornar 200)

```bash
# Substituir {listingId}, {actionId} e {token} pelos valores reais
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v1" \
  -H "Authorization: Bearer {token}" \
  -v
```

**Critério PASS:**
- Status HTTP: `200 OK`
- Response JSON contém: `{"data": {...}, "cached": boolean, "version": "action_details_v1"}`

### 7.2 Testar V2 (deve retornar 200 ou 202)

```bash
# Primeira chamada (cache miss - pode retornar 202 GENERATING)
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v2" \
  -H "Authorization: Bearer {token}" \
  -v

# Segunda chamada (cache hit - deve retornar 200)
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v2" \
  -H "Authorization: Bearer {token}" \
  -v
```

**Critério PASS:**
- Primeira chamada: Status HTTP `200 OK` (cache hit) ou `202 Accepted` (GENERATING)
- Se 200: Response contém `"version": "action_details_v2"` e `cached: boolean`
- Se 202: Response contém `"status": "GENERATING"`
- Segunda chamada: Status HTTP `200 OK` com `cached: true`
- Response não contém erros Prisma P2002 ou Zod validation

**Critério FAIL:**
- Status HTTP `500 Internal Server Error`
- Response contém erro Prisma P2002 (unique constraint)
- Response contém erro Zod validation

---

## Passo 8 — Validar UI "Ver detalhes"

**Ações:**
1. Abrir `https://app.superselleria.com.br` em PROD
2. Navegar para um listing com ações
3. Clicar em "Ver detalhes" em uma ação
4. Verificar que modal abre sem erro

**Critério PASS:**
- Modal abre sem erro no console do navegador
- Conteúdo renderiza (skeleton → dados)
- Se V2: artifacts aparecem corretamente (titleSuggestions, descriptionTemplate, etc.)
- Botões "Copiar" funcionam (se V2)
- Botões "Aplicar/Descartar" funcionam

**Critério FAIL:**
- Modal não abre (erro no console)
- Erro 500 visível na UI
- Conteúdo não renderiza (fica em loading infinito)

---

## Passo 9 — Monitorar Logs (10 minutos)

```bash
# Ver logs recentes filtrando por erros relacionados
aws logs tail /aws/apprunner/{service-name}/application \
  --since 10m \
  --filter-pattern "P2002|schema_version|ZodError|ActionDetails|ERROR"
```

**O que procurar:**
- ❌ Erros P2002 (unique constraint) → Migration não aplicada corretamente
- ❌ Erros Zod validation recorrentes → Coercion não funcionando
- ✅ Gerações V2 bem-sucedidas (status READY) → Tudo funcionando

---

## Checklist de Validação Final (PASS/FAIL)

### ✅ PASS — Fix aplicado corretamente
- [ ] Migration `20260305200000_drop_old_actionid_unique_index` aplicada sem erros
- [ ] Índice `listing_action_details_actionId_key` removido
- [ ] Migration aparece em `_prisma_migrations` com `finished_at` preenchido
- [ ] API deployada no App Runner (status `RUNNING`)
- [ ] Endpoint `/details?schema=v1` retorna `200 OK`
- [ ] Endpoint `/details?schema=v2` retorna `200 OK` ou `202 Accepted` (não mais 500)
- [ ] UI "Ver detalhes" funciona sem erro
- [ ] Logs não mostram erros P2002 ou Zod validation recorrentes

### ❌ FAIL — Problemas detectados
- [ ] Migration falha ao aplicar (erro SQL)
- [ ] Índice `listing_action_details_actionId_key` ainda existe após migration
- [ ] Endpoint `/details?schema=v1` retorna `500 Internal Server Error`
- [ ] Endpoint `/details?schema=v2` retorna `500 Internal Server Error`
- [ ] Response contém erro Prisma P2002 (unique constraint)
- [ ] Response contém erro Zod validation
- [ ] UI "Ver detalhes" ainda quebra
- [ ] Logs mostram erros recorrentes

---

## Troubleshooting

### Erro: "index listing_action_details_actionId_key does not exist"
**Causa:** Índice já foi removido manualmente ou migration já aplicada.

**Solução:**
1. Verificar se migration já está em `_prisma_migrations`
2. Se sim, continuar para deploy API
3. Se não, marcar migration como aplicada: `npx prisma migrate resolve --applied 20260305200000_drop_old_actionid_unique_index`

### Erro: "Zod validation failed"
**Causa:** Coercion não está funcionando ou LLM retorna formato muito inconsistente.

**Solução:**
1. Verificar que branch Devin foi mergeado
2. Verificar que `z.preprocess` está presente em `ActionDetailsV2.ts`
3. Ver logs para ver formato exato retornado pelo LLM
4. Ajustar coercion se necessário

### Erro: "Prisma Client out of sync"
**Causa:** Prisma Client não foi regenerado após mudanças.

**Solução:**
```bash
cd apps/api
npx prisma generate
# Redeploy do App Runner para usar novo cliente
```

---

## Referências

- Migration: `apps/api/prisma/migrations/20260305200000_drop_old_actionid_unique_index/migration.sql`
- Schema: `apps/api/src/services/schemas/ActionDetailsV2.ts` (coercion Zod)
- Branch: `devin/1772743406-fix-v2-action-details-schema`
- Arquitetura: `docs/ACTION_DETAILS_ARCHITECTURE.md`
