Super Seller IA — Arquitetura & Segurança (MVP→V1)

Documento técnico com a visão de arquitetura, fluxos de dados, padrões de segurança/LGPD e desenho das APIs do MVP.

1) Objetivos de Arquitetura

Escalável e modular (conectores por marketplace)

Custo-eficiente (Serverless/App Runner com "scale to zero" possível)

Segurança e LGPD by design (mínimo necessário, criptografia, consentimento)

Observabilidade (telemetria de produto + logs + métricas)

DX boa: monorepo, CI/CD Automatizado, IaC (Terraform)

2) Diagrama lógico (Fluxo de Dados)

[Web (Next.js)]  ↔  [API (Fastify)]  ↔  [Core Services]
                                   ↙            ↘
                          [Connectors]         [Scoring/Actions]
                                 |                    |
                        [OAuth + SDKs]         [Rules + LLMs]
                                 |                    |
                      [Marketplaces APIs]       [Storage/DB]
                                 |                    |
                            [Logs/Eventos]     [Postgres (RDS)]


Principais componentes

Web: dashboard, action queue, relatórios

API: autenticação, conectores (ML/Shopee), scores, actions

Connectors: Responsáveis pelo OAuth, coleta de dados e aplicação de mudanças

Dados: RDS Postgres (operacional) em Subnet Privada

Infraestrutura: AWS App Runner gerenciado via Terraform

3) Serviços AWS (Implementação Atual)

Computação: AWS App Runner (API + Web)

Motivo: Menor custo operacional que ECS Fargate, gestão zero de clusters.

Banco de Dados: RDS PostgreSQL (Subnet Privada)

Acesso: Via VPC Connector do App Runner e Bastion Host.

Rede: VPC Customizada (us-east-2)

NAT Gateway: Para permitir que o App Runner acesse APIs externas (Mercado Livre).

VPC Connector: Para permitir que o App Runner acesse o RDS.

Secrets: AWS Secrets Manager (Credenciais OAuth, DB URL)

CI/CD: GitHub Actions + AWS OIDC (Deploy automático)

IaC: Terraform Modular

4) Segurança & LGPD

4.1 Princípios

Isolamento de Rede: Banco de dados inacessível publicamente. App Runner acessa via túnel privado.

Criptografia: HTTPS forçado (TLS), Secrets Manager para chaves.

Dados Sensíveis: Apenas access_token e refresh_token armazenados, criptografados ou protegidos pelo acesso ao banco.

5) Modelo de Dados (Schema Simplificado)

Tabelas principais

Tenant: Unidade de isolamento de clientes.

User: Usuários do sistema (Auth via JWT).

MarketplaceConnection: Armazena tokens OAuth.

Campos chave: tenant_id, type (Enum: MERCADOLIVRE, SHOPEE), access_token, refresh_token.

Listing: Anúncios importados.

Action: Recomendações geradas pela IA e status de execução.

6) Fluxo de Autenticação OAuth (Mercado Livre)

O fluxo segue o padrão Authorization Code para garantir segurança:

Frontend: Usuário clica em "Conectar".

Chama: GET /api/v1/auth/mercadolivre/connect

API: Gera URL segura e redireciona.

URL: https://auth.mercadolivre.com.br/authorization com client_id e state.

Mercado Livre: Usuário loga e autoriza.

Callback: ML redireciona de volta para a API.

Rota: GET /api/v1/auth/mercadolivre/callback?code=...

Troca de Token (Back-channel):

API chama POST api.mercadolibre.com/oauth/token (via NAT Gateway).

Recebe access_token e refresh_token.

Persistência: API salva/atualiza na tabela marketplace_connections.

Finalização: API redireciona usuário para Dashboard (success=true).

7) Topologia de Rede (Diagrama AWS)

Visualização da infraestrutura implementada via Terraform:

graph TD
    User[Usuário / Internet] -->|HTTPS| AppRunner[AWS App Runner (API + Web)]
    
    subgraph VPC [VPC - us-east-2]
        subgraph PublicSubnet [Subnets Públicas]
            NAT[NAT Gateway]
            IGW[Internet Gateway]
        end
        
        subgraph PrivateSubnet [Subnets Privadas]
            Connector[VPC Connector]
            RDS[(RDS PostgreSQL)]
        end
    end
    
    AppRunner -->|VPC Connector| RDS
    AppRunner -->|VPC Connector| NAT
    NAT --> IGW -->|API Calls| ML[API Mercado Livre]


8) Estratégia de Jobs e Workers

Atualmente (MVP): Processamento síncrono ou disparado por cron externo.
Futuro: Implementação de filas (SQS) para processamento assíncrono de:

Ingestão de anúncios (Sync)

Cálculo de Health Score

Execução de ações em massa

9) Observabilidade

Logs: CloudWatch Logs (Integrado nativamente ao App Runner).

Health Checks:

API: /api/v1/health

Monitoramento de uptime via Console AWS.

10) Roadmap técnico (MVP → V1)

[x] Infraestrutura Core (App Runner + RDS)

[x] Autenticação de Usuários

[x] Integração OAuth Mercado Livre (Conexão)

[ ] Integração OAuth Shopee

[ ] Sync de Anúncios (Job de Ingestão)

[ ] Motor de Recomendação (IA)

[ ] Dashboard Analítico

11) Checklists de Segurança (MVP)

[x] Secrets no AWS Secrets Manager

[x] Banco de dados em Subnet Privada

[x] HTTPS/TLS forçado

[x] Validação de Schemas (Zod) na API

[ ] Rotação de chaves periódica