# Visits API Sync — Mercado Livre

**Status:** Implementado ✅  
**Última atualização:** 2026-01-05  
**Prioridade:** PRIORIDADE ZERO (ML Data Audit)  

---

## 📋 Visão Geral

Este documento descreve a sincronização de visitas usando a **Visits API** do Mercado Livre.

A Visits API é a **fonte oficial** para métricas de visitas por item e deve substituir:
- qualquer campo não confiável em Items API
- qualquer estimativa/derivação (proibido)

Este sync persiste visitas na tabela `listing_metrics_daily` como **série temporal diária**.

📌 Regras do contrato (ver também `docs/ML_DATA_AUDIT.md`):
- `NULL` = indisponível / não coletado
- `0` = zero real
- impressions/clicks/ctr **devem ficar NULL** sem fonte oficial

---

## 🔗 Endpoint da Visits API (Mercado Livre)

### Primário: time_window (série temporal)

GET /items/{id}/visits/time_window?last={N}&unit=day


**Resposta (exemplo):**
```json
{
  "visits": [
    { "date": "2026-01-03", "visits": 45 },
    { "date": "2026-01-04", "visits": 52 }
  ]
}

Observação: Se a API retornar vazio/sem dados, isso deve ser tratado como indisponível (não inventar 0 nem criar linha sem necessidade).

🔧 Endpoints do SuperSeller IA (Implementados)
1) Sync Incremental

Endpoint: POST /api/v1/sync/mercadolivre/visits

Descrição: Sincroniza visitas dos últimos 2–3 dias para todos os listings ativos do tenant.

Request Body:

{
  "lastDays": 2
}


lastDays opcional (padrão: 2)

Response:

{
  "success": true,
  "listingsProcessed": 15,
  "metricsCreated": 8,
  "metricsUpdated": 22,
  "errors": [],
  "duration": 1234
}


Uso (exemplo):
curl -X POST https://api.superseller.com/api/v1/sync/mercadolivre/visits \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"lastDays": 2}'


Quando usar:

Execução diária via job scheduler

Após sync de listings

Para manter visitas recentes atualizadas com baixo custo

2) Backfill (Histórico)

Endpoint: POST /api/v1/sync/mercadolivre/visits/backfill

Descrição: Sincroniza visitas dos últimos N dias (padrão 30), processando em lotes com delay para respeitar rate limit.

Request Body:

{
  "lastDays": 30,
  "batchSize": 10,
  "delayMs": 1000
}


Response:

{
  "success": true,
  "listingsProcessed": 15,
  "metricsCreated": 450,
  "metricsUpdated": 0,
  "errors": [],
  "duration": 45678
}

Uso (exemplo):

curl -X POST https://api.superseller.com/api/v1/sync/mercadolivre/visits/backfill \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "lastDays": 30,
    "batchSize": 10,
    "delayMs": 1000
  }'


Quando usar:

Primeira execução (popular histórico)

Reprocesso após incidente

Recuperação de histórico perdido

Recomendação: antes do 30 dias, validar com lastDays: 7 para checar cobertura e rate limit.

📊 Persistência
Tabela: listing_metrics_daily

Objetivo: armazenar série temporal diária por listing.

Campos preenchidos por este sync:

visits: número de visitas do dia

date: data do dia (normalizada para 00:00:00)

source: "ml_visits_api_daily"

Campos NÃO preenchidos por este sync (mantêm o que estiver no banco):

impressions: null (sem fonte oficial)

clicks: null (sem fonte oficial)

ctr: null (sem fonte oficial)

conversion: null (só calcular quando houver regra explícita e visits conhecida)

IMPORTANTE sobre orders/gmv:

Este sync não é responsável por orders/gmv.

orders e gmv devem ser preenchidos apenas pelo sync da Orders API.

Portanto, este sync deve evitar setar orders/gmv (não “chumbar 0” se a métrica não foi calculada aqui).

Política de Upsert:

Se já existe linha para (tenant_id, listing_id, date): atualiza apenas visits e source

Se não existe: cria nova linha com tenant_id, listing_id, date, visits, source

Nunca sobrescrever visits existente com null

🛡️ Tratamento de Erros
401 / 403 (Unauthorized / Forbidden)

Comportamento: aborta sync para o tenant (falha sistêmica de credencial).

Log:
[ML-VISITS] Erro de autenticação (401/403) para tenant. Abortando.


Ação: reconectar conta do Mercado Livre.

429 (Rate Limit)

Comportamento: retry simples com backoff e continuidade.

Log:

[ML-VISITS] Rate limit (429) para listing {id}. Retry após {ms}...

Ajustes recomendados:

aumentar delayMs (backfill)

reduzir batchSize

Outros erros (4xx/5xx/network)

Comportamento: loga e continua para o próximo listing.

📝 Logs Estruturados
Incremental

[ML-VISITS] Iniciando sync incremental tenant={tenantId} lastDays={lastDays}
[ML-VISITS] Listings ativos encontrados={count}
[ML-VISITS] Processando listing={listingId} item={itemId}
[ML-VISITS] Concluído durationMs={duration} processed={listingsProcessed} created={metricsCreated} updated={metricsUpdated}


Backfill
[ML-VISITS] [backfill-{timestamp}] Iniciando backfill tenant={tenantId} lastDays={lastDays}
[ML-VISITS] [backfill-{timestamp}] Lotes={batchCount} batchSize={batchSize} delayMs={delayMs}
[ML-VISITS] [backfill-{timestamp}-listing-{listingId}] Processando item={itemId}
[ML-VISITS] [backfill-{timestamp}] Aguardando {delayMs}ms próximo lote...
[ML-VISITS] [backfill-{timestamp}] Concluído durationMs={duration} processed={listingsProcessed}


⚙️ Rate Limits e recomendações operacionais

Incremental (diário):

lastDays: 2 (padrão)

processamento sequencial

sem delay extra

Backfill (30 dias):

batchSize: 10, delayMs: 1000 (padrão)

se 429 frequente: batchSize: 5 e delayMs: 2000–3000

Importante:

Evitar rodar múltiplos backfills simultâneos para o mesmo tenant

Ideal: travar por tenant (mutex/flag) em versões futuras

✅ Checklist de Testes Manuais
Teste 1 — Incremental

 Executar POST /api/v1/sync/mercadolivre/visits com lastDays: 2

 Verificar logs de sucesso

 Verificar BD: listing_metrics_daily.source = 'ml_visits_api_daily'

 Verificar BD: visits preenchido em alguns dias/itens

 Verificar BD: impressions/clicks/ctr continuam null

Teste 2 — Backfill (7 dias primeiro)

 Executar backfill com lastDays: 7, batchSize: 5, delayMs: 1500

 Validar que não duplica (unique constraint)

 Validar gaps/cobertura

Teste 3 — Upsert

 Rodar incremental 2x e confirmar metricsUpdated > 0 na segunda execução

 Confirmar ausência de duplicatas no BD

Teste 4 — Erros

 401/403: aborta

 429: retry e continua

 5xx: loga e continua

🔎 Validação (SQL e Logs)

Use o documento:

docs/VISITS_API_VALIDATION.md

🔗 Referências internas

docs/ML_DATA_AUDIT.md — contrato de dados

docs/VISITS_API_INTEGRATION_DESIGN.md — design técnico

apps/api/src/services/MercadoLivreVisitsService.ts

apps/api/src/routes/mercadolivre.ts

📌 Observações finais

Este sync não altera UI diretamente; ele prepara dados reais.

Se a UI quebrar com null, corrigir em PR separado (frontend).

Se houver inconsistência de timezone, normalizar no service (00:00:00).

