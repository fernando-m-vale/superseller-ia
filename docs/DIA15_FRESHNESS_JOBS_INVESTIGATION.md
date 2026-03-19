# DIA 15 - Freshness / Jobs Investigation

## Escopo

Esta investigação foi feita em cima do código atual do repositório.

Objetivo: entender por que a experiência pode exibir algo como "dados atualizados há 8 dias", mapear o fluxo de atualização e listar as correções mais prováveis.

Quando algo abaixo for hipótese, está marcado como `Hipótese`.

## 1. Como a atualização de dados funciona hoje

### 1.1. Startup e agendamento

- O servidor inicializa o scheduler recorrente em [`apps/api/src/server.ts`](../apps/api/src/server.ts) quando `ENABLE_MARKETPLACE_DATA_SCHEDULER !== 'false'`.
- O runner que processa a fila só inicia quando `ENABLE_JOB_RUNNER === 'true'`.
- O scheduler recorrente está em [`apps/api/src/jobs/MarketplaceDataScheduler.ts`](../apps/api/src/jobs/MarketplaceDataScheduler.ts).
- Hoje ele agenda 4 tipos de job por tenant ativo do Mercado Livre:
  - `SYNC_VISITS` a cada 6h
  - `SYNC_ORDERS` a cada 6h
  - `SYNC_PROMOTIONS` a cada 24h
  - `SYNC_PRICE` a cada 24h

### 1.2. Fila e processamento

- A fila atual é em banco, via [`apps/api/src/jobs/DbJobQueue.ts`](../apps/api/src/jobs/DbJobQueue.ts).
- Os jobs são persistidos na tabela `sync_jobs`, definida em [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).
- O processamento da fila acontece em loop no [`apps/api/src/jobs/JobRunner.ts`](../apps/api/src/jobs/JobRunner.ts).
- Os handlers hoje são:
  - [`apps/api/src/jobs/handlers/TenantSyncOrchestrator.ts`](../apps/api/src/jobs/handlers/TenantSyncOrchestrator.ts)
  - [`apps/api/src/jobs/handlers/ListingSyncWorker.ts`](../apps/api/src/jobs/handlers/ListingSyncWorker.ts)
  - [`apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts`](../apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts)

### 1.3. Sync manual e rotas operacionais

- Sync manual seller-facing:
  - [`apps/api/src/routes/sync.routes.ts`](../apps/api/src/routes/sync.routes.ts)
  - rotas relevantes:
    - `POST /api/v1/sync/mercadolivre`
    - `POST /api/v1/sync/mercadolivre/orders`
    - `POST /api/v1/sync/mercadolivre/full`
    - `POST /api/v1/sync/mercadolivre/listings/:listingIdExt/force-refresh`
    - `POST /api/v1/sync/tenant/auto`
    - `POST /api/v1/sync/tenant/manual`
    - `GET /api/v1/sync/tenant/status`
    - `GET /api/v1/sync/jobs/health`
- Jobs internos:
  - [`apps/api/src/routes/internal-jobs.routes.ts`](../apps/api/src/routes/internal-jobs.routes.ts)
  - rotas relevantes:
    - `POST /api/v1/jobs/sync-mercadolivre`
    - `POST /api/v1/jobs/rebuild-daily-metrics`

### 1.4. O que cada job atualiza

- `LISTING_SYNC`
  - Atualiza um listing específico.
  - Busca detalhes/promo/clips e grava métricas de visitas do período.
  - Em sucesso, grava `listings.last_synced_at` e `listings.last_sync_status=success`.
  - Arquivo: [`apps/api/src/jobs/handlers/ListingSyncWorker.ts`](../apps/api/src/jobs/handlers/ListingSyncWorker.ts)

- `SYNC_VISITS`
  - Sincroniza visitas por range e grava em `listing_metrics_daily`.
  - Depois faz `touchListings`, que atualiza `listings.last_synced_at`.
  - Arquivo: [`apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts`](../apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts)

- `SYNC_ORDERS`
  - Sincroniza pedidos, reconstrói métricas diárias e também faz `touchListings`.
  - Arquivo: [`apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts`](../apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts)

