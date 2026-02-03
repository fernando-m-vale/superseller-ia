# Checklist Pós-Deploy - Fix Runtime Crash

## ✅ Validação de Endpoints em Produção

Após o deploy, validar que os seguintes endpoints estão funcionando:

### 1. Status do Sync
```bash
curl -X GET https://api.superselleria.com.br/api/v1/sync/status
```
**Esperado:** Status 200 com informações do sync

### 2. Meta Endpoint
```bash
curl -X GET https://api.superselleria.com.br/api/v1/meta
```
**Esperado:** Status 200 com gitSha, buildTime, env

### 3. Debug Payload (requer auth)
```bash
curl -X GET https://api.superselleria.com.br/api/v1/ai/debug-payload/MLB4217107417 \
  -H "Authorization: Bearer <token>"
```
**Esperado:** Status 200 com payload sanitizado da IA

### 4. Force Refresh (requer auth)
```bash
curl -X POST https://api.superselleria.com.br/api/v1/sync/mercadolivre/listings/MLB4217107417/force-refresh \
  -H "Authorization: Bearer <token>"
```
**Esperado:** Status 200 com dados atualizados do listing

## 🔍 Validações Adicionais

- [ ] Verificar logs do App Runner para confirmar que não há erros de import
- [ ] Confirmar que o servidor inicia sem exceptions
- [ ] Validar que análises de IA estão sendo geradas corretamente
- [ ] Verificar que prompts versionados estão sendo carregados corretamente

## 📝 Notas

- Este fix resolve o runtime crash causado por imports de paths internos (`@superseller/ai/dist/...`)
- Agora usa exports públicos do package (`@superseller/ai/prompts/*`)
- Smoke test no CI valida que o servidor inicia sem crash
