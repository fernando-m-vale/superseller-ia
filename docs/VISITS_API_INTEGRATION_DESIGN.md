# Design Técnico: Integração da Visits API do Mercado Livre

**Data:** 2026-01-05  
**Autor:** Devin (Cognition AI)  
**Status:** Proposta de Design  

---

## 1. Visão Geral

Este documento descreve o design técnico para integrar a Visits API do Mercado Livre no pipeline de sincronização do SuperSeller IA. O objetivo é obter dados de visitas diárias por anúncio para calcular métricas de conversão reais e melhorar a qualidade do IA Score.

### 1.1 Problema Atual

Conforme documentado em `PROJECT_CONTEXT.md`:
- O campo `visits` está sempre `NULL` (unknown) para todos os anúncios
- A API de Items (`/items/{id}`) não retorna dados de visitas confiáveis
- Sem visitas, não é possível calcular taxa de conversão real
- O IA Score penaliza performance sem dados reais

### 1.2 Solução Proposta

Integrar a Visits API oficial do Mercado Livre que fornece:
- Visitas diárias por anúncio (série temporal)
- Histórico de até 150 dias
- Dados únicos por dia (visitantes únicos)

---

## 2. Endpoints da Visits API

### 2.1 Endpoints Disponíveis

| Endpoint | Descrição | Uso Recomendado |
|----------|-----------|-----------------|
| `GET /visits/items?ids={ids}` | Total de visitas (últimos 2 anos) | Verificação rápida |
| `GET /items/visits?ids={id}&date_from=X&date_to=Y` | Visitas por período | Backfill por item |
| `GET /items/{id}/visits/time_window?last=N&unit=day` | Série temporal diária | **Sync diário (RECOMENDADO)** |
| `GET /users/{id}/items_visits/time_window?last=N&unit=day` | Visitas agregadas do seller | Overview do seller |

### 2.2 Endpoint Recomendado para Sync

**Primário:** `GET /items/{item_id}/visits/time_window`

```bash
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/items/MLB123456789/visits/time_window?last=30&unit=day'
```

**Resposta:**
```json
{
  "item_id": "MLB123456789",
  "date_from": "2025-12-06T00:00:00Z",
  "date_to": "2026-01-05T00:00:00Z",
  "total_visits": 1250,
  "last": 30,
  "unit": "day",
  "results": [
    {
      "date": "2025-12-06T00:00:00Z",
      "total": 42,
      "visits_detail": [
        { "company": "mercadolibre", "quantity": 42 }
      ]
    },
    {
      "date": "2025-12-07T00:00:00Z",
      "total": 38,
      "visits_detail": [
        { "company": "mercadolibre", "quantity": 38 }
      ]
    }
    // ... mais dias
  ]
}
```

### 2.3 Endpoint Alternativo para Batch (Múltiplos Itens)

**Secundário:** `GET /items/visits?ids={ids}&date_from=X&date_to=Y`

```bash
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/items/visits?ids=MLB123,MLB456&date_from=2025-12-01&date_to=2026-01-05'
```

**Limitação:** Retorna apenas total agregado, não série temporal diária.

---

## 3. Schema de Persistência

### 3.1 Tabela Existente: `listing_metrics_daily`

A tabela `listing_metrics_daily` já possui a estrutura necessária para armazenar visitas diárias:

```prisma
model ListingMetricsDaily {
  id          String   @id @default(uuid())
  tenant_id   String
  listing_id  String
  date        DateTime @db.Date
  impressions Int      @default(0)
  clicks      Int      @default(0)
  ctr         Decimal  @db.Decimal(5, 4)
  visits      Int?     // <-- Campo para visitas (nullable)
  conversion  Decimal? @db.Decimal(5, 4)
  orders      Int      @default(0)
  gmv         Decimal  @db.Decimal(10, 2)
  source      String?  // Origem dos dados
  period_days Int?     // Período agregado
  created_at  DateTime @default(now())

  @@unique([tenant_id, listing_id, date])
}
```

### 3.2 Novo Campo `source` para Visitas

Adicionar novos valores ao campo `source`:

| Valor | Descrição |
|-------|-----------|
| `ml_visits_api_daily` | Visitas diárias da Visits API (série temporal) |
| `ml_visits_api_period` | Visitas agregadas da Visits API (período) |
| `ml_orders_period` | Orders do período via Orders API |
| `ml_items_aggregate` | Dados do endpoint /items (lifetime) |
| `unknown` | Sem dados disponíveis |

### 3.3 Estratégia de Persistência

**Abordagem:** Persistir uma linha por dia por listing com visitas reais.