- `SYNC_PROMOTIONS` e `SYNC_PRICE`
  - Rebuscam detalhes dos anúncios, atualizam preço/promoção e fazem `touchListings`.
  - Arquivo: [`apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts`](../apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts)

- Sync completo manual
  - `MercadoLivreSyncService.syncListings()` e `MercadoLivreOrdersService.syncOrders()`
  - Arquivos:
    - [`apps/api/src/services/MercadoLivreSyncService.ts`](../apps/api/src/services/MercadoLivreSyncService.ts)
    - [`apps/api/src/services/MercadoLivreOrdersService.ts`](../apps/api/src/services/MercadoLivreOrdersService.ts)

### 1.5. Ads, benchmark, cache e análise

- Ads Intelligence
  - Snapshot por listing em `listing_ads_metrics_daily`.
  - Serviço: [`apps/api/src/services/MarketplaceAdsIntelligenceService.ts`](../apps/api/src/services/MarketplaceAdsIntelligenceService.ts)
  - Attach no payload: [`apps/api/src/services/ads/attachAdsIntelligence.ts`](../apps/api/src/services/ads/attachAdsIntelligence.ts)

- Benchmark
  - Consumido na análise em [`apps/api/src/routes/ai-analyze.routes.ts`](../apps/api/src/routes/ai-analyze.routes.ts)
  - Serviços:
    - [`apps/api/src/services/BenchmarkService.ts`](../apps/api/src/services/BenchmarkService.ts)
    - [`apps/api/src/services/BenchmarkInsightsService.ts`](../apps/api/src/services/BenchmarkInsightsService.ts)

- Cache da análise
  - Tabela `listing_ai_analysis`
  - Chave: `tenant_id + listing_id + period_days + fingerprint`
  - O fingerprint é calculado antes do cache e depende do listing + métricas, não do timestamp puro.
  - Arquivos:
    - [`apps/api/src/routes/ai-analyze.routes.ts`](../apps/api/src/routes/ai-analyze.routes.ts)
    - [`apps/api/src/utils/ai-fingerprint.ts`](../apps/api/src/utils/ai-fingerprint.ts)

- `forceRefresh`
  - `POST /api/v1/ai/analyze/:listingId?forceRefresh=true`
  - Antes de analisar, tenta atualizar o listing do ML.
  - Também invalida cache anterior da análise.

- `GET /latest`
  - `GET /api/v1/ai/analyze/:listingId/latest`
  - Busca a última análise por `created_at desc`.
  - Só devolve se a análise tiver no máximo 7 dias.
  - Se estiver mais velha que 7 dias, responde 404 e o frontend não faz POST automático.

### 1.6. Quais timestamps alimentam a UI

Existem dois conceitos diferentes de freshness no produto hoje:

- Status global de sync na UI seller-facing
  - A barra de sync usa dados do tenant:
    - `tenants.last_auto_sync_at`
    - `tenants.last_manual_sync_at`
  - Arquivo: [`apps/web/src/components/listings/SyncStatusBar.tsx`](../apps/web/src/components/listings/SyncStatusBar.tsx)

- Freshness da análise do anúncio
  - O payload da análise monta `dataFreshness` em [`apps/api/src/routes/ai-analyze.routes.ts`](../apps/api/src/routes/ai-analyze.routes.ts)
  - Regra atual:
    - `listings.last_synced_at`
    - senão `listings.promotion_checked_at`
    - senão `listings.updated_at`
  - Isso é o que explica frases como "Dados atualizados há X dias".

## 2. Onde pode estar o problema

### Achado forte 1: scheduler recorrente pode parar após a primeira execução

Este é o achado mais forte da investigação.

Fatos do código:

- O scheduler usa `lockKey` fixo por tenant e tipo de job em [`apps/api/src/jobs/MarketplaceDataScheduler.ts`](../apps/api/src/jobs/MarketplaceDataScheduler.ts).
- Exemplo:
  - `tenant-sync-visits:${tenantId}:SYNC_VISITS`
