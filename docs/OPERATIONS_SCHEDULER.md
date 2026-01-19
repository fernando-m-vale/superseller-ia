# Operations Scheduler - EventBridge + App Runner

Este documento descreve como configurar e operar o agendamento de jobs internos usando AWS EventBridge Scheduler para chamar endpoints do App Runner.

## Visao Geral da Arquitetura

O SuperSeller IA utiliza AWS App Runner para hospedar a API. Como App Runner nao suporta cron jobs internos de forma confiavel (o processo pode ser escalado para zero ou reiniciado), utilizamos AWS EventBridge Scheduler como solucao externa para agendamento.

```
+-------------------+     HTTPS POST      +------------------+
| EventBridge       | -----------------> | App Runner API   |
| Scheduler         |   X-Internal-Key   | /api/v1/jobs/*   |
| (America/Sao_Paulo)|                   |                  |
+-------------------+                    +------------------+
        |                                        |
        v                                        v
+-------------------+                    +------------------+
| Secrets Manager   |                    | PostgreSQL RDS   |
| prod/INTERNAL_    |                    | listing_metrics  |
| JOBS_KEY          |                    | _daily           |
+-------------------+                    +------------------+
```

## Endpoints Disponiveis

### POST /api/v1/jobs/rebuild-daily-metrics

Recalcula e faz UPSERT em `listing_metrics_daily` para um intervalo de datas. Este e o endpoint principal para manter as metricas diarias atualizadas.

**Request Body:**
```json
{
  "tenantId": "uuid-do-tenant",
  "from": "2024-01-01",
  "to": "2024-01-31"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "jobLogId": "uuid-do-job-log",
  "duration": 1234,
  "daysProcessed": 30,
  "rowsUpserted": 150,
  "listingsProcessed": 50,
  "dateRange": {
    "from": "2024-01-01",
    "to": "2024-01-31",
    "maxDateAfterRebuild": "2024-01-31"
  }
}
```

### POST /api/v1/jobs/sync-mercadolivre

Executa sync completo do Mercado Livre (listings + orders).

**Request Body:**
```json
{
  "tenantId": "uuid-do-tenant",
  "daysBack": 30
}
```

## Autenticacao com X-Internal-Key

Todos os endpoints de jobs internos sao protegidos pelo header `X-Internal-Key`. A chave e validada contra a variavel de ambiente `INTERNAL_JOBS_KEY`.

### Como Funciona

1. O EventBridge Scheduler faz uma requisicao HTTPS para o endpoint do App Runner
2. O header `X-Internal-Key` e incluido na requisicao
3. O middleware `internalAuthGuard` valida o header contra `INTERNAL_JOBS_KEY`
4. Se a chave for invalida ou ausente, retorna 401 Unauthorized

### Configuracao do Secret

O secret `INTERNAL_JOBS_KEY` deve ser criado no AWS Secrets Manager:

```bash
# Gerar uma chave segura
INTERNAL_KEY=$(openssl rand -base64 32)

# Criar o secret no Secrets Manager
aws secretsmanager create-secret \
  --name prod/INTERNAL_JOBS_KEY \
  --secret-string "$INTERNAL_KEY" \
  --region us-east-2
```

**Importante:** Apos criar o secret, adicione-o as variaveis de ambiente do App Runner:

1. Acesse o console do App Runner
2. Selecione o servico `superseller-api`
3. Va em Configuration > Service settings > Environment variables
4. Adicione: `INTERNAL_JOBS_KEY` = ARN do secret `prod/INTERNAL_JOBS_KEY`
5. Faca deploy das alteracoes

## Criacao do Schedule via Console AWS

### Passo 1: Acessar EventBridge Scheduler

1. Acesse o console AWS: https://console.aws.amazon.com/scheduler
2. Regiao: `us-east-2`
3. Clique em "Create schedule"

### Passo 2: Configurar Schedule

**Schedule name:** `superseller-daily-metrics-rebuild`

**Schedule group:** `default` (ou crie um grupo `superseller-jobs`)

**Schedule pattern:**
- Tipo: Recurring schedule
- Schedule type: Cron-based schedule
- Cron expression: `0 6 * * ? *` (executa as 06:00 UTC = 03:00 BRT)
- Timezone: `America/Sao_Paulo`

**Flexible time window:** Off (para execucao precisa)

### Passo 3: Configurar Target

**Target type:** All APIs > Amazon EventBridge API destinations

