# AI Analyze Payload V1

## Visão Geral

O Payload V1 é a estrutura canônica de dados enviada para a IA (OpenAI GPT-4o) para análise de anúncios. Ele foi criado para resolver problemas de inferências incorretas da IA, que acusava ausência de fotos/descrição/vendas mesmo quando esses dados existiam no banco.

## Estrutura do Payload

### AIAnalyzeInputV1

```typescript
interface AIAnalyzeInputV1 {
  meta: AIAnalyzeInputMeta;
  listing: AIAnalyzeInputListing;
  media: AIAnalyzeInputMedia;
  performance: AIAnalyzeInputPerformance;
  dataQuality: AIAnalyzeInputDataQuality;
}
```

### Componentes

#### 1. Meta (`AIAnalyzeInputMeta`)
Metadados da requisição de análise:
- `requestId?`: ID único da requisição (opcional)
- `tenantId`: ID do tenant
- `userId?`: ID do usuário que solicitou (opcional)
- `marketplace`: Marketplace do anúncio (mercadolivre, shopee, etc.)
- `listingId`: ID interno do anúncio
- `externalId?`: ID externo do anúncio no marketplace (opcional)
- `analyzedAt`: Timestamp ISO da análise
- `periodDays`: Período em dias usado para agregação (padrão: 30)

#### 2. Listing (`AIAnalyzeInputListing`)
Dados básicos do anúncio:
- `title`: Título do anúncio
- `description`: Descrição (garantida como string, nunca null)
- `category?`: Categoria (opcional)
- `price`: Preço em número
- `currency`: Sempre 'BRL'
- `stock`: Quantidade em estoque
- `status`: Status do anúncio (active, paused, deleted)
- `createdAt`: Data de criação (ISO)
- `updatedAt`: Data de atualização (ISO)

#### 3. Media (`AIAnalyzeInputMedia`)
Informações de mídia:
- `imageCount`: Número de fotos
- `hasImages`: Boolean indicando se há imagens (considera `pictures_count > 0` OU `thumbnail_url != null`)
- `hasVideo`: Boolean indicando se há vídeo
- `videoCount`: Número de vídeos (0 ou 1)

#### 4. Performance (`AIAnalyzeInputPerformance`)
Métricas agregadas do período:
- `periodDays`: Período em dias
- `visits`: Total de visitas no período
- `orders`: Total de pedidos no período
- `revenue`: Receita total (GMV) no período (pode ser null)
- `conversionRate`: Taxa de conversão (orders/visits, pode ser null)
- `impressions?`: Total de impressões (apenas se houver métricas diárias)
- `clicks?`: Total de cliques (apenas se houver métricas diárias)
- `ctr?`: Taxa de cliques média (apenas se houver métricas diárias)

#### 5. Data Quality (`AIAnalyzeInputDataQuality`)
Indicadores de qualidade dos dados:
- `missing`: Array de campos faltantes (ex: ['description', 'images'])
- `warnings`: Array de avisos (ex: ['No daily metrics found for the last 30 days. Using listing aggregates.'])
- `completenessScore`: Score de completude (0-100)
- `sources.performance`: Origem dos dados de performance:
  - `'listing_metrics_daily'`: Dados agregados de `ListingMetricsDaily`
  - `'listing_aggregates'`: Fallback para campos agregados do `Listing` (visits_last_7d, sales_last_7d)

## Agregação de Métricas

### Com ListingMetricsDaily (Fonte Preferida)

Quando existem registros em `ListingMetricsDaily` para o período:

1. Busca todos os registros onde `date >= (hoje - periodDays)`
2. Agrega:
   - `visits`: Soma de `visits` de todos os registros
   - `orders`: Soma de `orders` de todos os registros
   - `revenue`: Soma de `gmv` de todos os registros
   - `impressions`: Soma de `impressions`
   - `clicks`: Soma de `clicks`
   - `ctr`: Média de `ctr` de todos os registros
3. Calcula `conversionRate = orders / visits` (se visits > 0)
4. Define `sources.performance = 'listing_metrics_daily'`

### Fallback (Sem ListingMetricsDaily)

Quando não existem métricas diárias:

1. Usa campos agregados do `Listing`:
   - `visits = listing.visits_last_7d ?? 0`
   - `orders = listing.sales_last_7d ?? 0`
   - `revenue = null`
   - `impressions`, `clicks`, `ctr` não são incluídos
2. Calcula `conversionRate = orders / visits` (se visits > 0)
3. Define `sources.performance = 'listing_aggregates'`
4. Adiciona warning: `"No daily metrics found for the last {periodDays} days. Using listing aggregates."`