```sql
-- Exemplo de dados após sync de visitas
INSERT INTO listing_metrics_daily (
  tenant_id, listing_id, date, visits, source
) VALUES (
  'tenant-123', 'listing-uuid', '2025-12-06', 42, 'ml_visits_api_daily'
)
ON CONFLICT (tenant_id, listing_id, date) 
DO UPDATE SET 
  visits = EXCLUDED.visits,
  source = CASE 
    WHEN listing_metrics_daily.source IS NULL THEN EXCLUDED.source
    WHEN listing_metrics_daily.source NOT LIKE '%ml_visits%' 
      THEN listing_metrics_daily.source || ',' || EXCLUDED.source
    ELSE listing_metrics_daily.source
  END;
```

### 3.4 Atualização do Listing

Após sync de visitas, atualizar campos agregados no `Listing`:

```typescript
// Calcular visits_last_7d a partir de listing_metrics_daily
const last7DaysMetrics = await prisma.listingMetricsDaily.findMany({
  where: {
    tenant_id: tenantId,
    listing_id: listing.id,
    date: { gte: last7Days },
    visits: { not: null }, // Apenas dias com visitas conhecidas
  },
});

const visitsLast7d = last7DaysMetrics.reduce((sum, m) => sum + (m.visits ?? 0), 0);

await prisma.listing.update({
  where: { id: listing.id },
  data: { visits_last_7d: visitsLast7d },
});
```

---

## 4. Estratégia de Backfill (30 dias)

### 4.1 Fluxo de Backfill

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKFILL DE VISITAS (30 DIAS)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Buscar todos os listings ativos do tenant                   │
│     └── SELECT * FROM listings WHERE status='active'            │
│                                                                 │
│  2. Para cada listing (em lotes de 10):                         │
│     └── GET /items/{id}/visits/time_window?last=30&unit=day     │
│                                                                 │
│  3. Para cada dia na resposta:                                  │
│     └── UPSERT em listing_metrics_daily                         │
│         - date = results[i].date                                │
│         - visits = results[i].total                             │
│         - source = 'ml_visits_api_daily'                        │
│                                                                 │
│  4. Atualizar visits_last_7d no listing                         │
│                                                                 │
│  5. Recalcular Super Seller Score                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Pseudo-código do Backfill

```typescript
async function backfillVisits(tenantId: string, days: number = 30): Promise<BackfillResult> {
  const result = {
    success: false,
    listingsProcessed: 0,
    daysBackfilled: 0,
    errors: [] as string[],
  };

  // 1. Carregar conexão e token
  await this.loadConnection();
  await this.ensureValidToken();

  // 2. Buscar listings ativos
  const listings = await prisma.listing.findMany({
    where: {
      tenant_id: tenantId,
      marketplace: 'mercadolivre',
      status: 'active',
    },
  });

  // 3. Processar em lotes de 10 (rate limit)
  const chunks = chunkArray(listings, 10);
  
  for (const chunk of chunks) {
    // Processar em paralelo com Promise.allSettled
    const promises = chunk.map(listing => 
      this.fetchAndPersistVisits(listing, days)
    );
    
    const results = await Promise.allSettled(promises);
    
    for (const [index, settledResult] of results.entries()) {
      if (settledResult.status === 'fulfilled') {
        result.listingsProcessed++;
        result.daysBackfilled += settledResult.value.daysProcessed;
      } else {
        result.errors.push(`${chunk[index].listing_id_ext}: ${settledResult.reason}`);
      }
    }

    // Rate limit: aguardar 1 segundo entre lotes
    await sleep(1000);
  }

  result.success = result.errors.length === 0;
  return result;
}

async function fetchAndPersistVisits(
  listing: Listing, 
  days: number
): Promise<{ daysProcessed: number }> {
  // Chamar Visits API
  const response = await axios.get(
    `${ML_API_BASE}/items/${listing.listing_id_ext}/visits/time_window`,
    {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      params: { last: days, unit: 'day' },
    }
  );

  const { results } = response.data;
  let daysProcessed = 0;

  // Persistir cada dia
  for (const dayData of results) {
    const date = new Date(dayData.date);
    date.setHours(0, 0, 0, 0);

    await prisma.listingMetricsDaily.upsert({
      where: {
        tenant_id_listing_id_date: {
          tenant_id: listing.tenant_id,
          listing_id: listing.id,
          date,
        },
      },
      create: {
        tenant_id: listing.tenant_id,
        listing_id: listing.id,
        date,
        visits: dayData.total,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        orders: 0,
        gmv: 0,
        source: 'ml_visits_api_daily',
      },
      update: {
        visits: dayData.total,
        source: prisma.raw(`
          CASE 
            WHEN source IS NULL THEN 'ml_visits_api_daily'
            WHEN source NOT LIKE '%ml_visits%' THEN source || ',ml_visits_api_daily'
            ELSE source
          END
        `),
      },
    });

    daysProcessed++;
  }

  // Atualizar visits_last_7d no listing
  await this.updateListingVisitsAggregate(listing.id);

  return { daysProcessed };
}
```

