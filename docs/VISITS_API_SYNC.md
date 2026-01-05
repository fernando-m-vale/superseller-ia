# Visits API Sync — Mercado Livre

**Status:** Implementado ✅  
**Última atualização:** 2026-01-05

---

## 📋 Visão Geral

Este documento descreve a implementação da sincronização de visitas usando a **Visits API** do Mercado Livre. A Visits API é a fonte oficial para métricas de visitas, substituindo estimativas e dados não confiáveis.

### Endpoint da API do ML

```
GET /items/{id}/visits/time_window?last={N}&unit=day
```

**Resposta:**
```json
{
  "visits": [
    {
      "date": "2026-01-03",
      "visits": 45
    },
    {
      "date": "2026-01-04",
      "visits": 52
    }
  ]
}
```

---

## 🔧 Endpoints Implementados

### 1. Sync Incremental

**Endpoint:** `POST /api/v1/sync/mercadolivre/visits`

**Descrição:** Sincroniza visitas dos últimos 2-3 dias para todos os listings ativos do tenant.

**Request Body:**
```json
{
  "lastDays": 2  // Opcional, padrão: 2
}
```

**Response:**
```json
{
  "success": true,
  "listingsProcessed": 15,
  "metricsCreated": 8,
  "metricsUpdated": 22,
  "errors": [],
  "duration": 1234
}
```

**Uso:**
```bash
curl -X POST https://api.superseller.com/api/v1/sync/mercadolivre/visits \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"lastDays": 2}'
```

**Quando usar:**
- Execução diária via cron/job scheduler
- Após sync de listings para atualizar visitas recentes
- Para manter dados atualizados sem sobrecarregar a API

---

### 2. Backfill

**Endpoint:** `POST /api/v1/sync/mercadolivre/visits/backfill`

**Descrição:** Sincroniza visitas dos últimos 30 dias em backfill, processando em lotes com delay para respeitar rate limits.

**Request Body:**
```json
{
  "lastDays": 30,      // Opcional, padrão: 30
  "batchSize": 10,     // Opcional, padrão: 10
  "delayMs": 1000      // Opcional, padrão: 1000ms
}
```

**Response:**
```json
{
  "success": true,
  "listingsProcessed": 15,
  "metricsCreated": 450,
  "metricsUpdated": 0,
  "errors": [],
  "duration": 45678
}
```

**Uso:**
```bash
curl -X POST https://api.superseller.com/api/v1/sync/mercadolivre/visits/backfill \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "lastDays": 30,
    "batchSize": 10,
    "delayMs": 1000
  }'
```

**Quando usar:**
- Primeira execução para popular histórico
- Após integração inicial do tenant
- Para recuperar dados históricos perdidos
- **Cuidado:** Pode demorar vários minutos dependendo do número de listings

---

## 📊 Persistência

### Tabela: `listing_metrics_daily`

**Campos preenchidos:**
- `visits`: Número de visitas do dia (vindo da API)
- `date`: Data do dia (normalizada para 00:00:00)
- `source`: `"ml_visits_api_daily"`

**Campos NÃO preenchidos (mantêm valores existentes ou null):**
- `impressions`: `null` (sem fonte oficial)
- `clicks`: `null` (sem fonte oficial)
- `ctr`: `null` (sem fonte oficial)
- `orders`: `0` (vem de Orders API em sync separado)
- `gmv`: `0` (vem de Orders API em sync separado)
- `conversion`: `null` (calculado apenas se visits conhecida)

**Política de Upsert:**
- Se já existe métrica para o dia: atualiza apenas `visits` e `source`
- Se não existe: cria nova linha com `visits`, `date`, `source` e defaults

---

## 🛡️ Tratamento de Erros

### 401 / 403 (Unauthorized / Forbidden)

**Comportamento:** Abortar sync imediatamente para o tenant

**Motivo:** Indica problema de autenticação/autorização que afeta todos os requests.

**Log:**
```
[ML-VISITS] Erro de autenticação (401) para listing {id}. Abortando sync para tenant.
```

**Ação:** Reconectar conta do Mercado Livre.

---

### 429 (Rate Limit)

**Comportamento:** Retry simples com backoff de 2 segundos (1 tentativa)

**Motivo:** API do ML limitou requests. Retry geralmente resolve.

**Log:**
```
[ML-VISITS] Rate limit (429) para listing {id}. Aguardando 2s e retry...
```

**Se retry falhar:** Loga erro e continua para próximo listing (não derruba lote inteiro).

---

### Outros Erros (4xx, 5xx, Network)

**Comportamento:** Loga erro e continua para próximo listing

**Motivo:** Erro específico do item não deve bloquear processamento de outros.

**Log:**
```
[ML-VISITS] Erro ao processar listing {id} ({status}): {detalhes}
```

**Ação:** Verificar logs para identificar padrões de erro.

