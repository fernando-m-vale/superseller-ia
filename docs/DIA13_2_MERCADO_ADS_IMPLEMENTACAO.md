# DIA 13.2 - Implementacao real de Product Ads

Data: 2026-03-12

## Escopo implementado

Foi implementada uma integracao incremental e segura de Product Ads dentro do fluxo existente de `MarketplaceAdsIntelligenceService`, sem quebrar o contrato atual de `adsIntelligence`.

Objetivo desta fase:

- usar Product Ads como fonte real de dados quando houver metricas preenchidas;
- persistir em `listing_ads_metrics_daily`;
- manter fallback honesto quando o item existe, mas `metrics` vem vazio.

## Endpoints finais usados

### Fluxo principal

1. `GET /users/me`
2. `GET /advertising/advertisers?product_id=PADS`
3. `GET /advertising/{site_id}/advertisers/{advertiser_id}/product_ads/ads/search`
4. `GET /advertising/{site_id}/product_ads/items/{item_id}`

### Params usados

No `ads/search`:

- `limit=50`
- `offset`
- `date_from`
- `date_to`
- `metrics=clicks,prints,ctr,cost,cpc,cvr,roas,direct_amount,total_amount,direct_items_quantity,advertising_items_quantity,units_quantity`

No `items/{item_id}`:

- `date_from`
- `date_to`
- `metrics=clicks,prints,ctr,cost,cpc,cvr,roas,direct_amount,total_amount,direct_items_quantity,advertising_items_quantity,units_quantity`

### Janela usada

- janela movel de `30 dias`

Observacao:

- a persistencia continua diaria no banco, mas o snapshot atual representa a melhor leitura disponivel na janela consultada;
- isso foi escolhido porque a leitura validada nesta fase e agregada por janela, nao comprovadamente diaria.

## Decisoes de mapeamento

Mapeamento para `listing_ads_metrics_daily`:

- `impressions <- prints`
- `clicks <- clicks`
- `ctr <- ctr`
- `cpc <- cpc`
- `spend <- cost`
- `orders_attributed <- direct_items_quantity`
- fallback de `orders_attributed <- advertising_items_quantity`
- fallback de `orders_attributed <- units_quantity`
- `revenue_attributed <- direct_amount`
- fallback de `revenue_attributed <- total_amount`
- `roas <- roas`
- `conversion_rate_ads <- cvr`

Decisao sobre revenue:

- priorizamos `direct_amount` por ser o sinal mais conservador de receita atribuida;
- quando `direct_amount` nao vem preenchido, usamos `total_amount` como fallback e registramos isso em metadata.

## Regras de fallback

### Quando ha metricas preenchidas

- persistimos `status=available`
- `source` recebe o endpoint vencedor:
  - `mercadolivre_product_ads_ads_search`
  - ou `mercadolivre_product_ads_item_detail`

### Quando o item existe, mas `metrics` vem vazio

- persistimos `status=partial`
- `source=mercadolivre_product_ads_metrics_empty`
- o bloco `adsIntelligence` passa a refletir leitura parcial, nao `unavailable`

### Quando nao ha item correspondente ou ocorre erro de leitura

- persistimos `status=unavailable`
- mantemos fallback controlado e metadata de auditoria

## Limitacoes assumidas nesta fase

- Product Ads foi priorizado; Brand Ads segue fora do fluxo principal
- a leitura esta baseada em janela movel, nao em serie diaria garantida pela API
- `ads/search` e consultado por pagina e o item alvo e localizado pelo `item_id`
- se a API continuar respondendo com `metrics` vazio, a leitura permanece `partial`
- rotas tentadas anteriormente como `/campaigns/report` e `/ads/report` nao entram na implementacao porque os testes reais anteriores retornaram `404`

## Arquivos principais

- `apps/api/src/services/MarketplaceAdsIntelligenceService.ts`
- `apps/api/src/services/ads/mercadoAdsProductMetrics.ts`
- `apps/api/src/services/ads/MarketplaceAdsIntelligenceEngine.ts`
- `apps/api/src/__tests__/mercado-ads-product-metrics.test.ts`
- `apps/api/src/__tests__/marketplace-ads-intelligence-service.test.ts`

## Validacao esperada em ambiente real

Em ambiente com banco e token acessiveis:

1. chamar `analyze`
2. verificar escrita em `listing_ads_metrics_daily`
3. confirmar `adsIntelligence.status`:
   - `available` quando Product Ads vier com metricas
   - `partial` quando o item for encontrado, mas `metrics` vier vazio
   - `unavailable` quando nao houver leitura confiavel