---

## 5. Rate Limits e Batching

### 5.1 Rate Limits do Mercado Livre

| Parâmetro | Valor |
|-----------|-------|
| `max_requests_per_hour` | 18.000 (padrão) |
| Requests por segundo (estimado) | ~5 req/s |
| Janela máxima de consulta | 150 dias |
| Dados disponíveis após | 48 horas |

### 5.2 Estratégia de Batching

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESTRATÉGIA DE BATCHING                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SYNC DIÁRIO (Incremental):                                     │
│  ├── Lotes de 10 listings                                       │
│  ├── 1 request por listing (time_window?last=7)                 │
│  ├── Delay de 200ms entre requests                              │
│  └── Total: ~50 listings/minuto                                 │
│                                                                 │
│  BACKFILL INICIAL (30 dias):                                    │
│  ├── Lotes de 10 listings                                       │
│  ├── 1 request por listing (time_window?last=30)                │
│  ├── Delay de 1000ms entre lotes                                │
│  └── Total: ~600 listings/hora                                  │
│                                                                 │
│  BACKFILL COMPLETO (150 dias):                                  │
│  ├── Lotes de 5 listings                                        │
│  ├── 1 request por listing (time_window?last=150)               │
│  ├── Delay de 2000ms entre lotes                                │
│  └── Total: ~150 listings/hora                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Cálculo de Capacidade

```
Cenário: Seller com 500 anúncios

Backfill 30 dias:
- 500 listings / 10 por lote = 50 lotes
- 50 lotes * 1s delay = 50 segundos
- Total estimado: ~2 minutos

Sync diário (7 dias):
- 500 listings / 10 por lote = 50 lotes
- 50 lotes * 0.2s delay = 10 segundos
- Total estimado: ~30 segundos
```

### 5.4 Retry com Exponential Backoff

```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        
        // Rate limit (429) ou erro temporário (5xx)
        if (status === 429 || (status && status >= 500)) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`[VISITS] Retry ${attempt + 1}/${maxRetries} após ${delay}ms`);
          await sleep(delay);
          continue;
        }
        
        // 401: tentar refresh de token
        if (status === 401) {
          await this.refreshAccessToken(this.refreshToken);
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error(`Falha após ${maxRetries} tentativas`);
}
```

---

## 6. Rotas da API

### 6.1 Novas Rotas de Sync

```typescript
// apps/api/src/routes/sync.routes.ts

/**
 * POST /api/v1/sync/mercadolivre/visits
 * 
 * Sincroniza visitas dos anúncios do Mercado Livre.
 * 
 * Query Params:
 *   - days: Número de dias para buscar (default: 7, max: 150)
 *   - backfill: Se true, faz backfill completo (default: false)
 * 
 * Response:
 *   {
 *     "message": "Sincronização de visitas concluída",
 *     "data": {
 *       "listingsProcessed": 50,
 *       "daysBackfilled": 350,
 *       "duration": "45000ms"
 *     }
 *   }
 */
app.post('/mercadolivre/visits', { preHandler: authGuard }, async (req, reply) => {
  const { tenantId } = req as RequestWithAuth;
  const { days = 7, backfill = false } = VisitsSyncQuerySchema.parse(req.query);
  
  const syncService = new MercadoLivreSyncService(tenantId);
  const result = await syncService.syncVisits(backfill ? 30 : days);
  
  return reply.send({
    message: 'Sincronização de visitas concluída',
    data: result,
  });
});

/**
 * POST /api/v1/sync/mercadolivre/visits/backfill
 * 
 * Executa backfill completo de visitas (30 dias).
 * Operação mais lenta, recomendada para onboarding.
 */
app.post('/mercadolivre/visits/backfill', { preHandler: authGuard }, async (req, reply) => {
  const { tenantId } = req as RequestWithAuth;
  const { days = 30 } = BackfillQuerySchema.parse(req.query);
  
  const syncService = new MercadoLivreSyncService(tenantId);
  const result = await syncService.backfillVisits(days);
  
  return reply.send({
    message: 'Backfill de visitas concluído',
    data: result,
  });
});
```

### 6.2 Schema de Validação

