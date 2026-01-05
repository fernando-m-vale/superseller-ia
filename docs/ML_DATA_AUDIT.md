# Inventário Completo do Pipeline de Dados do Mercado Livre

**Data de Auditoria:** 2026-01-05  
**Repositório:** fernando-m-vale/superseller-ia

---

## 1. Endpoints do Mercado Livre Chamados

| Endpoint | Método | Auth | Arquivo::Função | Descrição |
|----------|--------|------|-----------------|-----------|
| `https://auth.mercadolivre.com.br/authorization` | GET | Público | `routes/mercadolivre.ts::connect` | Início do fluxo OAuth (gera URL de autorização) |
| `/oauth/token` | POST | Client Credentials | `routes/mercadolivre.ts::callback`, `services/MercadoLivreSyncService.ts::refreshAccessToken`, `services/MercadoLivreOrdersService.ts::refreshAccessToken`, `services/TokenRefreshService.ts::refreshToken` | Troca de código por token (authorization_code) e refresh de token (refresh_token) |
| `/users/me` | GET | Bearer | `routes/mercadolivre.ts::health` | Busca informações do usuário (nickname, site_id, country_id, tags) |
| `/sites/MLB/search` | GET | Público | `services/MercadoLivreSyncService.ts::fetchUserItemIds` | Busca IDs de todos os anúncios do seller (seller_id, offset, limit) |
| `/items` | GET | Bearer | `services/MercadoLivreSyncService.ts::fetchItemsDetails` | Busca detalhes de múltiplos itens em lote (até 20 por vez, ids param) |
| `/items/{itemId}` | GET | Bearer | `services/MercadoLivreSyncService.ts::syncListingMetricsDaily`, `routes/debug.routes.ts::mercadolivre/item/:itemIdExt` | Busca detalhes de um item específico (usado em sync de métricas e debug) |
| `/items/{itemId}/description` | GET | Bearer | `services/MercadoLivreSyncService.ts::fetchItemDescription` | Busca descrição completa do anúncio (plain_text) |
| `/orders/search` | GET | Bearer | `services/MercadoLivreOrdersService.ts::fetchOrders`, `services/MercadoLivreSyncService.ts::syncListingMetricsDaily` | Busca pedidos por seller e período (seller, order.date_created.from, sort, offset, limit) |
| `/orders/{orderId}` | GET | Bearer | `services/MercadoLivreOrdersService.ts::fetchOrderDetails` | Busca detalhes de um pedido específico (para webhooks) |

---

## 2. Campos da API do ML Utilizados

### 2.1 Endpoint `/items` e `/items/{itemId}`

| Campo ML API | Usado? | Transformação | Persistência (tabela.coluna) | Observações |
|--------------|--------|---------------|------------------------------|-------------|
| `id` | Sim | Direto | `listings.listing_id_ext` | Identificador único do anúncio |
| `title` | Sim | Direto | `listings.title` | Sempre atualizado |
| `price` | Sim | Direto | `listings.price` | Sempre atualizado |
| `available_quantity` | Sim | Direto | `listings.stock` | Sempre atualizado |
| `status` | Sim | `mapMLStatusToListingStatus()` | `listings.status` | active→active, paused→paused, outros→deleted |
| `category_id` | Sim | Direto | `listings.category` | Atualizado apenas se presente |
| `thumbnail` | Sim | Fallback para `pictures[0].url` | `listings.thumbnail_url` | Condicional: não sobrescreve com vazio |
| `pictures[]` | Sim | `pictures.length` | `listings.pictures_count` | Condicional: não sobrescreve com vazio |
| `video_id` | Sim | `extractHasVideoFromMlItem()` | `listings.has_video` | String não vazia → true |
| `videos[]` | Sim | `extractHasVideoFromMlItem()` | `listings.has_video` | Array não vazio → true |
| `health` | Sim | `* 100` | `listings.health_score` | Score legado 0.0-1.0 → 0-100 |
| `quality_grade` | Sim | Mapeamento | `listings.health_score` | good→90, regular→70, bad→40 |
| `visits` | Sim | Direto | `listings.visits_last_7d`, `listing_metrics_daily.visits` | **GAP**: Pode ser lifetime, não período |
| `sold_quantity` | Sim | Direto | `listings.sales_last_7d` | **GAP**: Lifetime, não período |
| `shipping.free_shipping` | Sim | Cálculo de score | `listings.health_score` | +5 pontos no health_score |
| `permalink` | Não | - | - | Tipado mas não persistido |
| `listing_type_id` | Não | - | - | Tipado mas não persistido |
| `attributes[]` | Parcial | Verificação de vídeo | - | Usado apenas para detecção de vídeo |
| `tags[]` | Parcial | Verificação de vídeo | - | Usado apenas para detecção de vídeo |

