# Contratos de API e Dados
**Status:** Planejamento de Expansão

## 1. Schema Atual (Referência)
*O schema real encontra-se em `apps/api/prisma/schema.prisma`.*
Este arquivo documenta as *extensões planejadas* para suportar as novas funcionalidades.

## 2. Extensões Planejadas (Novos Models)

### A. Módulo de Publicidade (Ads)
Para suportar gestão de Mercado Ads e Shopee Ads.

```prisma
model AdCampaign {
  id            String   @id @default(uuid())
  tenantId      String
  marketplace   Marketplace // ENUM: MERCADOLIVRE, SHOPEE
  externalId    String   // ID da campanha no marketplace
  name          String
  status        String   // ACTIVE, PAUSED
  dailyBudget   Decimal
  acosTarget    Decimal? // Advertising Cost of Sales alvo
  roas          Decimal? // Return on Ad Spend atual
  
  metrics       AdMetric[]
  listings      Listing[] // Relacionamento com anúncios
  createdAt     DateTime @default(now())
}

model AdMetric {
  id            String   @id @default(uuid())
  campaignId    String
  date          DateTime
  clicks        Int
  impressions   Int
  cost          Decimal
  sales         Decimal
  campaign      AdCampaign @relation(fields: [campaignId], references: [id])
}


Contratos de API e Dados

1. Padrões de Banco de Dados (Prisma)

IMPORTANTE: O banco de dados utiliza convenção snake_case para chaves estrangeiras e campos mapeados de APIs externas.

Model: MarketplaceConnection

Campos mapeados (TypeScript -> Banco):

tenantId (No código) -> tenant_id (No Prisma/Banco)

providerAccountId -> provider_account_id

accessToken -> access_token

refreshToken -> refresh_token

expiresAt -> expires_at

Sempre verifique o schema.prisma antes de criar queries prisma.create ou prisma.update.

2. Rotas de Integração (Mercado Livre)

Definição Final (Pós PR #57)

Initiate: GET /api/v1/auth/mercadolivre/connect

Response: JSON { "authUrl": "..." } ou Redirect 302 (dependendo da implementação final).

Callback: GET /api/v1/auth/mercadolivre/callback

Webhooks: POST /api/v1/webhooks/mercadolivre