```typescript
// Zod schemas para validação

const VisitsSyncQuerySchema = z.object({
  days: z.coerce.number().min(1).max(150).default(7),
  backfill: z.coerce.boolean().default(false),
});

const BackfillQuerySchema = z.object({
  days: z.coerce.number().min(1).max(150).default(30),
});
```

### 6.3 Integração com Full Sync

```typescript
/**
 * POST /api/v1/sync/mercadolivre/full
 * 
 * Atualizado para incluir sync de visitas.
 */
app.post('/mercadolivre/full', { preHandler: authGuard }, async (req, reply) => {
  const { tenantId } = req as RequestWithAuth;
  
  const syncService = new MercadoLivreSyncService(tenantId);
  const ordersService = new MercadoLivreOrdersService(tenantId);
  
  // 1. Sync de listings
  const listingsResult = await syncService.syncListings();
  
  // 2. Sync de pedidos (30 dias)
  const ordersResult = await ordersService.syncOrders(30);
  
  // 3. Sync de visitas (7 dias - incremental)
  const visitsResult = await syncService.syncVisits(7);
  
  return reply.send({
    message: 'Sincronização completa concluída',
    data: {
      listings: listingsResult,
      orders: ordersResult,
      visits: visitsResult, // NOVO
    },
  });
});
```

---

## 7. Exposição na UI

### 7.1 Dashboard de Métricas

Atualizar o endpoint `/api/v1/metrics/summary` para usar visitas reais:

```typescript
// apps/api/src/routes/metrics.ts

app.get('/summary', { preHandler: authGuard }, async (req, reply) => {
  // ... código existente ...
  
  // Calcular totais com visitas reais
  const totalVisits = metrics.reduce((sum, m) => {
    // Apenas somar se visits não for null (conhecido)
    return sum + (m.visits ?? 0);
  }, 0);
  
  // Flag para indicar se há visitas desconhecidas
  const hasUnknownVisits = metrics.some(m => m.visits === null);
  
  // Calcular conversão apenas se todas as visitas forem conhecidas
  const conversionRate = !hasUnknownVisits && totalVisits > 0 
    ? (totalOrders / totalVisits) * 100 
    : null;
  
  return reply.send({
    totalRevenue,
    totalOrders,
    totalVisits,
    conversionRate,
    hasUnknownVisits, // NOVO: flag para UI
    series,
  });
});
```

### 7.2 Componente de Visitas no Frontend

```tsx
// apps/web/src/components/VisitsMetric.tsx

interface VisitsMetricProps {
  totalVisits: number;
  hasUnknownVisits: boolean;
  conversionRate: number | null;
}

export function VisitsMetric({ totalVisits, hasUnknownVisits, conversionRate }: VisitsMetricProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {totalVisits.toLocaleString('pt-BR')}
        </div>
        
        {hasUnknownVisits && (
          <p className="text-sm text-muted-foreground">
            Alguns anúncios não possuem dados de visitas
          </p>
        )}
        
        {conversionRate !== null && (
          <div className="mt-2">
            <span className="text-sm text-muted-foreground">Taxa de conversão: </span>
            <span className="font-medium">{conversionRate.toFixed(2)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 7.3 Gráfico de Visitas por Dia

```tsx
// apps/web/src/components/VisitsChart.tsx

interface VisitsChartProps {
  series: Array<{ date: string; visits: number; orders: number }>;
}

