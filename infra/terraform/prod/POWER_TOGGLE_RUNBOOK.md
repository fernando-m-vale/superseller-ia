# Power Toggle - Runbook Completo

## Visão Geral

O Power Toggle permite ligar/desligar o ambiente AWS completo em uma única ação:

- **App Runner** (API + Web) - via Lambdas existentes
- **RDS PostgreSQL** - start/stop direto
- **NAT Gateway** - via Terraform executado no CodeBuild

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  Lambda: superseller-power-orchestrator                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Invoca Lambda App Runner (startup/shutdown)  │  │
│  │ 2. Start/Stop RDS via AWS SDK                    │  │
│  │ 3. Inicia CodeBuild para Terraform NAT          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────┐        ┌──────┐      ┌──────────────────┐
  │ App Runner│        │  RDS   │      │ CodeBuild        │
  │ (Pause/   │        │(Start/ │      │ (Terraform NAT)  │
  │ Resume)   │        │ Stop)  │      │                  │
  └──────────┘        └──────┘      └──────────────────┘
```

## Como Acionar

### Via AWS CLI

```bash
# STARTUP (ligar tudo)
aws lambda invoke \
  --function-name superseller-power-orchestrator \
  --payload '{"action":"STARTUP"}' \
  response.json

# SHUTDOWN (desligar tudo)
aws lambda invoke \
  --function-name superseller-power-orchestrator \
  --payload '{"action":"SHUTDOWN"}' \
  response.json

# Ver resposta
cat response.json | jq
```

### Via AWS Console

1. Acesse **Lambda** → `superseller-power-orchestrator`
2. Clique em **Test**
3. Crie um evento de teste com:
   ```json
   {
     "action": "STARTUP"
   }
   ```
   ou
   ```json
   {
     "action": "SHUTDOWN"
   }
   ```
4. Execute o teste

### Via API (se implementado)

```bash
# POST /api/v1/power/startup
# POST /api/v1/power/shutdown
```

## Onde Ver Logs

### CloudWatch Logs

1. **Lambda Orchestrator:**
   - `/aws/lambda/superseller-power-orchestrator`

2. **App Runner Lambdas:**
   - `/aws/lambda/superseller-power-startup`
   - `/aws/lambda/superseller-power-shutdown`

3. **CodeBuild:**
   - `/aws/codebuild/superseller-terraform-nat-enable`
   - `/aws/codebuild/superseller-terraform-nat-disable`

### CloudWatch Insights Queries

```sql
-- Últimas execuções do orchestrator
fields @timestamp, @message
| filter @message like /Power (STARTUP|SHUTDOWN)/
| sort @timestamp desc
| limit 50

-- Erros nas últimas 24h
fields @timestamp, @message
| filter @level = "ERROR" or @message like /Erro/
| sort @timestamp desc
```

## Validação de Estado

### Verificar App Runner

```bash
aws apprunner list-services --region us-east-2 | jq '.ServiceSummaryList[] | {Name: .ServiceName, Status: .Status}'
```

Status esperados:
- **STARTUP:** `RUNNING`
- **SHUTDOWN:** `PAUSED`

### Verificar RDS

```bash
aws rds describe-db-instances \
  --db-instance-identifier superseller-prod-db \
  --region us-east-2 \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text
```

Status esperados:
- **STARTUP:** `available`
- **SHUTDOWN:** `stopped`

### Verificar NAT Gateway

```bash
aws ec2 describe-nat-gateways \
  --region us-east-2 \
  --filter "Name=vpc-id,Values=vpc-097386e13a22a9c7b" \
  --query 'NatGateways[*].{ID:NatGatewayId,State:State}' \
  --output table
```

Estado esperado:
- **STARTUP:** `available` (deve existir)
- **SHUTDOWN:** `deleted` ou não existir

## Troubleshooting

### Problema: Terraform Lock no CodeBuild

**Sintoma:** CodeBuild falha com erro de lock do DynamoDB

**Solução:**
1. Verificar se há outro processo Terraform rodando:
   ```bash
   aws dynamodb get-item \
     --table-name terraform-state-lock \
     --key '{"LockID":{"S":"..."}}' \
     --region us-east-2
   ```

2. Se necessário, forçar unlock (CUIDADO):
   ```bash
   aws dynamodb delete-item \
     --table-name terraform-state-lock \
     --key '{"LockID":{"S":"..."}}' \
     --region us-east-2
   ```

3. Re-executar o CodeBuild manualmente:
   ```bash
   aws codebuild start-build \
     --project-name superseller-terraform-nat-enable \
     --region us-east-2
   ```

### Problema: RDS não inicia/para

**Sintoma:** Lambda reporta timeout ou erro ao aguardar RDS

**Solução:**
1. Verificar status manualmente (ver seção "Validação de Estado")
2. Verificar logs do RDS no CloudWatch
3. Verificar se há snapshots em progresso
4. Se necessário, iniciar/parar manualmente:
   ```bash
   # Iniciar
   aws rds start-db-instance --db-instance-identifier superseller-prod-db
   
   # Parar
   aws rds stop-db-instance --db-instance-identifier superseller-prod-db
   ```

### Problema: CodeBuild não encontra código

**Sintoma:** CodeBuild falha com "source not found"

**Solução:**
1. Verificar se o CodeBuild está configurado para usar GitHub
2. Verificar permissões OIDC (se usando GitHub Actions)
3. Alternativa: usar S3 como source (upload manual do código)

### Problema: NAT Gateway não é criado/removido

**Sintoma:** CodeBuild SUCCEEDED mas NAT ainda existe/não existe

**Solução:**
1. Verificar logs do CodeBuild no CloudWatch
2. Verificar se variável `enable_nat_gateway` está sendo passada corretamente
3. Executar Terraform manualmente para debug:
   ```bash
   cd infra/terraform/prod
   terraform init
   terraform plan -var="enable_nat_gateway=true"
   terraform apply -var="enable_nat_gateway=true"
   ```

## Idempotência

O Power Toggle é **idempotente**:

- Se App Runner já está `RUNNING` e você executa `STARTUP`, ele não faz nada
- Se RDS já está `available` e você executa `STARTUP`, ele não faz nada
- Se NAT já está habilitado e você executa `STARTUP`, o Terraform não cria duplicado

## Tempos Esperados

- **App Runner:** ~30-60 segundos
- **RDS Start:** ~5-10 minutos
- **RDS Stop:** ~2-5 minutos
- **NAT Gateway (Terraform):** ~3-5 minutos

**Total STARTUP:** ~10-15 minutos
**Total SHUTDOWN:** ~5-10 minutos

## Segurança

- A Lambda orquestradora requer permissões IAM específicas
- CodeBuild usa role dedicada com permissões mínimas
- Logs são enviados para CloudWatch (não contêm secrets)
- RDS não é exposto publicamente (apenas dentro da VPC)

## Custos

- **App Runner pausado:** ~$0 (sem custo de compute)
- **RDS stopped:** ~$0 (sem custo de compute, apenas storage)
- **NAT Gateway desabilitado:** ~$0 (sem custo)

**Economia estimada:** ~$50-100/mês (dependendo do uso)

## Próximos Passos (Opcional)

1. **EventBridge Schedule:** Automatizar shutdown/startup em horários específicos
2. **API Endpoint:** Criar endpoint na API para acionar via UI
3. **Notificações:** SNS/SES para notificar sobre mudanças de estado
4. **Dashboard:** CloudWatch Dashboard com status de todos os recursos
