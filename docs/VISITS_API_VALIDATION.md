# Validacao da Integracao Visits API

**Data:** 2026-01-05  
**Referencia:** [VISITS_API_INTEGRATION_DESIGN.md](./VISITS_API_INTEGRATION_DESIGN.md)  
**Status:** Documento de Validacao  

---

## 1. Queries SQL para Validacao do Backfill

### 1.1 Contagem de Visitas por Listing

Verifica quantos registros de visitas foram inseridos por listing apos o backfill.

```sql
-- Total de registros de visitas por listing
SELECT 
    l.listing_id_ext AS ml_id,
    l.title,
    COUNT(lmd.id) AS total_dias_com_dados,
    SUM(lmd.visits) AS total_visitas,
    MIN(lmd.date) AS primeira_data,
    MAX(lmd.date) AS ultima_data
FROM listings l
LEFT JOIN listing_metrics_daily lmd 
    ON l.id = lmd.listing_id 
    AND l.tenant_id = lmd.tenant_id
    AND lmd.visits IS NOT NULL
WHERE l.tenant_id = '<TENANT_ID>'
    AND l.marketplace = 'mercadolivre'
    AND l.status = 'active'
GROUP BY l.id, l.listing_id_ext, l.title
ORDER BY total_visitas DESC NULLS LAST;
```

### 1.2 Contagem de Visitas por Dia

Verifica a distribuicao de visitas por dia para identificar gaps ou anomalias.

```sql
-- Visitas agregadas por dia (todos os listings)
SELECT 
    lmd.date,
    COUNT(DISTINCT lmd.listing_id) AS listings_com_dados,
    SUM(lmd.visits) AS total_visitas,
    AVG(lmd.visits)::NUMERIC(10,2) AS media_visitas,
    MIN(lmd.visits) AS min_visitas,
    MAX(lmd.visits) AS max_visitas
FROM listing_metrics_daily lmd
WHERE lmd.tenant_id = '<TENANT_ID>'
    AND lmd.visits IS NOT NULL
    AND lmd.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY lmd.date
ORDER BY lmd.date DESC;
```

### 1.3 Contagem de Visitas por Source

Verifica a origem dos dados de visitas para auditoria.

```sql
-- Distribuicao por source (origem dos dados)
SELECT 
    lmd.source,
    COUNT(*) AS total_registros,
    COUNT(DISTINCT lmd.listing_id) AS listings_unicos,
    SUM(lmd.visits) AS total_visitas,
    MIN(lmd.date) AS data_mais_antiga,
    MAX(lmd.date) AS data_mais_recente
FROM listing_metrics_daily lmd
WHERE lmd.tenant_id = '<TENANT_ID>'
    AND lmd.visits IS NOT NULL
GROUP BY lmd.source
ORDER BY total_registros DESC;
```

### 1.4 Validacao de Cobertura do Backfill

Verifica se todos os listings ativos receberam dados de visitas.

```sql
-- Listings SEM dados de visitas (gap analysis)
SELECT 
    l.listing_id_ext AS ml_id,
    l.title,
    l.status,
    l.created_at,
    l.visits_last_7d AS visits_agregado
FROM listings l
WHERE l.tenant_id = '<TENANT_ID>'
    AND l.marketplace = 'mercadolivre'
    AND l.status = 'active'
    AND NOT EXISTS (
        SELECT 1 
        FROM listing_metrics_daily lmd 
        WHERE lmd.listing_id = l.id 
            AND lmd.tenant_id = l.tenant_id
            AND lmd.visits IS NOT NULL
            AND lmd.source LIKE '%ml_visits%'
    )
ORDER BY l.created_at DESC;
```

### 1.5 Comparacao Antes/Depois do Backfill

Compara metricas agregadas antes e depois do backfill.