export function VisitsChart({ series }: VisitsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={series}>
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Line 
          yAxisId="left"
          type="monotone" 
          dataKey="visits" 
          stroke="#8884d8" 
          name="Visitas"
        />
        <Line 
          yAxisId="right"
          type="monotone" 
          dataKey="orders" 
          stroke="#82ca9d" 
          name="Pedidos"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### 7.4 Botão de Sync de Visitas

```tsx
// apps/web/src/components/SyncVisitsButton.tsx

export function SyncVisitsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: syncVisits } = useSyncVisits();
  
  const handleSync = async () => {
    setIsLoading(true);
    try {
      await syncVisits({ days: 7 });
      toast.success('Visitas sincronizadas com sucesso');
    } catch (error) {
      toast.error('Erro ao sincronizar visitas');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Button onClick={handleSync} disabled={isLoading}>
      {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Sincronizar Visitas
    </Button>
  );
}
```

---

## 8. Checklist de Implementação

### 8.1 Backend

- [ ] **Criar `MercadoLivreVisitsService`**
  - [ ] Método `syncVisits(days: number)`
  - [ ] Método `backfillVisits(days: number)`
  - [ ] Método `fetchVisitsForItem(itemId: string, days: number)`
  - [ ] Retry com exponential backoff
  - [ ] Rate limiting (delay entre requests)

- [ ] **Atualizar `MercadoLivreSyncService`**
  - [ ] Integrar sync de visitas no `triggerFullSyncAfterRefresh`
  - [ ] Adicionar método `updateListingVisitsAggregate`

- [ ] **Criar rotas de sync**
  - [ ] `POST /api/v1/sync/mercadolivre/visits`
  - [ ] `POST /api/v1/sync/mercadolivre/visits/backfill`
  - [ ] Atualizar `POST /api/v1/sync/mercadolivre/full`

- [ ] **Atualizar rotas de métricas**
  - [ ] `GET /api/v1/metrics/summary` - incluir visitas reais
  - [ ] `GET /api/v1/metrics/overview` - incluir flag `hasUnknownVisits`

- [ ] **Atualizar `buildAIAnalyzeInput`**
  - [ ] Usar visitas de `listing_metrics_daily` quando disponíveis
  - [ ] Remover warning `visits_unknown_via_api` quando visitas conhecidas
  - [ ] Calcular `conversionRate` real

### 8.2 Frontend

- [ ] **Criar componentes de visitas**
  - [ ] `VisitsMetric` - card com total de visitas
  - [ ] `VisitsChart` - gráfico de visitas por dia
  - [ ] `SyncVisitsButton` - botão de sync manual

- [ ] **Atualizar Dashboard**
  - [ ] Adicionar card de visitas
  - [ ] Adicionar gráfico de visitas vs pedidos
  - [ ] Mostrar taxa de conversão real

- [ ] **Atualizar hooks**
  - [ ] `useSyncVisits` - hook para sync de visitas
  - [ ] `useMetricsSummary` - incluir visitas

### 8.3 Testes

- [ ] **Testes unitários**
  - [ ] `MercadoLivreVisitsService.syncVisits`
  - [ ] `MercadoLivreVisitsService.backfillVisits`
  - [ ] Retry logic
  - [ ] Rate limiting

- [ ] **Testes de integração**
  - [ ] Sync de visitas end-to-end
  - [ ] Backfill de 30 dias
  - [ ] Atualização de métricas no dashboard

### 8.4 Documentação

- [ ] Atualizar `ML_METRICS_SYNC.md`
- [ ] Atualizar `PROJECT_CONTEXT.md`
- [ ] Adicionar seção de visitas em `API_CONTRACTS.md`

---

## 9. Considerações de Segurança

### 9.1 Tokens e Autenticação

- Usar o mesmo padrão de `executeWithRetryOn401` para refresh automático
- Não logar tokens ou dados sensíveis
- Usar `sanitizeError` para erros

### 9.2 Rate Limiting

- Implementar delay entre requests para não exceder 18.000/hora
- Usar exponential backoff em caso de 429
- Monitorar uso de quota via logs

### 9.3 Dados

- Não sobrescrever visitas conhecidas com `null`
- Manter histórico de `source` para auditoria
- Validar dados antes de persistir

---

## 10. Métricas de Sucesso

| Métrica | Antes | Depois (Esperado) |
|---------|-------|-------------------|
| Listings com visitas conhecidas | 0% | 100% |
| Taxa de conversão calculável | Não | Sim |
| Precisão do IA Score (performance) | Baixa | Alta |
| Warnings `visits_unknown_via_api` | 100% | 0% |

---

## 11. Cronograma Sugerido

| Fase | Duração | Entregáveis |
|------|---------|-------------|
| 1. Backend Service | 2 dias | `MercadoLivreVisitsService` |
| 2. Rotas de Sync | 1 dia | Endpoints de sync |
| 3. Integração Métricas | 1 dia | Dashboard atualizado |
| 4. Frontend | 2 dias | Componentes de visitas |
| 5. Testes | 1 dia | Testes unitários e integração |
| 6. Documentação | 0.5 dia | Docs atualizados |
| **Total** | **~7 dias** | |

---

## 12. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Rate limit excedido | Média | Alto | Implementar delay e backoff |
| Dados de visitas indisponíveis | Baixa | Médio | Fallback para `null` (unknown) |
| Token expirado durante sync | Média | Baixo | Refresh automático com retry |
| Latência alta em backfill | Alta | Baixo | Processar em background |

---

## Referências

- [Mercado Livre Visits API (PT-BR)](https://developers.mercadolivre.com.br/pt_br/recurso-visits)
- [Mercado Libre Visits API (ES)](https://developers.mercadolibre.com.ar/devsite/visits)
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)
- [ML_METRICS_SYNC.md](./ML_METRICS_SYNC.md)