**API destination:**
- Create new API destination
- Name: `superseller-api-jobs`
- Endpoint: `https://api.superselleria.com.br/api/v1/jobs/rebuild-daily-metrics`
- HTTP method: POST

**Connection:**
- Create new connection
- Name: `superseller-internal-jobs`
- Authorization type: API Key
- API key name: `X-Internal-Key`
- Value: (valor do secret `prod/INTERNAL_JOBS_KEY`)

**Invocation body:**
```json
{
  "tenantId": "SEU_TENANT_ID_AQUI",
  "from": "<aws.scheduler.scheduled-time-minus-1d>",
  "to": "<aws.scheduler.scheduled-time>"
}
```

**Nota:** Para calcular datas dinamicamente, use uma Lambda intermediaria ou configure datas fixas com janela de 30 dias.

### Passo 4: Configurar Retry Policy

**Retry policy:**
- Maximum age of event: 1 hour (3600 seconds)
- Retry attempts: 3

**Dead-letter queue (DLQ):**
- Recomendado: Configure uma SQS queue para capturar falhas
- Nome sugerido: `superseller-scheduler-dlq`

### Passo 5: Configurar Permissoes

O EventBridge Scheduler precisa de uma IAM Role com permissoes para:
- Invocar o API destination
- Acessar o Secrets Manager (se usando connection com secret)

**Trust policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "scheduler.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Permissions policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "events:InvokeApiDestination"
      ],
      "Resource": "arn:aws:events:us-east-2:234642166969:api-destination/superseller-api-jobs/*"
    }
  ]
}
```

## Criacao do Schedule via Terraform

Se preferir usar Infrastructure as Code, utilize o arquivo `infra/terraform/prod/eventbridge-scheduler.tf`:

```bash
cd infra/terraform/prod

# Criar o secret primeiro (se ainda nao existir)
aws secretsmanager create-secret \
  --name prod/INTERNAL_JOBS_KEY \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-2

# Aplicar Terraform
terraform init
terraform plan -var="enable_scheduler=true" -var="scheduler_tenant_id=SEU_TENANT_ID"
terraform apply -var="enable_scheduler=true" -var="scheduler_tenant_id=SEU_TENANT_ID"
```

## Validacao da Execucao

### Via Logs do CloudWatch

Os logs do App Runner estao disponiveis em:
- Log group: `/aws/apprunner/superseller-api/...`
- Filtro: `[INTERNAL-JOB]`

**Exemplo de query CloudWatch Insights:**
```
fields @timestamp, @message
| filter @message like /INTERNAL-JOB/
| sort @timestamp desc
| limit 50
```

### Via job_logs no Banco de Dados

Cada execucao de job cria um registro na tabela `job_logs`:

```sql
-- Ultimas execucoes de rebuild-daily-metrics
SELECT 
  id,
  job_type,
  status,
  started_at,
  completed_at,
  duration_ms,
  records_processed,
  error_message,
  metadata
FROM job_logs
WHERE job_type = 'metrics_aggregation'
ORDER BY started_at DESC
LIMIT 10;
```

### Via API (requer JWT)

```bash
# Listar status dos jobs
curl -X GET "https://api.superselleria.com.br/api/v1/jobs/status?jobType=metrics_aggregation&limit=10" \
  -H "Authorization: Bearer SEU_JWT_TOKEN"

# Estatisticas dos jobs
curl -X GET "https://api.superselleria.com.br/api/v1/jobs/stats" \
  -H "Authorization: Bearer SEU_JWT_TOKEN"
```

### Validar que listing_metrics_daily esta Atualizado

```sql
-- Verificar MAX(date) por tenant
SELECT 
  tenant_id,
  MAX(date) as max_date,
  COUNT(*) as total_records
FROM listing_metrics_daily
GROUP BY tenant_id;

-- Verificar se MAX(date) e hoje ou ontem
SELECT 
  CASE 
    WHEN MAX(date) >= CURRENT_DATE - INTERVAL '1 day' THEN 'OK'
    ELSE 'DESATUALIZADO'
  END as status,
  MAX(date) as ultima_data