### 2.2 Endpoint `/items/{itemId}/description`

| Campo ML API | Usado? | Transformação | Persistência (tabela.coluna) | Observações |
|--------------|--------|---------------|------------------------------|-------------|
| `plain_text` | Sim | `trim()` | `listings.description` | Condicional: não sobrescreve com vazio |
| `text` | Não | - | - | HTML, não utilizado |
| `last_updated` | Não | - | - | Não persistido |

### 2.3 Endpoint `/orders/search` e `/orders/{orderId}`

| Campo ML API | Usado? | Transformação | Persistência (tabela.coluna) | Observações |
|--------------|--------|---------------|------------------------------|-------------|
| `id` | Sim | `String()` | `orders.order_id_ext` | Identificador único do pedido |
| `status` | Sim | `mapMLStatusToOrderStatus()` | `orders.status` | confirmed→pending, paid→paid, etc. |
| `date_created` | Sim | `new Date()` | `orders.order_date` | Data de criação do pedido |
| `date_closed` | Não | - | - | Tipado mas não persistido |
| `total_amount` | Sim | Direto | `orders.total_amount` | Valor total do pedido |
| `currency_id` | Sim | Direto | `orders.currency` | Default: BRL |
| `buyer.id` | Sim | `String()` | `orders.buyer_id_ext` | ID do comprador |
| `buyer.nickname` | Sim | Direto | `orders.buyer_nickname` | Nickname do comprador |
| `order_items[].item.id` | Sim | Direto | `order_items.listing_id_ext` | ID do anúncio vendido |
| `order_items[].item.title` | Sim | Direto | `order_items.title` | Título do item vendido |
| `order_items[].quantity` | Sim | Direto | `order_items.quantity` | Quantidade vendida |
| `order_items[].unit_price` | Sim | Direto | `order_items.unit_price` | Preço unitário |
| `payments[].status` | Sim | Filtro | - | Usado para filtrar pedidos pagos (approved) |
| `payments[].date_approved` | Sim | `new Date()` | `orders.paid_date` | Data de aprovação do pagamento |
| `shipping.id` | Não | - | - | Tipado mas não persistido |
| `shipping.status` | Não | - | - | Tipado mas não persistido |

### 2.4 Endpoint `/users/me`

| Campo ML API | Usado? | Transformação | Persistência (tabela.coluna) | Observações |
|--------------|--------|---------------|------------------------------|-------------|
| `nickname` | Sim | Direto | - | Retornado na resposta de health check |
| `site_id` | Sim | Direto | - | Retornado na resposta de health check |
| `country_id` | Sim | Direto | - | Retornado na resposta de health check |
| `tags` | Sim | Direto | - | Retornado na resposta de health check |

---

## 3. Mapeamento para Tabelas/Colunas do Banco

### 3.1 Tabela `listings`

| Coluna | Tipo | Fonte ML | Transformação | Regra de Atualização |
|--------|------|----------|---------------|----------------------|
| `listing_id_ext` | String | `item.id` | Direto | Sempre |
| `title` | String | `item.title` | Direto | Sempre |
| `description` | String? | `/items/{id}/description → plain_text` | `trim()` | Condicional: só se não vazio |
| `price` | Decimal | `item.price` | Direto | Sempre |
| `stock` | Int | `item.available_quantity` | Direto | Sempre |
| `status` | ListingStatus | `item.status` | `mapMLStatusToListingStatus()` | Sempre |
| `category` | String? | `item.category_id` | Direto | Condicional: só se presente |
| `health_score` | Float? | `item.health` ou `item.quality_grade` | Calculado | Sempre |
| `super_seller_score` | Int? | Calculado internamente | `ScoreCalculator.calculate()` | Sempre |
| `score_breakdown` | Json? | Calculado internamente | `ScoreCalculator.calculate()` | Sempre |
| `thumbnail_url` | String? | `item.thumbnail` ou `item.pictures[0].url` | Fallback | Condicional: só se presente |
| `pictures_count` | Int? | `item.pictures.length` | Contagem | Condicional: só se array válido |
| `has_video` | Boolean? | `item.video_id`, `item.videos[]` | `extractHasVideoFromMlItem()` | Sempre (true/false) |
| `has_clips` | Boolean? | **NÃO DETECTÁVEL VIA API** | - | Sempre NULL |
| `visits_last_7d` | Int? | `item.visits` ou agregado de `listing_metrics_daily` | Direto ou soma | Condicional |
| `sales_last_7d` | Int? | `item.sold_quantity` ou agregado de `listing_metrics_daily` | Direto ou soma | Condicional |