```sql
-- Resumo de cobertura de visitas
SELECT 
    COUNT(*) AS total_listings_ativos,
    COUNT(CASE WHEN l.visits_last_7d IS NOT NULL AND l.visits_last_7d > 0 THEN 1 END) AS listings_com_visits_7d,
    COUNT(CASE WHEN l.visits_last_7d IS NULL OR l.visits_last_7d = 0 THEN 1 END) AS listings_sem_visits_7d,
    ROUND(
        COUNT(CASE WHEN l.visits_last_7d IS NOT NULL AND l.visits_last_7d > 0 THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) AS percentual_cobertura
FROM listings l
WHERE l.tenant_id = '<TENANT_ID>'
    AND l.marketplace = 'mercadolivre'
    AND l.status = 'active';
```

### 1.6 Validacao de Integridade dos Dados

Verifica consistencia dos dados inseridos.

```sql
-- Registros com valores suspeitos
SELECT 
    lmd.id,
    l.listing_id_ext AS ml_id,
    lmd.date,
    lmd.visits,
    lmd.source,
    lmd.created_at
FROM listing_metrics_daily lmd
JOIN listings l ON l.id = lmd.listing_id AND l.tenant_id = lmd.tenant_id
WHERE lmd.tenant_id = '<TENANT_ID>'
    AND lmd.source LIKE '%ml_visits%'
    AND (
        lmd.visits < 0                          -- Visitas negativas (erro)
        OR lmd.visits > 100000                  -- Visitas muito altas (anomalia)
        OR lmd.date > CURRENT_DATE              -- Data futura (erro)
        OR lmd.date < CURRENT_DATE - INTERVAL '150 days'  -- Data muito antiga
    )
ORDER BY lmd.date DESC;
```

### 1.7 Verificacao de Duplicatas

Identifica registros duplicados que podem indicar problemas no upsert.

```sql
-- Verificar duplicatas (nao deveria haver devido ao unique constraint)
SELECT 
    lmd.tenant_id,
    lmd.listing_id,
    lmd.date,
    COUNT(*) AS duplicatas
FROM listing_metrics_daily lmd
WHERE lmd.tenant_id = '<TENANT_ID>'
GROUP BY lmd.tenant_id, lmd.listing_id, lmd.date
HAVING COUNT(*) > 1;
```

---

## 2. Checklist de Logs Esperados

### 2.1 Logs de Sucesso

Durante uma execucao bem-sucedida do sync de visitas, os seguintes logs devem aparecer:

| Nivel | Padrao de Log | Descricao |
|-------|---------------|-----------|
| `INFO` | `[VISITS] Iniciando sync de visitas` | Inicio do processo |
| `INFO` | `[VISITS] Carregando conexao do tenant` | Carregamento de credenciais |
| `INFO` | `[VISITS] Token validado com sucesso` | Token OAuth valido |
| `INFO` | `[VISITS] Buscando listings ativos` | Query de listings |
| `INFO` | `[VISITS] Encontrados N listings para processar` | Contagem de listings |
| `INFO` | `[VISITS] Processando lote X/Y` | Progresso do batch |
| `INFO` | `[VISITS] Visitas obtidas para MLB123456789: 42` | Dados recebidos por item |
| `INFO` | `[VISITS] Persistindo N dias de visitas` | Upsert no banco |
| `INFO` | `[VISITS] Sync concluido: N listings, M dias` | Resumo final |

### 2.2 Logs de Rate Limit (429)

Quando o rate limit do Mercado Livre e atingido:

| Nivel | Padrao de Log | Acao Esperada |
|-------|---------------|---------------|
| `WARN` | `[VISITS] Rate limit atingido (429)` | Detectou limite |
| `WARN` | `[VISITS] Retry 1/3 apos 1000ms` | Primeiro retry |
| `WARN` | `[VISITS] Retry 2/3 apos 2000ms` | Segundo retry |
| `WARN` | `[VISITS] Retry 3/3 apos 4000ms` | Terceiro retry |
| `ERROR` | `[VISITS] Falha apos 3 tentativas` | Esgotou retries |

**Headers de Rate Limit a Monitorar:**

```
X-RateLimit-Limit: 18000
X-RateLimit-Remaining: 17500
X-RateLimit-Reset: 1704456000
```

### 2.3 Logs de Erro de Autenticacao (401)

Quando o token OAuth expira ou e invalido:

