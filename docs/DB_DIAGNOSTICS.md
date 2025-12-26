# DB_DIAGNOSTICS — Mercado Livre Sync & IA Data Integrity

Este documento é o **runbook oficial** para diagnosticar problemas de dados
(listings, métricas e payload da IA) no SuperSeller IA.

Objetivo:
- Garantir que a IA analise **dados reais**
- Evitar “alucinações” (ex.: dizer que não há fotos, vendas ou descrição quando existem)
- Padronizar debug de sync com Mercado Livre

---

Status: Válido e atualizado após correções de sync e métricas.


## 1. Identidades canário (usar sempre para testes)

### Tenant (produção)
```sql
tenant_id = '6c00e0e6-7c94-48cf-a77d-2ef1a2499794'

Listing canário (bom desempenho)
listing_id = '92f52f51-9f44-4aed-8674-1942b7871ae0'

Critério para canário válido:

GMV > 0 (30 dias)

Orders > 0 (30 dias)

Listing ativo
POST /api/v1/sync/mercadolivre/listings?limit=50
Authorization: Bearer <JWT>


Efeitos esperados:

pictures_count > 0

description não vazia

thumbnail_url preenchida

has_video true quando aplicável

Efeitos esperados:

pictures_count > 0

description não vazia

thumbnail_url preenchida

has_video true quando aplicável

POST /api/v1/sync/mercadolivre/metrics?days=30
Authorization: Bearer <JWT>


Resposta esperada:
{
  "message": "Sincronização de métricas concluída com sucesso",
  "data": {
    "listingsProcessed": 15,
    "metricsCreated": 270,
    "duration": "xxxxms"
  }
}


3. Diagnóstico de performance (listing_metrics_daily)
3.1 Existe dado de métricas nos últimos 30 dias?

SELECT
  COUNT(*) AS rows_30d,
  COUNT(DISTINCT listing_id) AS distinct_listings_30d,
  MIN(date) AS min_date,
  MAX(date) AS max_date
FROM listing_metrics_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days';


Esperado:

rows_30d > 0

distinct_listings_30d > 0

3.2 Top listing por GMV (canário automático)
SELECT
  tenant_id,
  listing_id,
  SUM(orders) AS orders_30d,
  SUM(gmv) AS gmv_30d,
  SUM(visits) AS visits_30d,
  MIN(date) AS min_date,
  MAX(date) AS max_date
FROM listing_metrics_daily
WHERE tenant_id = '6c00e0e6-7c94-48cf-a77d-2ef1a2499794'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, listing_id
ORDER BY SUM(gmv) DESC
LIMIT 5;

⚠️ Observação:

Se orders_30d > 0 e visits_30d = 0, isso indica limitação da API do ML (visits não fornecidas).

Nesse caso, IA deve tratar como unknown, não como zero.

4. Diagnóstico de cadastro do listing (mídia + descrição)
4.1 Verificar cadastro do canário

SELECT
  id,
  listing_id_ext,
  marketplace,
  status,
  title,
  (description IS NOT NULL AND length(trim(description)) > 0) AS has_description,
  pictures_count,
  has_video,
  visits_last_7d,
  sales_last_7d,
  updated_at
FROM listings
WHERE tenant_id = '6c00e0e6-7c94-48cf-a77d-2ef1a2499794'
  AND id = '92f52f51-9f44-4aed-8674-1942b7871ae0';


Critério mínimo de qualidade:

has_description = true

pictures_count > 0

has_video = true (se o anúncio realmente possui vídeo)

4.2 Quantos listings têm mídia corretamente?

SELECT COUNT(*) AS with_pictures
FROM listings
WHERE tenant_id = '6c00e0e6-7c94-48cf-a77d-2ef1a2499794'
  AND marketplace = 'mercadolivre'
  AND pictures_count > 0;


Esperado:

Retornar > 0

Se retornar 0 → problema no sync de listings

5. Verificação de integridade (join quebrado?)
5.1 Métricas apontando para listings inexistentes
SELECT COUNT(*) AS broken_metrics
FROM listing_metrics_daily m
LEFT JOIN listings l ON l.id = m.listing_id
WHERE l.id IS NULL;


Esperado:

broken_metrics = 0

6. Regras para a IA (contrato de dados)

A IA NÃO PODE:

Dizer “sem fotos” se pictures_count > 0

Dizer “sem descrição” se description existir

Dizer “sem vendas” se orders_30d > 0

Assumir ausência de visitas se o campo for “unknown”

Fonte de verdade:

❌ visits_last_7d, sales_last_7d (NÃO USAR NA IA)

✅ listing_metrics_daily (30 dias)

Fallback:

Se não houver métricas → sinalizar via dataQuality, não inferir

7. Checklist rápido (antes de rodar IA)

Antes de executar:
POST /api/v1/ai/analyze/:listingId

Confirmar:

 Listing tem description

 pictures_count > 0

 Métricas 30d existem (orders/gmv)

 join listings ↔ metrics está íntegro

 IA usa apenas fontes confiáveis

8. Status atual conhecido (2025-12-22)

✅ Métricas diárias existem

⚠️ Visits podem aparecer como 0 mesmo com orders > 0 (limitação ML)

⚠️ Campo has_video ainda não preenchido corretamente

❌ Aba “Recomendações” do modal usa fonte antiga e deve ser removida

🔜 Próximo foco: IA Score Model + Prompt avançado

## Runbook — Diagnóstico de Vídeo (has_video) Mercado Livre

### Objetivo
Validar se a API do Mercado Livre retorna evidência de vídeo (video_id/videos/etc.) para um item que possui vídeo na UI.
Se a API não retornar, `has_video` não pode ser considerado fonte confiável.

### Pré-requisitos
- Ter um `access_token` OAuth válido da conexão Mercado Livre do tenant.
- Não expor tokens em logs/screenshots/prints.

### Passo 1 — Obter access_token do ML no banco
```sql
SELECT
  provider_account_id,
  type,
  status,
  expires_at,
  updated_at
FROM marketplace_connections
WHERE tenant_id = '<TENANT_ID>'
  AND type = 'mercadolivre'
ORDER BY updated_at DESC
LIMIT 5;

Passo 2 — Testar item autenticado (PowerShell)
SELECT access_token
FROM marketplace_connections
WHERE tenant_id = '<TENANT_ID>'
  AND type = 'mercadolivre'
ORDER BY updated_at DESC
LIMIT 1;

Passo 3 — Checar descrição autenticada (PowerShell)
Invoke-RestMethod -Method Get -Uri "https://api.mercadolibre.com/items/$itemId/description" -Headers @{
  Authorization = "Bearer $mlAccessToken"
  "User-Agent"  = "SuperSellerIA/1.0"
}

Passo 4 — Verificação de evidências de vídeo no JSON retornado

Validar presença de qualquer um:

video_id

videos

keys contendo “video”

attributes/tags relacionados a vídeo

Resultado esperado

Se houver evidência: corrigir gravação do has_video no sync.

Se não houver evidência: tratar has_video como desconhecido e remover/mitigar penalização no score/modelo.