---

## 📝 Logs Estruturados

### Formato de Log

**Sync Incremental:**
```
[ML-VISITS] Iniciando sync incremental de visitas para tenant: {tenantId} (últimos {lastDays} dias)
[ML-VISITS] Encontrados {count} anúncios ativos
[ML-VISITS] Buscando visitas para item {itemId}, últimos {lastDays} dias
[ML-VISITS] Sync incremental concluído em {duration}ms
[ML-VISITS] Processados: {listingsProcessed}, Criados: {metricsCreated}, Atualizados: {metricsUpdated}
```

**Backfill:**
```
[ML-VISITS] [backfill-{timestamp}] Iniciando backfill de visitas para tenant: {tenantId}
[ML-VISITS] [backfill-{timestamp}] Processando {batchCount} lotes de até {batchSize} listings
[ML-VISITS] [backfill-{timestamp}-listing-{listingId}] Buscando visitas para listing {listingIdExt}
[ML-VISITS] [backfill-{timestamp}-listing-{listingId}] ✓ Processado: {daysCount} dias de visitas
[ML-VISITS] [backfill-{timestamp}] Aguardando {delayMs}ms antes do próximo lote...
[ML-VISITS] [backfill-{timestamp}] Backfill concluído em {duration}ms
```

**Request IDs:**
- Incremental: logs simples (sem requestId)
- Backfill: `backfill-{timestamp}` para rastreamento de lote
- Listing específico: `backfill-{timestamp}-listing-{listingId}`

---

## ⚙️ Configuração e Rate Limits

### Rate Limits da API do ML

A Visits API do Mercado Livre tem limites de rate que variam por plano. Recomendações:

**Incremental (diário):**
- `lastDays: 2-3` (padrão: 2)
- Processamento sequencial (sem delay entre listings)
- Tempo estimado: ~1-2s por listing

**Backfill:**
- `batchSize: 10` (padrão)
- `delayMs: 1000` (padrão: 1s entre lotes)
- Tempo estimado: ~30-60s por listing (com delay)

**Ajustes recomendados:**
- Se receber muitos 429: aumentar `delayMs` para 2000-3000ms
- Se processar muitos listings: reduzir `batchSize` para 5
- Para backfill rápido (cuidado): `batchSize: 20`, `delayMs: 500` (pode causar 429)

---

## ✅ Checklist de Testes Manuais

### Teste 1: Sync Incremental

- [ ] Conectar conta do Mercado Livre
- [ ] Executar `POST /api/v1/sync/mercadolivre/visits` com `lastDays: 2`
- [ ] Verificar logs: "Processados: X, Criados: Y, Atualizados: Z"
- [ ] Verificar BD: `listing_metrics_daily` tem `source = 'ml_visits_api_daily'`
- [ ] Verificar que `visits` está preenchido (não null)
- [ ] Verificar que `impressions`, `clicks`, `ctr` são null

### Teste 2: Backfill

- [ ] Executar `POST /api/v1/sync/mercadolivre/visits/backfill` com `lastDays: 7`
- [ ] Verificar logs: requestId aparece em todos os logs
- [ ] Verificar que processa em lotes (logs mostram "Processando lote X/Y")
- [ ] Verificar delay entre lotes (logs mostram "Aguardando {delayMs}ms")
- [ ] Verificar BD: múltiplas linhas criadas (uma por dia)

### Teste 3: Tratamento de Erros

- [ ] **401/403:** Revogar token e executar sync → deve abortar imediatamente
- [ ] **429:** (simular com muitos requests) → deve fazer retry e continuar
- [ ] **404:** Item inexistente → deve logar erro e continuar para próximo

### Teste 4: Upsert

- [ ] Executar sync incremental duas vezes
- [ ] Primeira execução: cria métricas
- [ ] Segunda execução: atualiza métricas existentes (não duplica)
- [ ] Verificar que outros campos (orders, gmv) não são sobrescritos

---

## 🔗 Referências

- [Mercado Livre Developers - Visits API](https://developers.mercadolivre.com.br/pt_br/recurso-visits)
- `docs/ML_DATA_AUDIT.md` - Contrato de dados completo
- `apps/api/src/services/MercadoLivreVisitsService.ts` - Implementação do service
- `apps/api/src/routes/mercadolivre.ts` - Endpoints de sync

---

## 📌 Observações

1. **Não implementa UI changes:** Endpoints são apenas para sync. UI será atualizada em PR separado.

2. **Não requer migração:** Schema já suporta `visits` nullable e `source` string.

3. **Rate limits:** Respeitar limites da API do ML. Em caso de muitos 429, aumentar delays.

4. **Concorrência:** Não executar múltiplos syncs simultâneos para o mesmo tenant (pode causar race conditions).

5. **Monitoramento:** Acompanhar logs para identificar padrões de erro e ajustar configurações.

