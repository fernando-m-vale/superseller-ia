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