| Nivel | Padrao de Log | Acao Esperada |
|-------|---------------|---------------|
| `WARN` | `[VISITS] Token expirado (401)` | Detectou expiracao |
| `INFO` | `[VISITS] Tentando refresh do token` | Iniciando refresh |
| `INFO` | `[VISITS] Token renovado com sucesso` | Refresh OK |
| `ERROR` | `[VISITS] Falha no refresh do token` | Refresh falhou |

### 2.4 Logs de Erro de API (5xx)

Quando a API do Mercado Livre retorna erro de servidor:

| Nivel | Padrao de Log | Acao Esperada |
|-------|---------------|---------------|
| `WARN` | `[VISITS] Erro de servidor ML (500/502/503)` | Erro temporario |
| `WARN` | `[VISITS] Retry com backoff exponencial` | Aguardando retry |
| `ERROR` | `[VISITS] API ML indisponivel apos retries` | Falha persistente |

### 2.5 Logs de Erro de Dados

Quando ha problemas com os dados recebidos:

| Nivel | Padrao de Log | Descricao |
|-------|---------------|-----------|
| `WARN` | `[VISITS] Resposta vazia para MLB123` | Sem dados de visitas |
| `WARN` | `[VISITS] Formato inesperado na resposta` | Schema diferente |
| `ERROR` | `[VISITS] Falha ao persistir visitas` | Erro de banco |

### 2.6 Comandos para Buscar Logs

```bash
# Buscar logs de rate limit (AWS CloudWatch)
aws logs filter-log-events \
    --log-group-name /aws/apprunner/superseller-api \
    --filter-pattern '"[VISITS]" "429"' \
    --start-time $(date -d '1 hour ago' +%s)000

# Buscar logs de erro
aws logs filter-log-events \
    --log-group-name /aws/apprunner/superseller-api \
    --filter-pattern '"[VISITS]" "ERROR"' \
    --start-time $(date -d '1 hour ago' +%s)000

# Buscar todos os logs de visitas
aws logs filter-log-events \
    --log-group-name /aws/apprunner/superseller-api \
    --filter-pattern '"[VISITS]"' \
    --start-time $(date -d '1 hour ago' +%s)000
```

---

## 3. Plano de Rollback

### 3.1 Desabilitar Rotas via Feature Flag

A forma mais segura de desabilitar a funcionalidade e via feature flag no ambiente.

**Opcao A: Variavel de Ambiente**

```bash
# Adicionar no AWS Secrets Manager ou App Runner env vars
FEATURE_VISITS_SYNC_ENABLED=false
```

**Codigo de verificacao (a implementar):**

```typescript
// apps/api/src/routes/sync.routes.ts

const isVisitsSyncEnabled = () => {
  return process.env.FEATURE_VISITS_SYNC_ENABLED !== 'false';
};

app.post('/mercadolivre/visits', { preHandler: authGuard }, async (req, reply) => {
  if (!isVisitsSyncEnabled()) {
    return reply.status(503).send({
      error: 'Service temporarily disabled',
      message: 'Visits sync is currently disabled',
    });
  }
  // ... resto da implementacao
});
```

### 3.2 Desabilitar Rotas Diretamente

Se nao houver feature flag implementada, desabilitar as rotas no codigo:

**Passo 1: Comentar registro das rotas**

```typescript
// apps/api/src/routes/sync.routes.ts

// ROLLBACK: Rotas de visitas desabilitadas temporariamente
// app.post('/mercadolivre/visits', { preHandler: authGuard }, visitsHandler);
// app.post('/mercadolivre/visits/backfill', { preHandler: authGuard }, backfillHandler);
```

**Passo 2: Remover visitas do full sync**

```typescript
// apps/api/src/routes/sync.routes.ts

app.post('/mercadolivre/full', { preHandler: authGuard }, async (req, reply) => {
  const syncService = new MercadoLivreSyncService(tenantId);
  const ordersService = new MercadoLivreOrdersService(tenantId);
  
  const listingsResult = await syncService.syncListings();
  const ordersResult = await ordersService.syncOrders(30);
  
  // ROLLBACK: Sync de visitas removido temporariamente
  // const visitsResult = await syncService.syncVisits(7);
  
  return reply.send({
    message: 'Sincronizacao completa concluida',
    data: {
      listings: listingsResult,
      orders: ordersResult,
      // visits: visitsResult, // ROLLBACK
    },
  });
});
```