FROM listing_metrics_daily
WHERE tenant_id = 'SEU_TENANT_ID';
```

## Monitoramento e Alertas

### Metricas do EventBridge Scheduler

No CloudWatch, monitore:
- `InvocationAttempts` - Tentativas de invocacao
- `InvocationsFailed` - Falhas de invocacao
- `InvocationsSucceeded` - Invocacoes bem-sucedidas
- `TargetErrors` - Erros no target (App Runner)

### Alarme Recomendado

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "superseller-scheduler-failures" \
  --alarm-description "Alerta quando o scheduler falha" \
  --metric-name "InvocationsFailed" \
  --namespace "AWS/Scheduler" \
  --statistic Sum \
  --period 86400 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --dimensions Name=ScheduleName,Value=superseller-daily-metrics-rebuild \
  --alarm-actions "arn:aws:sns:us-east-2:234642166969:superseller-alerts"
```

## Plano de Rollback

### Cenario 1: Schedule Executando com Erro

1. **Desabilitar o schedule temporariamente:**
   ```bash
   aws scheduler update-schedule \
     --name superseller-daily-metrics-rebuild \
     --state DISABLED \
     --region us-east-2
   ```

2. **Verificar logs do App Runner:**
   ```bash
   aws logs filter-log-events \
     --log-group-name "/aws/apprunner/superseller-api/..." \
     --filter-pattern "INTERNAL-JOB" \
     --start-time $(date -d '1 hour ago' +%s000)
   ```

3. **Corrigir o problema e reabilitar:**
   ```bash
   aws scheduler update-schedule \
     --name superseller-daily-metrics-rebuild \
     --state ENABLED \
     --region us-east-2
   ```

### Cenario 2: Dados Corrompidos no listing_metrics_daily

1. **Identificar o periodo afetado:**
   ```sql
   SELECT date, COUNT(*), source
   FROM listing_metrics_daily
   WHERE tenant_id = 'SEU_TENANT_ID'
   GROUP BY date, source
   ORDER BY date DESC;
   ```

2. **Deletar registros corrompidos (se necessario):**
   ```sql
   DELETE FROM listing_metrics_daily
   WHERE tenant_id = 'SEU_TENANT_ID'
     AND date BETWEEN '2024-01-01' AND '2024-01-31'
     AND source = 'internal_job';
   ```

3. **Executar rebuild manual:**
   ```bash
   curl -X POST "https://api.superselleria.com.br/api/v1/jobs/rebuild-daily-metrics" \
     -H "X-Internal-Key: SUA_CHAVE" \
     -H "Content-Type: application/json" \
     -d '{"tenantId": "SEU_TENANT_ID", "from": "2024-01-01", "to": "2024-01-31"}'
   ```

### Cenario 3: Remover Completamente o Scheduler

```bash
# Via AWS CLI
aws scheduler delete-schedule \
  --name superseller-daily-metrics-rebuild \
  --region us-east-2

# Via Terraform
terraform destroy -target=aws_scheduler_schedule.daily_metrics_rebuild
```

## Troubleshooting

### Erro 401 Unauthorized

- Verifique se `INTERNAL_JOBS_KEY` esta configurado no App Runner
- Verifique se o valor do header `X-Internal-Key` corresponde ao secret
- Verifique se o App Runner foi redeployado apos adicionar a variavel

### Erro 500 Internal Server Error

- Verifique os logs do App Runner para detalhes do erro
- Verifique se o `tenantId` e valido
- Verifique se o banco de dados esta acessivel

### Schedule Nao Executa

- Verifique se o schedule esta ENABLED
- Verifique se a IAM Role tem permissoes corretas
- Verifique se o API destination esta configurado corretamente
- Verifique o CloudWatch Logs do EventBridge Scheduler

### Metricas Nao Atualizadas

- Verifique se o job executou com sucesso via `job_logs`
- Verifique se ha dados de orders/visits para o periodo
- Execute o rebuild manualmente para diagnostico

## Checklist de Configuracao

- [ ] Secret `prod/INTERNAL_JOBS_KEY` criado no Secrets Manager
- [ ] Variavel `INTERNAL_JOBS_KEY` adicionada ao App Runner
- [ ] App Runner redeployado com a nova variavel
- [ ] API destination criado no EventBridge
- [ ] Connection com X-Internal-Key configurada
- [ ] Schedule criado com cron expression correta
- [ ] Timezone configurado para America/Sao_Paulo
- [ ] Retry policy configurada (3 tentativas)
- [ ] IAM Role com permissoes corretas
- [ ] Teste manual do endpoint com curl
- [ ] Validacao que MAX(date) em listing_metrics_daily e atualizado
- [ ] Alarme de falha configurado (opcional)
- [ ] DLQ configurada (opcional)
