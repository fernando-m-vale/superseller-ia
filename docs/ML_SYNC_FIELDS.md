# Mapeamento de Campos - Mercado Livre Sync

Este documento descreve o mapeamento de campos da API do Mercado Livre para o modelo `Listing` no banco de dados.

## Endpoints Utilizados

### 1. `/sites/MLB/search` (Público)
- **Uso**: Buscar IDs de todos os anúncios do seller
- **Parâmetros**: `seller_id`, `offset`, `limit`
- **Retorno**: Array de objetos com `id` do anúncio

### 2. `/items` (Autenticado)
- **Uso**: Buscar detalhes de múltiplos itens (até 20 por vez)
- **Headers**: `Authorization: Bearer {access_token}`
- **Parâmetros**: `ids` (comma-separated)
- **Retorno**: Array de objetos `{ code, body }` onde `body` contém os dados do item

### 3. `/items/{itemId}/description` (Autenticado)
- **Uso**: Buscar descrição completa do anúncio
- **Headers**: `Authorization: Bearer {access_token}`
- **Retorno**: `{ plain_text: "...", text: "...", last_updated: "..." }`

### 4. `/items/{itemId}` (Autenticado)
- **Uso**: Buscar detalhes de um item específico (usado em sync de métricas)
- **Headers**: `Authorization: Bearer {access_token}`
- **Retorno**: Objeto completo do item

## Mapeamento de Campos

### Campos Sempre Atualizados

| Campo ML API | Campo DB | Tipo | Observações |
|--------------|----------|------|-------------|
| `item.title` | `listings.title` | String | Sempre atualizado |
| `item.price` | `listings.price` | Decimal | Sempre atualizado |
| `item.available_quantity` | `listings.stock` | Int | Sempre atualizado |
| `item.status` | `listings.status` | ListingStatus | Mapeado via `mapMLStatusToListingStatus()` |
| `item.category_id` | `listings.category` | String? | Atualizado apenas se presente na API |
| Calculado | `listings.health_score` | Float? | Score legado da API ML (0-100) |
| Calculado | `listings.super_seller_score` | Int? | Super Seller Score proprietário (0-100) |
| Calculado | `listings.score_breakdown` | Json? | Detalhamento do score |

### Campos Condicionais (Não Sobrescrevem com Vazios)

Estes campos **NÃO são atualizados** se a API não retornar valores válidos, preservando dados existentes:

| Campo ML API | Campo DB | Tipo | Lógica de Atualização |
|--------------|----------|------|------------------------|
| `item.descriptions[0].plain_text` (via `/items/{id}/description`) | `listings.description` | String? | Atualizado apenas se string não vazia (`trim().length > 0`) |
| `item.pictures.length` | `listings.pictures_count` | Int? | Atualizado apenas se número válido (`>= 0`) |
| `item.thumbnail` OU `item.pictures[0].url` | `listings.thumbnail_url` | String? | Atualizado apenas se URL presente |
| `item.video_id` OU `item.videos[]` | `listings.has_video` | Boolean? | Atualizado apenas se `video_id` presente (string não vazia) ou `videos` array não vazio (true), ou explicitamente null/empty (false). Se `undefined`, não atualiza campo existente. |
| `item.visits` | `listings.visits_last_7d` | Int? | Atualizado apenas se número válido (`>= 0`) |
| `item.sold_quantity` | `listings.sales_last_7d` | Int? | Atualizado apenas se número válido (`>= 0`) |

### Regras de Proteção

1. **Descrição**: 
   - Se API retornar string vazia ou `null`, **não atualiza** campo existente
   - Se é criação (`!existing`), seta `null` se não houver descrição

2. **Pictures Count**:
   - Se API não retornar `pictures` array ou for `undefined`, **não atualiza** campo existente
   - Se é criação, seta `0` se não houver pictures

3. **Thumbnail URL**:
   - Se API não retornar `thumbnail` nem `pictures[0].url`, **não atualiza** campo existente
   - Se é criação, seta `null` se não houver thumbnail

4. **Has Video**:
   - Detecção robusta: verifica `item.video_id` (string não vazia) OU `item.videos` (array não vazio)
   - Se `video_id` for `null` ou string vazia, seta `false`
   - Se `video_id` for `undefined`, **não atualiza** campo existente (mantém valor anterior)
   - Se é criação e não conseguir determinar, seta `false`

5. **Visits/Sales Last 7d**:
   - Se API retornar `undefined`, `null` ou valor negativo, **não atualiza** campo existente
   - Isso evita sobrescrever com `0` quando não há dados da API
   - Se é criação, seta `0` se não houver dados

## Logs Seguros

Todos os logs do sync **NUNCA** incluem:
- Tokens de acesso (`access_token`, `refresh_token`)
- Headers `Authorization` ou `Bearer`
- Credenciais ou dados sensíveis

Exemplo de log seguro:
```json
{
  "tenantId": "tenant-123",
  "listingIdExt": "MLB123456789",
  "picturesCount": 5,
  "hasVideo": true,
  "hasDescription": true,
  "descriptionLength": 250,
  "thumbnailProvided": true
}
```

## Endpoints de Sync

### POST `/api/v1/sync/mercadolivre`
- **Descrição**: Sync completo de listings (busca todos os anúncios do seller)
- **Autenticação**: Requerida (JWT)
- **Retorno**: `{ itemsProcessed, itemsCreated, itemsUpdated, duration }`

### POST `/api/v1/sync/mercadolivre/listings`
- **Descrição**: Re-sync de listings específicos (atualiza campos de cadastro)
- **Query Params**: `limit` (default: 50, max: 200)
- **Autenticação**: Requerida (JWT)
- **Retorno**: `{ listingsProcessed, listingsUpdated, errorsCount }`
- **Uso**: Útil para corrigir listings que foram criados sem dados de mídia/descrição

### POST `/api/v1/sync/mercadolivre/metrics`
- **Descrição**: Sync de métricas diárias (últimos N dias)
- **Query Params**: `days` (default: 30, max: 90)
- **Autenticação**: Requerida (JWT)
- **Retorno**: `{ listingsProcessed, metricsCreated, duration }`

## Fluxo de Sincronização

1. **Buscar IDs**: `/sites/MLB/search` (público, sem auth)
2. **Buscar Detalhes**: `/items?ids=...` (autenticado, lotes de 20)
3. **Buscar Descrições**: `/items/{id}/description` (autenticado, paralelo)
4. **Upsert no DB**: Aplicar regras de proteção (não sobrescrever com vazios)
5. **Calcular Scores**: Super Seller Score baseado em dados atualizados
6. **Logs Seguros**: Registrar apenas dados não sensíveis

## Notas Importantes

- **Não inventar dados**: Se ML não retornar foto/vídeo/descrição, não assumir ausência
- **Preservar dados existentes**: Em updates, manter valores anteriores se API não retornar
- **Data Quality**: Campos ausentes são sinalizados em `dataQuality.missing` para a IA
- **Performance**: Sync processa em lotes de 20 itens para evitar rate limits