### 3.2 Tabela `orders`

| Coluna | Tipo | Fonte ML | Transformação | Regra de Atualização |
|--------|------|----------|---------------|----------------------|
| `order_id_ext` | String | `order.id` | `String()` | Sempre |
| `status` | OrderStatus | `order.status` | `mapMLStatusToOrderStatus()` | Sempre |
| `total_amount` | Decimal | `order.total_amount` | Direto | Sempre |
| `currency` | String | `order.currency_id` | Direto (default: BRL) | Sempre |
| `buyer_nickname` | String? | `order.buyer.nickname` | Direto | Sempre |
| `buyer_id_ext` | String? | `order.buyer.id` | `String()` | Sempre |
| `order_date` | DateTime | `order.date_created` | `new Date()` | Sempre |
| `paid_date` | DateTime? | `order.payments[].date_approved` | `new Date()` | Condicional: só se approved |

### 3.3 Tabela `order_items`

| Coluna | Tipo | Fonte ML | Transformação | Regra de Atualização |
|--------|------|----------|---------------|----------------------|
| `listing_id_ext` | String | `order_item.item.id` | Direto | Sempre |
| `title` | String | `order_item.item.title` | Direto | Sempre |
| `quantity` | Int | `order_item.quantity` | Direto | Sempre |
| `unit_price` | Decimal | `order_item.unit_price` | Direto | Sempre |
| `total_price` | Decimal | Calculado | `quantity * unit_price` | Sempre |

### 3.4 Tabela `listing_metrics_daily`

| Coluna | Tipo | Fonte ML | Transformação | Regra de Atualização |
|--------|------|----------|---------------|----------------------|
| `visits` | Int? | `item.visits` | Direto | **GAP**: Pode ser lifetime |
| `orders` | Int | Agregado de `/orders/search` | Soma de `order_item.quantity` | Sempre |
| `gmv` | Decimal | Agregado de `/orders/search` | Soma de `quantity * unit_price` | Sempre |
| `impressions` | Int | **APROXIMADO** | `visits * 10` | **GAP**: Não é dado real |
| `clicks` | Int | **APROXIMADO** | `visits` | **GAP**: Não é dado real |
| `ctr` | Decimal | **APROXIMADO** | `clicks / impressions` | **GAP**: Não é dado real |
| `conversion` | Decimal? | Calculado | `orders / visits` | NULL se visits NULL |
| `source` | String? | Interno | `ml_orders_period`, `ml_items_aggregate`, `unknown` | Sempre |
| `period_days` | Int? | Interno | Período agregado (ex: 30) | Sempre |

---

## 4. Análise de Gaps

### 4.1 `has_video`

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Fonte de Dados** | `item.video_id`, `item.videos[]` | Extraído via `extractHasVideoFromMlItem()` |
| **Cobertura** | ⚠️ Parcial | Detecta vídeos tradicionais, mas **NÃO detecta Clips** |
| **Problema Conhecido** | Documentado em `PROJECT_CONTEXT.md` | Sellers reportam vídeos na UI do ML que não aparecem na API |
| **Causa Provável** | Clips vs Vídeos | Clips são um tipo diferente de mídia não exposto via Items API |
| **Impacto** | Score de Mídia penaliza incorretamente | IA pode sugerir "adicionar vídeo" quando já existe |
| **Recomendação** | Separar `has_video` (detectável) de `has_clips` (não detectável) | Campo `has_clips` já existe mas sempre NULL |

### 4.2 `pictures_count`

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Fonte de Dados** | `item.pictures.length` | Contagem direta do array |
| **Cobertura** | ✅ OK | Confiável quando API retorna o array |
| **Regra de Proteção** | Não sobrescreve com 0 | Se API não retornar `pictures`, mantém valor existente |
| **Impacto** | Baixo | Dados geralmente confiáveis |
| **Recomendação** | Manter monitoramento | Verificar se há casos de `pictures` undefined |

### 4.3 `visits`

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Fonte de Dados** | `item.visits` via `/items/{id}` | Campo opcional no payload |
| **Cobertura** | ❌ Crítico | API **NÃO retorna visits** via Items API |
| **Problema Atual** | `visits = NULL` para todos os anúncios | Documentado em `PROJECT_CONTEXT.md` |
| **Semântica** | Ambígua | Quando presente, pode ser **lifetime** (não período) |
| **Impacto** | Alto | Afeta cálculo de CVR, CTR, Score de Performance |
| **Recomendação** | Integrar com **Visits API** (`/visits/items/{id}`) | Endpoint específico para métricas de visitas |