- O `DbJobQueue.enqueue()` só evita duplicação quando já existe job `queued` ou `running` com a mesma chave.
- Mas a tabela `sync_jobs` tem `@@unique([lock_key])`, sem recorte por status, em [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).

Consequência provável:

- Primeiro agendamento cria o job com sucesso.
- Depois que ele termina com `success`, o próximo tick não encontra job `queued/running` e tenta criar de novo a mesma `lock_key`.
- Como a chave é globalmente única, a criação tende a falhar por unique constraint.
- O scheduler captura o erro e só loga `Error running scheduled marketplace sync jobs`.

`Hipótese muito provável`: os jobs recorrentes podem estar rodando apenas na primeira vez e depois parando de reenfileirar.

Isso explica diretamente dados defasados por vários dias.

### Achado forte 2: pode existir scheduler ativo sem runner ativo

Fatos do código:

- O scheduler é ligado por padrão.
- O runner só liga se `ENABLE_JOB_RUNNER === 'true'`.

`Hipótese muito provável`: em algum ambiente, o sistema pode estar enfileirando jobs mas sem nenhum `JobRunner` consumindo a fila.

Sinais esperados:

- `sync_jobs` acumulando em `queued`
- `GET /api/v1/sync/jobs/health` mostrando `queued > 0` e `running = 0`

### Achado forte 3: a string de freshness usa timestamp de listing, não timestamp da análise

Fatos do código:

- `dataFreshness` é montado a partir de `last_synced_at || promotion_checked_at || updated_at`.
- Isso é independente de `listing_ai_analysis.created_at`.

Consequência:

- É possível ter análise "nova" em termos de execução de IA, mas com `dataFreshness` antigo, se o listing base não foi atualizado.
- Também é possível a UI mostrar "8 dias" mesmo que a análise tenha sido gerada hoje, caso a base operacional esteja velha.

### Achado forte 4: `GET /latest` e cache podem reutilizar material antigo

Fatos do código:

- `GET /latest` aceita análise com até 7 dias de idade.
- O frontend usa `GET /latest` ao abrir, e se vier 404 não dispara POST automático.
- O cache principal de `POST /analyze` depende do fingerprint dos dados disponíveis.

Consequências possíveis:

- Se os jobs falham e os dados operacionais não mudam, o fingerprint pode continuar igual.
- Nesse caso a análise continua reutilizando cache coerente com dados velhos.
- O problema primário não parece ser o cache em si, mas a falta de atualização dos dados que alimentam o fingerprint.

### Achado forte 5: `last_synced_at` só avança em sucesso

Fatos do código:

- `LISTING_SYNC` atualiza `last_synced_at` apenas em sucesso.
- Os jobs de marketplace também fazem `touchListings()` apenas ao final do fluxo com sucesso prático.

Consequência:

- Falha parcial ou recorrente pode deixar o freshness congelado mesmo com tentativas.
- Isso é desejável para evitar falso positivo de sucesso, mas piora a percepção quando o sistema falha silenciosamente.

## 3. Componentes, arquivos, tabelas e campos afetados

### Backend

- Scheduler/runner/fila
  - [`apps/api/src/server.ts`](../apps/api/src/server.ts)
  - [`apps/api/src/jobs/MarketplaceDataScheduler.ts`](../apps/api/src/jobs/MarketplaceDataScheduler.ts)
  - [`apps/api/src/jobs/JobRunner.ts`](../apps/api/src/jobs/JobRunner.ts)
  - [`apps/api/src/jobs/DbJobQueue.ts`](../apps/api/src/jobs/DbJobQueue.ts)
  - [`apps/api/src/jobs/locks.ts`](../apps/api/src/jobs/locks.ts)

- Handlers de atualização
  - [`apps/api/src/jobs/handlers/ListingSyncWorker.ts`](../apps/api/src/jobs/handlers/ListingSyncWorker.ts)
  - [`apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts`](../apps/api/src/jobs/handlers/MarketplaceDataSyncWorker.ts)
  - [`apps/api/src/jobs/handlers/TenantSyncOrchestrator.ts`](../apps/api/src/jobs/handlers/TenantSyncOrchestrator.ts)

