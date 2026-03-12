# DIA 13.1 - Investigacao e Integracao Real de Mercado Ads

Data da investigacao: 2026-03-12

## Escopo

Esta investigacao teve duas frentes:

1. revisar a documentacao oficial de Mercado Ads para Product Ads e Brand Ads;
2. validar se o ambiente local conseguia reutilizar o `access_token` atual da integracao Mercado Livre para probes reais.

## Resultado executivo

Classificacao atual: `C) integracao indisponivel com token atual neste ambiente`

Motivo:

- a documentacao oficial confirma que existem APIs publicas de Ads com metricas uteis;
- porem, neste workspace nao foi possivel acessar a conexao real do tenant porque o banco configurado em `apps/api/.env` depende de um tunel em `localhost:5434`, e o host nao estava acessivel durante a execucao;
- sem acesso ao `marketplace_connections`, nao foi possivel recuperar nem renovar o `access_token` real para a prova pratica exigida pela task.

Importante:

- isso **nao** significa que a API de Mercado Ads seja inviavel em definitivo;
- significa apenas que **a validacao com o token atual nao pode ser concluida neste ambiente**.

## Endpoints oficiais confirmados na documentacao

### Product Ads

Fluxo oficial identificado:

1. consultar advertisers via `GET /advertising/advertisers?product_id=PADS`
2. consultar campanhas via `GET /advertising/{site_id}/advertisers/{advertiser_id}/product_ads/campaigns/search`
3. consultar ads / itens via `GET /advertising/{site_id}/advertisers/{advertiser_id}/product_ads/ads/search`
4. consultar item especifico via `GET /advertising/{site_id}/product_ads/items/{item_id}`
5. consultar campanha especifica via `GET /marketplace/advertising/{advertiser_site_id}/product_ads/campaigns/{campaign_id}`

Metricas documentadas:

- `prints` (equivale a impressions)
- `clicks`
- `ctr`
- `cost`
- `cpc`
- `cvr`
- `roas`
- `direct_items_quantity`
- `indirect_items_quantity`
- `advertising_items_quantity`
- `direct_amount`
- `indirect_amount`
- `total_amount`
- `impression_share`
- `top_impression_share`
- `lost_impression_share_by_budget`
- `lost_impression_share_by_ad_rank`

Observacao importante de atualidade:

- a documentacao oficial cita endpoints legados de Product Ads como descontinuados em `2026-02-26`;
- portanto, a integracao deve priorizar os endpoints novos com `site_id` no path, e nao a familia legada `/advertising/advertisers/{advertiser_id}/product_ads/...`.

### Brand Ads

Fluxo oficial identificado:

1. consultar advertisers via `GET /advertising/advertisers?product_id=BADS`
2. consultar campanhas via `GET /advertising/advertisers/{advertiser_id}/brand_ads/campaigns`
3. consultar metricas agregadas de campanhas via `GET /advertising/advertisers/{advertiser_id}/brand_ads/campaigns/metrics`
4. consultar metricas de campanha especifica via `GET /advertising/advertisers/{advertiser_id}/brand_ads/campaigns/{campaign_id}/metrics`
5. consultar metricas de keywords via `GET /advertising/advertisers/{advertiser_id}/brand_ads/campaigns/{campaign_id}/keywords/metrics`

Metricas documentadas:

- `prints`
- `clicks`
- `ctr`
- `cvr`
- `consumed_budget`
- `cpc`
- `acos`
- `units_quantity`
- `units_amount`
- `items_quantity`
- `ppv_conversions`
- `bookmark_conversions`
- `cart_conversions`
- `checkout_conversions`
- `leads_question_conversions`
- `leads_im_conversions`

## Associacao com listing_id

### Product Ads

Viabilidade teorica: `parcial a boa`

- ha endpoint oficial de item em Product Ads;
- isso sugere associacao mais direta com `item_id` / `listing_id_ext`;
- ainda assim, a prova real depende de validar se o `item_id` retornado pelos endpoints de Ads coincide com o `listing_id_ext` persistido no projeto.

### Brand Ads

Viabilidade teorica: `baixa para listing`

- Brand Ads e orientado a advertiser, campanha e keyword;
- a associacao direta por `listing_id` nao e o caminho principal da API;
- na pratica, se Brand Ads for acessivel, o armazenamento ideal tende a ser por advertiser/campaign e so mapear para listing quando o payload realmente expuser item relacionado.

## Estado da implementacao

Nenhuma ingestao real foi acoplada ao fluxo do sistema nesta task.

Motivo:

- a regra da task era implementar somente se a investigacao confirmasse viabilidade pratica com o token real;
- a viabilidade documental foi confirmada;
- a viabilidade pratica com o token atual ficou bloqueada pelo ambiente.

Para acelerar a validacao futura, foi adicionado o script:

- `apps/api/src/scripts/investigate-mercado-ads.ts`

E o comando:

- `pnpm --dir apps/api investigate:mercado-ads <tenantId> [listingIdExt]`

Esse probe:

- resolve a conexao ML ativa do tenant;
- obtem `access_token` valido usando o helper existente;
- testa apenas endpoints oficiais de Ads;
- resume `status`, `payload sample` e campos de metricas detectados;
- nao imprime tokens.

## Endpoints testados neste ambiente

### Testes locais executados

1. leitura da configuracao de banco em `apps/api/.env`
2. tentativa de consultar `marketplace_connections` via Prisma
3. tentativa de consultar `listings` Mercado Livre via Prisma

Resultado dos testes locais:

- falha de conectividade com o banco em `localhost:5434`
- erro observado: `Can't reach database server at localhost:5434`

### Consequencia

Sem banco:

- nao foi possivel descobrir `tenant_id` alvo;
- nao foi possivel acessar `marketplace_connections`;
- nao foi possivel obter o `access_token` real;
- nao foi possivel executar probes HTTP autenticados contra Mercado Ads.

## Comandos de validacao executados

```powershell
Get-Content apps/api/.env
```

```powershell
node -e "require('dotenv').config(); const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.marketplaceConnection.findMany().then(console.log)"
```

```powershell
pnpm --dir apps/api investigate:mercado-ads <tenantId> [listingIdExt]
```

Observacao:

- o ultimo comando ja esta pronto no repositorio, mas depende de um `tenantId` real e de acesso ao banco/tunel.

## Conclusao de viabilidade

### Verdade tecnica atual

- `Product Ads`: documentacao oficial indica integracao potencialmente viavel e com metricas aderentes ao projeto.
- `Brand Ads`: documentacao oficial indica integracao viavel no nivel de advertiser/campaign/keyword, mas nao naturalmente por listing.
- `Com token atual deste ambiente`: indisponivel validar, porque o token nao pode ser recuperado sem o banco.

### Classificacao final

`C) integracao indisponivel com token atual`

No contexto estrito desta execucao, a classificacao correta e `C`, porque a task exigia validacao com o token real e isso nao foi tecnicamente possivel aqui.

### Proximo passo objetivo

Assim que o tunel/banco estiver acessivel, executar:

```powershell
pnpm --dir apps/api investigate:mercado-ads <tenantId> <listingIdExt>
```

Se o probe retornar `200` em Product Ads com item ou ad vinculado a `listing_id_ext`, a recomendacao passa a ser:

- classificar como `A) integracao totalmente viavel` para Product Ads por listing;
- implementar ingestao diaria dedicada em `listing_ads_metrics_daily`;
- manter Brand Ads como extensao opcional por advertiser/campaign.
