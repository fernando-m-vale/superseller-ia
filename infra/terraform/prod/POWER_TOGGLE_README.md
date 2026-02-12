# Power Toggle - Documentação Técnica

## Visão Geral

Sistema completo de Power On/Off para o ambiente AWS do SuperSeller IA, automatizando o controle de:

- **App Runner** (API + Web) - via Lambdas existentes
- **RDS PostgreSQL** - start/stop direto via AWS SDK
- **NAT Gateway** - enable/disable via Terraform executado no CodeBuild

## Arquivos Criados/Modificados

### Novos Arquivos

1. **`infra/lambda/power-orchestrator/index.js`**
   - Lambda orquestradora que coordena todos os steps
   - Implementa idempotência e logging estruturado
   - Timeout: 30 minutos (para aguardar RDS e CodeBuild)

2. **`infra/lambda/power-orchestrator/package.json`**
   - Dependências: `@aws-sdk/client-lambda`, `@aws-sdk/client-rds`, `@aws-sdk/client-codebuild`

3. **`infra/terraform/prod/power-orchestrator.tf`**
   - Provisiona Lambda orquestradora
   - Provisiona 2 projetos CodeBuild (enable/disable NAT)
   - IAM roles e policies necessárias

4. **`infra/terraform/prod/POWER_TOGGLE_RUNBOOK.md`**
   - Runbook completo com troubleshooting
   - Comandos de validação
   - Guia de uso

### Arquivos Modificados

1. **`infra/terraform/prod/variables.tf`**
   - Adicionada variável `rds_instance_identifier`

2. **`infra/terraform/prod/outputs.tf`**
   - Adicionados outputs para Lambda orquestradora e CodeBuild projects

## Deploy

### 1. Instalar Dependências da Lambda

```bash
cd infra/lambda/power-orchestrator
npm install
cd ../../..
```

### 2. Aplicar Terraform

```bash
cd infra/terraform/prod
terraform init
terraform plan
terraform apply
```

Isso criará:
- Lambda `superseller-power-orchestrator`
- CodeBuild projects `superseller-terraform-nat-enable` e `superseller-terraform-nat-disable`
- IAM roles e policies necessárias

### 3. Testar

```bash
# STARTUP
aws lambda invoke \
  --function-name superseller-power-orchestrator \
  --payload '{"action":"STARTUP"}' \
  response.json

# SHUTDOWN
aws lambda invoke \
  --function-name superseller-power-orchestrator \
  --payload '{"action":"SHUTDOWN"}' \
  response.json
```

## Configuração do CodeBuild

**IMPORTANTE:** O CodeBuild está configurado para usar GitHub como source. Se o repositório for **privado**, você precisará:

1. **Opção 1:** Configurar OAuth connection no CodeBuild
2. **Opção 2:** Usar S3 como source (upload manual do código)
3. **Opção 3:** Usar GitHub via OIDC (se já configurado)

Para repositórios **públicos**, funciona direto.

## Variáveis de Ambiente da Lambda

A Lambda orquestradora usa as seguintes variáveis (configuradas automaticamente pelo Terraform):

- `AWS_REGION` - Região AWS (default: us-east-2)
- `DB_INSTANCE_IDENTIFIER` - Nome da instância RDS (default: superseller-prod-db)
- `APPRUNNER_STARTUP_FUNCTION_NAME` - Nome da Lambda de startup
- `APPRUNNER_SHUTDOWN_FUNCTION_NAME` - Nome da Lambda de shutdown
- `CODEBUILD_NAT_ENABLE_PROJECT` - Nome do projeto CodeBuild para enable
- `CODEBUILD_NAT_DISABLE_PROJECT` - Nome do projeto CodeBuild para disable

## Permissões IAM

### Lambda Orchestrator

- `lambda:InvokeFunction` - Para chamar Lambdas de App Runner
- `rds:StartDBInstance`, `rds:StopDBInstance`, `rds:DescribeDBInstances` - Para controlar RDS
- `codebuild:StartBuild`, `codebuild:BatchGetBuilds` - Para controlar CodeBuild
- `logs:*` - Para CloudWatch Logs

### CodeBuild

- Permissões EC2 para criar/remover NAT Gateway
- Permissões S3/DynamoDB para backend do Terraform (se usar S3 backend)
- `logs:*` - Para CloudWatch Logs

## Troubleshooting

Ver `POWER_TOGGLE_RUNBOOK.md` para troubleshooting detalhado.

## Próximos Passos (Opcional)

1. **EventBridge Schedule:** Automatizar shutdown/startup
2. **API Endpoint:** Criar endpoint na API para acionar via UI
3. **Notificações:** SNS/SES para notificar sobre mudanças
4. **Dashboard:** CloudWatch Dashboard com status

## Notas Importantes

- O backend do Terraform está configurado como **local** (`providers.tf`). Se você usar S3 backend, ajuste o buildspec do CodeBuild.
- O CodeBuild precisa ter acesso ao código do repositório. Se for privado, configure OAuth ou use S3.
- RDS pode levar 5-10 minutos para iniciar/parar. A Lambda aguarda até 10 minutos.
- NAT Gateway pode levar 3-5 minutos para criar/remover. O CodeBuild aguarda até 20 minutos.