### 3.3 Reverter Dados do Backfill

Se necessario limpar os dados de visitas inseridos:

```sql
-- CUIDADO: Operacao destrutiva!
-- Executar apenas se necessario reverter completamente

-- 1. Backup dos dados antes de deletar
CREATE TABLE listing_metrics_daily_backup_visits AS
SELECT * FROM listing_metrics_daily
WHERE source LIKE '%ml_visits%';

-- 2. Remover apenas os dados de visitas da Visits API
DELETE FROM listing_metrics_daily
WHERE source LIKE '%ml_visits%'
    AND tenant_id = '<TENANT_ID>';

-- 3. Resetar campo visits para NULL nos registros restantes
UPDATE listing_metrics_daily
SET visits = NULL
WHERE source NOT LIKE '%ml_visits%'
    AND tenant_id = '<TENANT_ID>';

-- 4. Resetar visits_last_7d nos listings
UPDATE listings
SET visits_last_7d = NULL
WHERE tenant_id = '<TENANT_ID>'
    AND marketplace = 'mercadolivre';
```

### 3.4 Checklist de Rollback

Antes de executar o rollback, verificar:

- [ ] **Identificar o problema**: Rate limit? Dados incorretos? Erro de integracao?
- [ ] **Comunicar stakeholders**: Informar sobre a desabilitacao temporaria
- [ ] **Escolher nivel de rollback**:
  - [ ] Nivel 1: Apenas desabilitar novas chamadas (feature flag)
  - [ ] Nivel 2: Desabilitar rotas no codigo
  - [ ] Nivel 3: Reverter dados do banco
- [ ] **Executar rollback**:
  - [ ] Atualizar variavel de ambiente OU
  - [ ] Fazer deploy com rotas comentadas
- [ ] **Verificar rollback**:
  - [ ] Confirmar que rotas retornam 503 ou 404
  - [ ] Confirmar que full sync nao inclui visitas
- [ ] **Documentar incidente**: Registrar causa e acoes tomadas

### 3.5 Comandos de Deploy para Rollback

```bash
# 1. Atualizar feature flag via AWS CLI
aws secretsmanager update-secret \
    --secret-id superseller/api/env \
    --secret-string '{"FEATURE_VISITS_SYNC_ENABLED":"false"}'

# 2. Forcar redeploy do App Runner para pegar nova config
aws apprunner start-deployment \
    --service-arn arn:aws:apprunner:us-east-2:ACCOUNT:service/superseller-api/SERVICE_ID

# 3. Verificar status do deployment
aws apprunner describe-service \
    --service-arn arn:aws:apprunner:us-east-2:ACCOUNT:service/superseller-api/SERVICE_ID \
    --query 'Service.Status'
```

---

## 4. Metricas de Validacao Pos-Backfill

### 4.1 Criterios de Sucesso

| Metrica | Valor Esperado | Query de Verificacao |
|---------|----------------|---------------------|
| Cobertura de listings | >= 95% | Query 1.5 |
| Dias com dados por listing | >= 28 (de 30) | Query 1.1 |
| Registros com source correto | 100% | Query 1.3 |
| Duplicatas | 0 | Query 1.7 |
| Valores anomalos | 0 | Query 1.6 |

### 4.2 Alertas a Configurar

```yaml
# Exemplo de alerta CloudWatch
MetricName: VisitsSyncErrors
Namespace: SuperSellerIA
Threshold: 5
Period: 300
EvaluationPeriods: 1
ComparisonOperator: GreaterThanThreshold
AlarmActions:
  - arn:aws:sns:us-east-2:ACCOUNT:superseller-alerts
```

---

## Referencias

- [VISITS_API_INTEGRATION_DESIGN.md](./VISITS_API_INTEGRATION_DESIGN.md) - Design tecnico completo
- [DB_DIAGNOSTICS.md](./DB_DIAGNOSTICS.md) - Queries de diagnostico gerais
- [ML_METRICS_SYNC.md](./ML_METRICS_SYNC.md) - Documentacao de sync de metricas
