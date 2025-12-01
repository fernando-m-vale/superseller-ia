# SuperSeller IA - Infraestrutura AWS (App Runner)

## Arquitetura

Esta infraestrutura usa **AWS App Runner** para executar os serviços de API e WEB, substituindo a arquitetura anterior baseada em ECS Fargate + ALB.

### Benefícios do App Runner

- **Custo reduzido**: Paga apenas pelo tempo de execução real
- **Simplicidade**: Menos recursos para gerenciar (sem ALB, Target Groups, ECS Cluster)
- **Auto-scaling automático**: Escala automaticamente baseado na demanda
- **Certificados SSL automáticos**: HTTPS incluído sem configuração adicional
- **Deploy simplificado**: Push para ECR e atualiza automaticamente (se habilitado)

### Recursos Criados

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS App Runner                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐          ┌─────────────────┐              │
│  │  superseller-api │          │  superseller-web │              │
│  │    (Porta 3001)  │          │    (Porta 3000)  │              │
│  └────────┬────────┘          └────────┬────────┘              │
│           │                            │                        │
│           └──────────┬─────────────────┘                        │
│                      │                                          │
│           ┌──────────▼──────────┐                              │
│           │   VPC Connector     │                              │
│           │  (Private Subnets)  │                              │
│           └──────────┬──────────┘                              │
└──────────────────────┼──────────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │     VPC (Existente)      │
          │  ┌────────────────────┐  │
          │  │   RDS PostgreSQL   │  │
          │  │  (Private Subnet)  │  │
          │  └────────────────────┘  │
          └──────────────────────────┘
```

## Arquivos Terraform

| Arquivo | Descrição |
|---------|-----------|
| `apprunner.tf` | Serviços App Runner (API/WEB), VPC Connector, IAM Roles |
| `ecr.tf` | Repositórios ECR para imagens Docker |
| `rds.tf` | RDS PostgreSQL (se enable_rds=true) |
| `sg.tf` | Security Groups (App Runner, RDS) |
| `secrets.tf` | Referências ao Secrets Manager |
| `route53.tf` | DNS records para custom domains |
| `acm.tf` | Certificados SSL/TLS |
| `lambda-power-control.tf` | Lambdas para pausar/resumir serviços |
| `variables.tf` | Variáveis de configuração |
| `outputs.tf` | Outputs da infraestrutura |
| `locals.tf` | Valores locais reutilizáveis |
| `main.tf` | Data sources da VPC |
| `providers.tf` | Configuração do provider AWS |

## Pré-requisitos

1. **AWS CLI** configurado com credenciais válidas
2. **Terraform** >= 1.6.0
3. **Imagens Docker** nos repositórios ECR:
   - `superseller/api:latest`
   - `superseller/web:latest`
4. **Secrets** configurados no Secrets Manager:
   - `prod/DB_SSELLERIA` (DATABASE_URL)
   - `prod/JWT_SECRET`
   - `prod/ML_APP_ID`
   - `prod/ML_APP_SECRET`
   - `prod/ML_REDIRECT_URI`
   - `prod/SHOPEE_CLIENT_ID`
   - `prod/SHOPEE_CLIENT_SECRET`
   - `prod/SHOPEE_REDIRECT_URI`
   - `prod/NEXT_PUBLIC_API_URL`

## Variáveis Principais

```hcl
# App Runner - CPU e Memória
apprunner_api_cpu    = "512"   # 256, 512, 1024, 2048, 4096
apprunner_api_memory = "1024"  # 512-12288
apprunner_web_cpu    = "512"
apprunner_web_memory = "1024"

# Custom Domains
enable_custom_domains = false  # true para usar api.superselleria.com.br

# RDS
enable_rds = false  # true para criar novo RDS
```

## Deploy

### 1. Inicializar Terraform

```bash
cd infra/terraform/prod
terraform init
```

### 2. Verificar plano de execução

```bash
terraform plan
```

### 3. Aplicar mudanças

```bash
terraform apply
```

### 4. Deploy de nova imagem

```bash
# Build e push para ECR
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 234642166969.dkr.ecr.us-east-2.amazonaws.com

# API
docker build -t superseller/api:latest -f apps/api/Dockerfile.prod .
docker tag superseller/api:latest 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/api:latest
docker push 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/api:latest

# WEB
docker build -t superseller/web:latest -f apps/web/Dockerfile.prod .
docker tag superseller/web:latest 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/web:latest
docker push 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/web:latest