### 4.4 `orders` / `GMV 30d`

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Fonte de Dados** | `/orders/search` com filtro de data | Pedidos pagos do período |
| **Cobertura** | ✅ OK | Dados confiáveis via Orders API |
| **Cálculo** | Soma de `order_item.quantity` | **Atenção**: É unidades vendidas, não contagem de pedidos |
| **GMV** | Soma de `quantity * unit_price` | Correto |
| **Impacto** | Baixo | Dados batem com painel do ML |
| **Recomendação** | Clarificar semântica: "orders" = unidades ou pedidos? | Atualmente é unidades |

### 4.5 `CTR` / `impressions` / `clicks`

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Fonte de Dados** | **APROXIMADO** | Não vem da API do ML |
| **Cálculo Atual** | `impressions = visits * 10`, `clicks = visits`, `ctr = clicks / impressions` | Fórmula arbitrária |
| **Cobertura** | ❌ Crítico | **Não são dados reais** |
| **Problema** | Quando `visits = NULL`, tudo zera | Falso CTR zero distorce análises |
| **Impacto** | Alto | Score de SEO e análises de tráfego incorretas |
| **Recomendação** | Integrar com **Visits API** ou **Ads API** | Endpoints específicos para métricas de tráfego |

---

## 5. Gaps Adicionais Identificados

### 5.1 Webhooks Não Processados

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Route Atual** | `routes/mercado-livre-webhook.ts` | Apenas loga e retorna 200 |
| **Processor** | `services/mercado-livre-webhook-processor.ts` | Existe mas **não está conectado** |
| **Impacto** | Pipeline quase-real-time não funciona | Orders/Items não são atualizados via webhook |
| **Recomendação** | Conectar processor ao route | Habilitar processamento de eventos |

### 5.2 Métricas Diárias Não São Realmente Diárias

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Estrutura Atual** | 1 linha por período (30d) | Não é série temporal real |
| **Campo `date`** | Data atual do sync | Não representa dia específico |
| **Impacto** | Dashboards de tendência incorretos | Não dá para plotar evolução diária |
| **Recomendação** | Implementar sync diário real | Ou usar Visits API com granularidade diária |

### 5.3 Inconsistência de Credenciais

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **MercadoLivreSyncService** | `getMercadoLivreCredentials()` | Via secrets manager |
| **MercadoLivreOrdersService** | `process.env.ML_CLIENT_ID/SECRET` | Direto de env vars |
| **Impacto** | Pode falhar em prod se só um caminho configurado | Risco operacional |
| **Recomendação** | Padronizar para `getMercadoLivreCredentials()` | Em todos os services |

---

## 6. Resumo de Cobertura por Campo Solicitado

| Campo | Status | Fonte | Confiabilidade | Ação Recomendada |
|-------|--------|-------|----------------|------------------|
| `has_video` | ⚠️ Parcial | Items API | Não detecta Clips | Documentar limitação, separar vídeo de clips |
| `pictures_count` | ✅ OK | Items API | Alta | Manter monitoramento |
| `visits` | ❌ Gap | Items API | **Não disponível** | Integrar Visits API |
| `orders/GMV 30d` | ✅ OK | Orders API | Alta | Clarificar semântica (unidades vs pedidos) |
| `CTR/impressions/clicks` | ❌ Gap | **Aproximado** | **Não confiável** | Integrar Visits API ou Ads API |

---

## 7. Endpoints ML Não Utilizados (Oportunidades)

| Endpoint | Descrição | Dados Disponíveis | Prioridade |
|----------|-----------|-------------------|------------|
| `/visits/items/{id}` | Visits API | Visitas por período (7d, 30d, etc.) | **Alta** |
| `/items/{id}/visits/time_window` | Visits por janela | Série temporal de visitas | Alta |
| `/advertising/campaigns` | Ads API | Impressions, clicks, CTR reais | Média |
| `/questions/search` | Questions API | Perguntas de compradores | Baixa |
| `/reviews/item/{id}` | Reviews API | Avaliações do produto | Baixa |

---

## 8. Referências

- `docs/ML_SYNC_FIELDS.md` - Mapeamento de campos original
- `docs/PROJECT_CONTEXT.md` - Contexto do projeto e gaps conhecidos
- `apps/api/src/services/MercadoLivreSyncService.ts` - Service principal de sync
- `apps/api/src/services/MercadoLivreOrdersService.ts` - Service de orders
- `apps/api/src/utils/ml-video-extractor.ts` - Extração de vídeo
- [Mercado Livre Developers - Visits API](https://developers.mercadolivre.com.br/pt_br/recurso-visits)
