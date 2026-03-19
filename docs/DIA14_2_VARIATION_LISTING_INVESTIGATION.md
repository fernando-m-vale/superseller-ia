# DIA 14.2 - Investigacao do modelo de anuncio por variacao / preco individual

## Escopo

Este documento cobre duas camadas:

1. O que o repositorio `SuperSeller IA` hoje assume sobre identidade de anuncio no Mercado Livre.
2. O que parece estar mudando no modelo de anuncios por variacao / preco individual, com base:
   - no comportamento observado em validacao real;
   - na modelagem atual do codigo;
   - na documentacao oficial do Mercado Livre sobre `price per variation` e `user products`.

Quando algo abaixo for inferencia e nao fato confirmado pelo repositorio, isso estara marcado como `Hipotese`.

## Fontes consultadas

- Codigo local do monorepo:
  - `apps/api/src/services/MercadoLivreSyncService.ts`
  - `apps/api/src/services/MercadoLivreVisitsService.ts`
  - `apps/api/src/services/MercadoLivreOrdersService.ts`
  - `apps/api/src/services/MarketplaceAdsIntelligenceService.ts`
  - `apps/api/prisma/schema.prisma`
- Documentacao oficial do Mercado Livre:
  - [Price per variation](https://developers.mercadolivre.com.br/en_us/api-docs/price-per-variation)
  - [Preco por variacao](https://developers.mercadolivre.com.br/pt_br/preco-variacao)
  - [Items and searches](https://developers.mercadolivre.com.br/en_us/api-docs/items-and-searches)
  - [User products](https://developers.mercadolivre.com.br/en_us/authentication-and-authorization/user-products)

## Resumo executivo

O sistema hoje opera com a premissa estrutural de que `1 item_id do ML = 1 listing interno = 1 identidade para sync, visitas, pedidos e ads`.

Essa premissa fica fragil quando o Mercado Livre passa a:

- permitir preco por variacao de forma mais forte;
- expor familias / `user_product_id` / `family_name`;
- materializar anuncios derivados ou identidades associadas por variacao.

Minha recomendacao executiva e:

- nao fazer uma migracao estrutural completa agora no fechamento do Dia 14.1;
- implementar primeiro um suporte parcial seguro de observabilidade e mapeamento;
- adiar a normalizacao estrutural completa para uma etapa seguinte, depois de teste manual guiado em contas reais.

## Como o modelo parece funcionar

### Fatos confirmados pela documentacao

- O Mercado Livre tem documentacao especifica para `price per variation`.
- A plataforma tambem documenta `user products`, com campos como `user_product_id` e `family_name`.
- Isso indica que, para alguns fluxos, o item comercial visivel ao seller nao necessariamente coincide com uma unica identidade simples e estavel de `item.id` ao longo de toda a jornada.

### Hipotese operacional principal

Hipotese: em alguns anuncios, o item "original" passa a funcionar mais como contenedor comercial ou raiz logica, enquanto variacoes especificas podem ganhar identidade operacional propria para preco, exposicao, metrificacao ou associacao comercial.

Se essa hipotese estiver correta, podem coexistir:

- um nivel "pai/original" de agrupamento;
- um nivel derivado/associado por variacao;
- um nivel de preco por variacao;
- possivel redistribuicao de visitas, pedidos ou ads entre identidades relacionadas.

### Diferenca pratica entre "pai/original" e "derivado/associado"

Hipotese:

- `pai/original`: identidade que agrupa o produto ou familia comercial.
- `derivado/associado`: identidade usada para uma variacao especifica, possivelmente com preco proprio, atributos fechados e alguma metrificacao separada.

Ainda nao ha confirmacao no nosso repositorio de qual endpoint devolve essa relacao de modo consistente. O codigo atual tambem nao captura nenhum campo de parentesco desse tipo.

## Impacto esperado por dominio

### Item id

Hoje assumimos que o `item.id` retornado no sync e a identidade principal e suficiente.

Se o novo modelo estiver ativo, o risco e:

- o item sincronizado nao ser a unica identidade relevante;
- metrics, orders e ads aparecerem em ids relacionados mas nao iguais;
- historico ficar fragmentado.

### Variacoes

Hoje variacoes ficam em `variations_json`, sem tabela propria nem chave relacional.

Consequencia:

- o sistema preserva o payload bruto, mas nao o interpreta como entidade de negocio;
- nao existe forma segura de ligar uma variacao a metricas, pedidos ou ads.

### Precos

Com `price per variation`, o preco deixa de ser uma unica verdade simples do listing.

Consequencia:

- leitura agregada de competitividade pode ficar errada;
- benchmark pode comparar o preco errado;
- recomendacao comercial pode apontar ajuste no "anuncio" quando o desvio real esta em uma variacao.

### Metricas, visits e orders

Se visitas e pedidos forem contabilizados no id derivado ou na combinacao item + variacao:

- o `listing_id_ext` atual deixa de ser suficiente para agregacao completa;
- parte do funil fica invisivel;
- causa raiz pode ser atribuida ao anuncio errado.

### Ads

Se Product Ads ou Ads Intelligence passarem a responder por item derivado:

- o match por `listing.listing_id_ext` falha;
- ROAS e trafego pago ficam subatribuídos;
- analise mistura "anuncio sem retorno" com "anuncio principal sem o id certo".

## Onde o codigo atual falha ou fica cego

### 1. Banco e modelagem

Confirmado em `apps/api/prisma/schema.prisma`:

- `Listing` usa `listing_id_ext` como identidade externa principal;
- existe unicidade por `(tenant_id, marketplace, listing_id_ext)`;
- nao existe tabela normalizada de variacao;
- nao existem campos como `parent_item_id`, `user_product_id`, `family_name` ou equivalente.

Risco:

- toda a cadeia de inteligencia depende de uma unica identidade externa.

### 2. Sync de listings

Confirmado em `MercadoLivreSyncService`:

- `fetchUserItemIds()` usa `/sites/MLB/search?seller_id=...`;
- `fetchItemsDetails()` consulta `/items?ids=...`;
- `upsertListings()` persiste por `item.id`.

Risco:

- se o search nao devolver todas as identidades operacionais relacionadas, o sync fica incompleto;
- se devolver ids derivados sem relacao com o pai, o historico fica quebrado.

### 3. Orders

Confirmado em `MercadoLivreOrdersService`:

- o vinculo de pedido para listing usa `order_items[].item.id`;
- a associacao local depende de `listing_id_ext`.

Risco:

- pedido pode cair em item derivado que ainda nao existe internamente;
- pedido pode ficar sem match ou criar duplicidade logica de anuncio.

### 4. Visits

Confirmado em `MercadoLivreVisitsService`:

- visitas sao buscadas por `itemId`.

Risco:

- trafego pode estar sendo contado em ids filhos/associados nao sincronizados.

### 5. Ads / Product Ads

Confirmado em `MarketplaceAdsIntelligenceService`:

- a inteligencia usa `listing.listing_id_ext` como chave de lookup.

Risco:

- atribuicao paga pode estar incompleta quando o id atendido pela API de ads nao for o mesmo listing principal salvo hoje.

### 6. Analise e benchmark

Toda a analise atual parte de uma identidade principal unica.

Risco:

- score, benchmark e root cause podem analisar dados misturados ou faltantes;
- UI mostra uma verdade aparentemente coerente, mas baseada em item errado.

## O que seria necessario implementar

### Mudancas minimas

- Persistir metadados de familia/relacao quando encontrados nos payloads do ML.
- Logar divergencias entre:
  - id sincronizado;
  - id de pedido;
  - id de visitas;
  - id de ads.
- Criar camada de reconciliacao por aliases externos relacionados ao mesmo listing interno.

### Mudancas ideais

- Normalizar variacoes em tabela propria.
- Modelar relacao entre:
  - listing principal;
  - item externo observado;
  - variacao externa;
  - familia / user product.
- Agregar funil por "grupo comercial" e nao apenas por `listing_id_ext`.

### Impactos por area

- Banco: novas tabelas ou colunas para ids relacionados e variacoes.
- Sync: descoberta e reconciliacao de ids filhos/associados.
- Enrichments: ads, visitas, pedidos e benchmark precisam ler o grupo consolidado.
- Analise: root cause e score precisam trabalhar com identidade agregada e confianca por fonte.
- UI: exibir quando a analise esta consolidada por familia/variacao, sem confundir o seller.

## Opcoes de implementacao

### Opcao A - Workaround leve de curto prazo

Escopo:

- manter schema principal;
- adicionar logs e observabilidade de ids divergentes;
- capturar e armazenar campos brutos novos do ML em JSON auxiliar;
- nao mudar atribuicao principal ainda.

Riscos:

- continua sem corrigir historico nem agregacao;
- apenas torna o problema visivel.

Custo relativo:

- baixo.

Recomendacao:

- util apenas se precisarmos confirmar o comportamento em producao antes de investir.

### Opcao B - Suporte parcial seguro

Escopo:

- introduzir tabela ou coluna de `related_item_ids`;
- reconciliar pedidos, visitas e ads por conjunto de ids relacionados;
- manter `listing_id_ext` como ancora principal por compatibilidade;
- nao remodelar toda variacao no banco ainda.

Riscos:

- aumenta complexidade de sync;
- parte da verdade ainda fica sem normalizacao de variacao;
- exige heuristicas de merge entre ids.

Custo relativo:

- medio.

Recomendacao:

- melhor equilibrio para a proxima etapa, se os testes manuais confirmarem o novo modelo.

### Opcao C - Suporte estrutural correto

Escopo:

- remodelar `Listing` para trabalhar com entidade comercial agregada;
- criar entidades normalizadas para item externo, variacao externa e familia/user product;
- recalcular pipeline de sync, historico, analise, benchmark e UI em cima dessa nova camada.

Riscos:

- custo alto;
- migracao delicada;
- maior superficie de regressao.

Custo relativo:

- alto.

Recomendacao:

- correta no longo prazo, mas nao e a opcao segura para encaixar agora sem antes validar o comportamento real em dados de sellers.

## Recomendacao executiva

### Vale implementar agora ou adiar?

Implementacao estrutural completa: adiar.

Implementacao parcial de seguranca e observabilidade: vale priorizar na sequencia imediata, se o problema ja estiver afetando atribuicao real de pedidos, visitas ou ads.

### Ordem segura de implementacao

1. Confirmar em testes manuais quais endpoints mostram ids diferentes para o mesmo conjunto comercial.
2. Instrumentar o backend para detectar divergencia entre ids de sync, orders, visits e ads.
3. Implementar reconciliacao parcial por ids relacionados.
4. So depois decidir se vale migrar para modelo estrutural completo.

## Endpoints, campos e contratos que merecem teste manual

### Endpoints

- `/sites/MLB/search?seller_id=...`
- `/items/{id}`
- `/items?ids=...`
- `/items/{id}/prices`
- endpoint de visitas por item usado hoje no backend
- endpoints de orders usados hoje no backend
- `/advertising/{siteId}/advertisers/{advertiserId}/product_ads/ads/search`
- `/advertising/{siteId}/product_ads/items/{listingIdExt}`

### Campos para inspecionar

- `id`
- `variations`
- `price`
- payloads de preco por variacao
- `user_product_id`
- `family_name`
- qualquer campo de parent/child item ou item associado
- item ids vindos em orders
- item ids vindos em ads

## Conclusao

O codigo atual esta correto apenas enquanto o Mercado Livre se comporta como `um anuncio = um item id principal`.

Os sinais reunidos aqui apontam que esse pressuposto pode estar deixando de ser seguro em cenarios com variacao e preco individual. O impacto potencial e alto porque atravessa sync, historico, visits, orders, ads, benchmark e causa raiz.

Minha recomendacao e seguir com a Action Layer agora, mas tratar o suporte ao novo modelo de anuncio como uma frente propria de plataforma:

- primeiro observabilidade e reconciliacao parcial;
- depois decisao informada sobre migracao estrutural.
