# Debug Endpoints — Mercado Livre

**Status:** Implementado ✅  
**Última atualização:** 2026-01-05  
**Ambiente:** PROD (sempre disponível, somente leitura)

---

## 📋 Visão Geral

Endpoints de debug para diagnóstico de problemas de sincronização do Mercado Livre. **Sempre disponíveis em produção**, somente leitura (sem persistência).

**Uso:** Quando `listings = 0` após sync, use estes endpoints para diagnosticar.

---

## 🔧 Endpoints

### 1. GET /api/v1/debug/mercadolivre/me

**Descrição:** Chama `/users/me` da API do ML e retorna informações básicas do usuário.

**Autenticação:** Requer `authGuard` (token JWT)

**Response:**
```json
{
  "id": 123456789,
  "nickname": "SELLER_NICKNAME",
  "site_id": "MLB",
  "country_id": "BR",
  "sellerId": "123456789",
  "fetchedAt": "2026-01-05T10:30:00.000Z"
}
```

**Uso:**
```bash
curl -X GET https://api.superseller.com/api/v1/debug/mercadolivre/me \
  -H "Authorization: Bearer <token>"
```

**Quando usar:**
- Verificar se a conexão está ativa
- Validar que o token está funcionando
- Confirmar sellerId/nickname

---

### 2. GET /api/v1/debug/mercadolivre/my-items?limit=50

**Descrição:** Lista itemIds usando o **mesmo método do sync de listings** (`/sites/MLB/search`).

**Autenticação:** Requer `authGuard` (token JWT)

**Query Params:**
- `limit` (opcional): Número máximo de IDs para retornar (padrão: 50, máximo: 200)

**Response:**
```json
{
  "total": 150,
  "ids": ["MLB123456789", "MLB987654321", ...],
  "sellerId": "123456789",
  "endpoint": "/sites/MLB/search",
  "fetchedAt": "2026-01-05T10:30:00.000Z"
}
```

**Uso:**
```bash
curl -X GET "https://api.superseller.com/api/v1/debug/mercadolivre/my-items?limit=50" \
  -H "Authorization: Bearer <token>"
```

**Quando usar:**
- Diagnosticar por que `listings = 0` após sync
- Verificar se a API do ML retorna itens para o seller
- Validar que o sellerId está correto

---

## 🔍 Diagnóstico: Listings = 0

**Se após sync você tiver `listings = 0`:**

1. **Verificar conexão:**
   ```bash
   GET /api/v1/debug/mercadolivre/me
   ```
   - Se retornar 404: conexão não encontrada ou inativa
   - Se retornar 401: token expirado (reconectar)
   - Se retornar dados: conexão OK

2. **Verificar itens na API do ML:**
   ```bash
   GET /api/v1/debug/mercadolivre/my-items?limit=50
   ```
   - Se `total = 0`: seller não tem itens no ML (ou sellerId incorreto)
   - Se `total > 0` mas sync retorna 0: problema no sync (ver logs)
   - Se retornar erro: problema de autenticação/permissão

3. **Verificar logs do sync:**
   - Buscar por `[ML-SYNC]` nos logs
   - Verificar `tenantId`, `sellerId`, `total`, `motivo`
   - Se `motivo=nenhum_item_encontrado_via_search`: API do ML não retornou itens

---

## 📝 Logs Estruturados no Sync

O sync de listings agora emite logs estruturados:

**Início:**
```
[ML-SYNC] Iniciando sincronização tenantId={tenantId}
[ML-SYNC] Conexão carregada tenantId={tenantId} sellerId={sellerId}
```

**Busca de items:**
```
[ML-SYNC] Buscando items tenantId={tenantId} sellerId={sellerId} endpoint=/sites/MLB/search offset={offset}
[ML-SYNC] Progresso tenantId={tenantId} sellerId={sellerId} encontrados={count} total={total}
```

**Resultado:**
```
[ML-SYNC] Busca concluída tenantId={tenantId} sellerId={sellerId} endpoint=/sites/MLB/search total={total} sampleIds=[id1,id2,...]
```

**Quando total=0:**
```
[ML-SYNC] Nenhum anúncio encontrado tenantId={tenantId} sellerId={sellerId} motivo=nenhum_item_encontrado_via_search endpoint=/sites/MLB/search
```

**Conclusão:**
```
[ML-SYNC] Sincronização concluída tenantId={tenantId} sellerId={sellerId} durationMs={duration} processed={count} created={count} updated={count} errors={count}
```

**Sync Full:**
```
[ML-SYNC-FULL] Iniciando sync completo tenantId={tenantId}
[ML-SYNC-FULL] Sync listings concluído tenantId={tenantId} processed={count} created={count} updated={count} durationMs={duration}
[ML-SYNC-FULL] Sync orders concluído tenantId={tenantId} processed={count} created={count} updated={count} durationMs={duration}
[ML-SYNC-FULL] Sync completo finalizado tenantId={tenantId}
```

---

## 🔒 Segurança

- **Somente leitura:** Endpoints não fazem persistência
- **Autenticação obrigatória:** Requer `authGuard`
- **Isolamento por tenant:** Cada tenant só vê seus próprios dados
- **Sem exposição de tokens:** Respostas não incluem access_token/refresh_token

---

## 📌 Observações

1. **Credenciais:** Endpoints sempre usam credenciais de `marketplace_connections` (nunca env vars antigas)

2. **Mesmo método do sync:** `/my-items` usa exatamente o mesmo código que o sync de listings, garantindo consistência

3. **Limite de offset:** A API do ML limita offset a 1000. Se seller tiver mais de 1000 itens, apenas os primeiros 1000 serão retornados

4. **Rate limits:** Respeitar limites da API do ML. Endpoints de debug não fazem cache

---

## 🔗 Referências

- `apps/api/src/routes/debug.routes.ts` - Implementação dos endpoints
- `apps/api/src/services/MercadoLivreSyncService.ts` - Service de sync (mesmo método usado)
- `docs/ML_DATA_AUDIT.md` - Contrato de dados completo

