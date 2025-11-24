# Power Control – Liga/Desliga Ambiente ECS (Prod)

Este módulo implementa duas AWS Lambdas para reduzir custos do ambiente de produção,
permitindo ligar e desligar rapidamente os serviços ECS do Super Seller IA.

## Visão geral

- **Lambda `superseller-power-shutdown`**
  - Seta `desiredCount = 0` nos serviços ECS:
    - `superseller-api-svc`
    - `superseller-web-svc`
  - Resultado: nenhuma task em execução → custo de Fargate praticamente zero.

- **Lambda `superseller-power-startup`**
  - Seta `desiredCount = 1` nos mesmos serviços ECS.
  - Resultado: ambiente volta a ficar disponível (API + Web).

Não há banco de dados RDS na arquitetura atual, então nenhuma ação é necessária sobre DB.

## Localização no código

- Código Lambda:
  - `infra/lambda/power-shutdown/index.js`
  - `infra/lambda/power-startup/index.js`
- Terraform:
  - `infra/terraform/prod/lambda-power-control.tf`

## Variáveis de ambiente utilizadas

Em ambas as funções:

- `AWS_REGION` → região AWS (ex.: `us-east-2`)
- `CLUSTER_NAME` → nome do cluster ECS, ex.: `superseller-prod-cluster`
- `ECS_SERVICES` → lista JSON de serviços ECS gerenciados, ex.:

```json
["superseller-api-svc", "superseller-web-svc"]