- Serviços de sync
  - [`apps/api/src/services/MercadoLivreSyncService.ts`](../apps/api/src/services/MercadoLivreSyncService.ts)
  - [`apps/api/src/services/MercadoLivreOrdersService.ts`](../apps/api/src/services/MercadoLivreOrdersService.ts)
  - [`apps/api/src/services/MercadoLivreVisitsService.ts`](../apps/api/src/services/MercadoLivreVisitsService.ts)
  - [`apps/api/src/services/MarketplaceAdsIntelligenceService.ts`](../apps/api/src/services/MarketplaceAdsIntelligenceService.ts)

- Rotas
  - [`apps/api/src/routes/sync.routes.ts`](../apps/api/src/routes/sync.routes.ts)
  - [`apps/api/src/routes/internal-jobs.routes.ts`](../apps/api/src/routes/internal-jobs.routes.ts)
  - [`apps/api/src/routes/ai-analyze.routes.ts`](../apps/api/src/routes/ai-analyze.routes.ts)

### Frontend

- Status global de sync
  - [`apps/web/src/components/listings/SyncStatusBar.tsx`](../apps/web/src/components/listings/SyncStatusBar.tsx)
- Leitura de análise e `GET /latest`
  - [`apps/web/src/hooks/use-ai-analyze.ts`](../apps/web/src/hooks/use-ai-analyze.ts)
  - [`apps/web/src/lib/ai/normalizeAiAnalyze.ts`](../apps/web/src/lib/ai/normalizeAiAnalyze.ts)

### Tabelas e campos envolvidos

- `tenants`
  - `last_auto_sync_at`
  - `last_manual_sync_at`
  - `last_sync_status`
  - `last_sync_started_at`
  - `last_sync_finished_at`
  - `last_sync_error`

- `listings`
  - `last_synced_at`
  - `last_sync_status`
  - `last_sync_error`
  - `promotion_checked_at`
  - `updated_at`
  - preço/promoção/clips/atributos que alteram fingerprint

- `sync_jobs`
  - `type`
  - `status`
  - `lock_key`
  - `run_after`
  - `started_at`
  - `finished_at`
  - `error`

- `listing_metrics_daily`
  - `date`
  - `visits`
  - `orders`
  - `gmv`
  - `source`
  - `period_days`

- `listing_ads_metrics_daily`
  - `date`
  - `status`
  - métricas de Ads

- `listing_ai_analysis`
  - `fingerprint`
  - `created_at`
  - `updated_at`
  - `result_json`

## 4. Como validar manualmente

Estas validações exigem acesso ao ambiente, banco e API em execução.

### 4.1. Validar se o runner está realmente habilitado

Checar variáveis de ambiente do serviço:

```bash
ENABLE_JOB_RUNNER
ENABLE_MARKETPLACE_DATA_SCHEDULER
JOB_QUEUE_DRIVER
```

Esperado:

- `ENABLE_JOB_RUNNER=true`
- `JOB_QUEUE_DRIVER=db` hoje

### 4.2. Validar fila e saúde operacional

Com a API no ar:

```bash
curl -H "x-debug: 1" http://<host>/api/v1/sync/jobs/health
```

O que observar:

- `queued` alto e `running=0` sugere scheduler sem runner
- `error` subindo ao longo do tempo sugere falha de processamento

### 4.3. Validar se o problema da `lock_key` está acontecendo

No banco:

```sql
select type, lock_key, status, created_at, finished_at, error
from sync_jobs
order by created_at desc
limit 100;
```

Checagens:

- Se existir só um job histórico por `lock_key` recorrente, mesmo após vários dias, isso reforça a hipótese.
- Se os logs do app mostrarem erro de unique constraint no agendamento, a causa fica praticamente confirmada.

Consulta útil:

```sql
select lock_key, count(*) as total
from sync_jobs
group by lock_key
order by total desc, lock_key;
```

Se cada `lock_key` recorrente tiver no máximo 1 linha histórica, isso combina com a restrição atual de unicidade global.

### 4.4. Validar freshness real no listing

No banco:

```sql
select
  id,
  listing_id_ext,
  last_synced_at,
  promotion_checked_at,
  updated_at,
  last_sync_status,
  last_sync_error
from listings
where tenant_id = '<tenant_id>'
order by coalesce(last_synced_at, promotion_checked_at, updated_at) asc
limit 50;
```

Objetivo:

- Encontrar listings com freshness muito antigo
- Ver se o status está preso em `error`

### 4.5. Validar se visitas/pedidos continuam chegando no banco

```sql
select max(date) as last_metrics_date
from listing_metrics_daily
where tenant_id = '<tenant_id>';
```

```sql
select max(date) as last_ads_date
from listing_ads_metrics_daily
where tenant_id = '<tenant_id>';
```

Se essas datas estiverem paradas, a base operacional realmente está velha.

### 4.6. Validar coerência da API de análise

Forçar uma leitura da análise:

```bash
curl -H "Authorization: Bearer <token>" \
  http://<host>/api/v1/ai/analyze/<listing_uuid>/latest
```

E uma regeneração:

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  "http://<host>/api/v1/ai/analyze/<listing_uuid>?forceRefresh=true" \
  -d "{}"
```

Checar no payload:

- `dataFreshness`
- `cacheHit`
- `analyzedAt`
- `promo.checkedAt`
- `adsIntelligence.analyzedAt`

Interpretação:

- `analyzedAt` novo com `dataFreshness` velho = IA nova em cima de base operacional velha
- `cacheHit=true` repetido com dados operacionais congelados = cache coerente com base congelada

### 4.7. Validar UI

Fluxos manuais:

1. Abrir a tela do listing e comparar:
   - barra global de sync
   - `dataFreshness` da análise
2. Rodar `forceRefresh` do listing/análise.
3. Reabrir a tela.

Objetivo:

- confirmar se a barra global usa timestamp do tenant
- confirmar se a análise usa timestamp do listing
- confirmar se os dois podem divergir

## 5. Recomendação executiva

### Hipótese mais provável

A hipótese mais provável é a combinação de dois problemas:

1. Jobs recorrentes com `lock_key` fixa + unicidade global por `lock_key` em `sync_jobs`, fazendo o scheduler parar de reenfileirar depois da primeira execução bem-sucedida.
2. Em alguns ambientes, possibilidade adicional de scheduler ligado sem `JobRunner` ativo.

Entre os dois, o problema da `lock_key` é o achado mais forte e mais específico do código atual.

### Correção mínima recomendada agora

Corrigir o desenho da fila recorrente:

- remover a unicidade global de `lock_key` ou
- mudar a estratégia de lock para permitir novas execuções históricas por `lock_key`, mantendo dedupe apenas para `queued/running`

Na prática, a direção mais segura parece ser:

- manter dedupe em aplicação para jobs ativos
- permitir múltiplas execuções históricas da mesma chave ao longo do tempo

Também vale ativar uma observabilidade mínima:

- alertar quando `queued` cresce e `running` não anda
- logar explicitamente falha de enqueue recorrente por unique constraint

### O que vale corrigir agora

- Corrigir a modelagem de `sync_jobs.lock_key` para jobs recorrentes.
- Confirmar `ENABLE_JOB_RUNNER=true` no ambiente alvo.
- Validar se `listing_metrics_daily` e `listings.last_synced_at` voltam a avançar.
- Adicionar uma checagem operacional simples no deploy/health para runner + scheduler.

### O que pode ficar para depois

- Refinar a semântica de `dataFreshness` para separar:
  - freshness da base operacional
  - freshness da análise IA
- Melhorar UX para explicar divergência entre:
  - "última sincronização"
  - "última análise"
  - "última atualização de Ads"
- Revisar a política do `GET /latest` de 7 dias e o fallback do frontend.

## Conclusão curta

Hoje o indicador "dados atualizados há X dias" depende principalmente de timestamps do listing, não da análise.

O código atual traz um candidato muito forte para a origem da defasagem: os jobs recorrentes parecem incompatíveis com a restrição global de unicidade da `lock_key` na fila. Se isso se confirmar no ambiente, essa é a primeira correção a fazer.