# Forçar novo deploy no App Runner (se auto_deployments_enabled = false)
aws apprunner start-deployment --service-arn $(terraform output -raw apprunner_api_service_arn)
aws apprunner start-deployment --service-arn $(terraform output -raw apprunner_web_service_arn)
```

## Power Control (Pausar/Resumir)

Para reduzir custos, você pode pausar os serviços quando não estiverem em uso:

```bash
# Pausar (Shutdown)
aws lambda invoke --function-name superseller-power-shutdown /dev/stdout

# Resumir (Startup)
aws lambda invoke --function-name superseller-power-startup /dev/stdout
```

**Nota**: Instale as dependências das Lambdas antes do primeiro deploy:

```bash
cd infra/lambda/power-shutdown && npm install && cd -
cd infra/lambda/power-startup && npm install && cd -
```

## Migração de ECS para App Runner

### ⚠️ IMPORTANTE: Procedimento de Migração

Se você está migrando de uma infraestrutura ECS existente:

1. **Backup do estado**: Faça backup do `terraform.tfstate`
2. **Destruir recursos ECS/ALB manualmente** (ou via terraform destroy seletivo):
   - `terraform state rm aws_ecs_service.api`
   - `terraform state rm aws_ecs_service.web`
   - `terraform state rm aws_ecs_task_definition.api`
   - `terraform state rm aws_ecs_task_definition.web`
   - `terraform state rm aws_ecs_cluster.main`
   - `terraform state rm aws_lb.main`
   - `terraform state rm aws_lb_target_group.api`
   - `terraform state rm aws_lb_target_group.web`
   - `terraform state rm aws_lb_listener.http`
   - `terraform state rm aws_lb_listener.https`
   - `terraform state rm aws_lb_listener_rule.api`
   - `terraform state rm aws_lb_listener_rule.web`
   - `terraform state rm aws_security_group.alb`
   - `terraform state rm aws_security_group.ecs`
3. **Aplicar nova infraestrutura**: `terraform apply`
4. **Atualizar DNS**: Os registros Route53 serão atualizados automaticamente

### O que foi mantido

- ✅ VPC e Subnets existentes
- ✅ RDS PostgreSQL (dados preservados)
- ✅ ECR (repositórios de imagens)
- ✅ Secrets Manager
- ✅ ACM (certificados SSL)
- ✅ Route53 (zona hospedada)

### O que foi removido

- ❌ ECS Cluster
- ❌ ECS Services (API/WEB)
- ❌ ECS Task Definitions
- ❌ Application Load Balancer
- ❌ ALB Target Groups
- ❌ ALB Listeners e Rules
- ❌ Security Groups do ALB e ECS

### O que foi criado

- ✅ App Runner Services (API/WEB)
- ✅ App Runner VPC Connector
- ✅ App Runner Auto Scaling Configuration
- ✅ IAM Roles para App Runner
- ✅ Security Group para VPC Connector

## Outputs

Após `terraform apply`, os seguintes outputs estarão disponíveis:

```bash
# URLs dos serviços
terraform output api_url
terraform output web_url

# URLs diretas do App Runner
terraform output apprunner_api_service_url
terraform output apprunner_web_service_url

# ARNs dos serviços (para CLI/automações)
terraform output apprunner_api_service_arn
terraform output apprunner_web_service_arn
```

## Estimativa de Custos (App Runner vs ECS)

| Recurso | ECS Fargate + ALB | App Runner |
|---------|-------------------|------------|
| Compute (API) | ~$15/mês | ~$5-10/mês* |
| Compute (WEB) | ~$15/mês | ~$5-10/mês* |
| Load Balancer | ~$16/mês | $0 (incluído) |
| **Total** | **~$46/mês** | **~$10-20/mês** |

*App Runner cobra por tempo de execução + requisições. Com baixo tráfego, os custos são significativamente menores.

## Troubleshooting

### Serviço não consegue conectar ao RDS

1. Verifique se o VPC Connector está usando as subnets corretas (privadas)
2. Verifique se o Security Group do RDS permite ingress do SG do App Runner
3. Verifique se a DATABASE_URL está correta no Secrets Manager

### Deploy falha com erro de permissão ECR

1. Verifique se a role `apprunner-ecr-access-role` tem permissão no ECR
2. Verifique se a imagem existe no ECR com a tag correta

### Custom domain não funciona

1. Aguarde a propagação DNS (pode levar até 48h)
2. Verifique os registros de validação no Route53
3. Use `enable_custom_domains = true` nas variáveis