## Cálculo de Data Quality

### Missing Fields
Campos identificados como faltantes:
- `'description'`: Se `description` está vazio ou null
- `'images'`: Se `hasImages === false`

### Warnings
Avisos sobre qualidade dos dados:
- Aviso de fallback quando não há métricas diárias
- Outros avisos podem ser adicionados no futuro

### Completeness Score (0-100)
Score calculado baseado em:
- **+30 pontos**: Se há descrição não vazia
- **+30 pontos**: Se há imagens
- **+40 pontos**: Se há métricas diárias (`listing_metrics_daily`)
- **+20 pontos**: Se não há métricas diárias mas há visits/orders agregados (fallback parcial)

## Uso no Prompt da IA

O payload é enviado como JSON no prompt do usuário:

```
Analyze this Mercado Livre listing using the provided JSON data:

{JSON.stringify(input, null, 2)}

Provide your analysis in the JSON format specified. Base your analysis ONLY on the data provided above.
```

### Instruções Críticas para a IA

O `SYSTEM_PROMPT` inclui instruções específicas:

- **Base sua análise SOMENTE nos dados fornecidos no JSON**
- **NÃO assuma ausência de fotos/descrição/vendas se o JSON indicar o contrário**
- **Se dataQuality indicar missing/warnings, mencione isso**
- **Preste atenção em performance.periodDays para entender a janela de tempo**
- **Se performance.revenue é null ou sources.performance é 'listing_aggregates', note que métricas podem estar incompletas**

## Implementação

### Helper: `buildAIAnalyzeInput`

Localização: `apps/api/src/services/OpenAIService.ts`

```typescript
async buildAIAnalyzeInput(
  listingId: string,
  userId?: string,
  requestId?: string,
  periodDays: number = 30
): Promise<AIAnalyzeInputV1>
```

### Uso no Service

```typescript
const input = await service.buildAIAnalyzeInput(listingId, userId, requestId, 30);
const analysis = await service.analyzeListing(input);
```

### Rota

Endpoint: `POST /api/v1/ai/analyze/:listingId`

- Usa `periodDays = 30` por padrão (constante `PERIOD_DAYS`)
- Passa `requestId`, `userId` do contexto da requisição
- Loga apenas: `requestId`, `tenantId`, `userId`, `listingId`, `sources.performance`, `completenessScore` (sem payload completo)

## Benefícios

1. **Dados Reais**: Usa dados agregados de 30 dias ao invés de campos soltos
2. **Fallback Seguro**: Se não houver métricas diárias, usa campos agregados do listing
3. **Data Quality**: Indica claramente qualidade e origem dos dados
4. **Menos Inferências**: IA recebe JSON estruturado, reduzindo inferências incorretas
5. **Rastreabilidade**: Meta inclui requestId, userId, analyzedAt para debug

## Exemplo de Payload

```json
{
  "meta": {
    "requestId": "req_123",
    "tenantId": "tenant_abc",
    "userId": "user_xyz",
    "marketplace": "mercadolivre",
    "listingId": "listing_456",
    "externalId": "MLB123456789",
    "analyzedAt": "2024-01-15T10:30:00.000Z",
    "periodDays": 30
  },
  "listing": {
    "title": "Smartphone XYZ 128GB",
    "description": "Smartphone com tela de 6.5 polegadas...",
    "category": "Celulares e Telefones",
    "price": 1299.99,
    "currency": "BRL",
    "stock": 15,
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T09:00:00.000Z"
  },
  "media": {
    "imageCount": 8,
    "hasImages": true,
    "hasVideo": true,
    "videoCount": 1
  },
  "performance": {
    "periodDays": 30,
    "visits": 1250,
    "orders": 45,
    "revenue": 58499.55,
    "conversionRate": 0.036,
    "impressions": 8500,
    "clicks": 1250,
    "ctr": 0.147
  },
  "dataQuality": {
    "missing": [],
    "warnings": [],
    "completenessScore": 100,
    "sources": {
      "performance": "listing_metrics_daily"
    }
  }
}
```

## IA Score Integration

O payload da IA inclui o IA Score calculado no backend.

A IA NÃO calcula score.
A IA apenas:
- Explica gaps
- Prioriza ações
- Sugere melhorias



## Próximos Passos

- [ ] Adicionar mais indicadores de qualidade (ex: dados desatualizados)
- [ ] Suporte a períodos customizados via query param
- [ ] Cache do payload para listings analisados recentemente
- [ ] Métricas de qualidade agregadas por tenant

