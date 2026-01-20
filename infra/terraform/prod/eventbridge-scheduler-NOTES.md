# EventBridge Scheduler - Limitações do Provider Terraform AWS

## Problema

O provider Terraform AWS (v6.28.0) **não suporta** os recursos nativos do EventBridge Scheduler:
- `aws_scheduler_connection` ❌ (não existe)
- `aws_scheduler_api_destination` ❌ (não existe)  
- `target.http_target` ❌ (não suportado em `aws_scheduler_schedule`)

## Solução Atual

Os schedules precisam ser criados **manualmente via AWS CLI** ou **API** antes do `terraform apply`.

### Passos para criar Connection e API Destination via CLI:

```bash
# 1. Criar Scheduler Connection
aws scheduler create-connection \
  --name superseller-internal-jobs \
  --connection-type API_KEY \
  --auth-parameters ApiKeyAuthParameters="{Key=X-Internal-Key,Value=$(aws secretsmanager get-secret-value --secret-id prod/INTERNAL_JOBS_KEY --query SecretString --output text)}"

# 2. Obter Connection ARN
CONNECTION_ARN=$(aws scheduler get-connection --name superseller-internal-jobs --query ConnectionArn --output text)

# 3. Criar API Destination para rebuild-daily-metrics
aws scheduler create-api-destination \
  --name superseller-rebuild-daily-metrics \
  --invocation-endpoint https://api.superselleria.com.br/api/v1/jobs/rebuild-daily-metrics \
  --http-method POST \
  --connection-arn $CONNECTION_ARN \
  --invocation-rate-limit-per-second 1

# 4. Obter API Destination ARN
REBUILD_ARN=$(aws scheduler get-api-destination --name superseller-rebuild-daily-metrics --query ApiDestinationArn --output text)

# 5. Criar API Destination para ml-sync (opcional)
aws scheduler create-api-destination \
  --name superseller-ml-sync \
  --invocation-endpoint https://api.superselleria.com.br/api/v1/jobs/sync-mercadolivre \
  --http-method POST \
  --connection-arn $CONNECTION_ARN \
  --invocation-rate-limit-per-second 1

ML_SYNC_ARN=$(aws scheduler get-api-destination --name superseller-ml-sync --query ApiDestinationArn --output text)
```

### Terraform - Usar data sources para referenciar recursos existentes

```hcl
# Data source para Connection (se criado manualmente)
data "aws_scheduler_connection" "internal_jobs" {
  name = "superseller-internal-jobs"
}

# Data source para API Destinations (se criados manualmente)
data "aws_scheduler_api_destination" "rebuild_daily_metrics" {
  name = "superseller-rebuild-daily-metrics"
}

# No target do schedule:
target {
  arn      = data.aws_scheduler_api_destination.rebuild_daily_metrics.arn
  role_arn = aws_iam_role.scheduler_execution[0].arn
  # ...
}
```

**NOTA**: Data sources também não existem no provider atual.

## Solução Alternativa: Usar EventBridge (CloudWatch Events) API Destinations

O Terraform suporta `aws_cloudwatch_event_connection` e `aws_cloudwatch_event_api_destination`, mas o EventBridge Scheduler **não aceita** ARNs desses recursos (formato `arn:aws:events:...:api-destination/...`).

## Próximos Passos

1. Aguardar suporte do provider AWS para recursos do Scheduler
2. Criar recursos manualmente e importá-los no Terraform (se possível)
3. Usar `terraform_remote_state` ou data sources quando disponíveis
4. Usar `null_resource` com `local-exec` para criar via CLI (não recomendado)

## Referências

- [AWS EventBridge Scheduler API Reference](https://docs.aws.amazon.com/scheduler/latest/APIReference/)
- [Terraform AWS Provider - Scheduler Resources](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/scheduler_schedule)
