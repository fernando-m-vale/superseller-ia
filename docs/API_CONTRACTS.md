# Contratos de API e Dados

## 1. Estrutura do Banco de Dados (Prisma Schema)
*Atenção: A fonte da verdade é o arquivo `apps/api/prisma/schema.prisma`.*

### Principais Models (Resumo)
- **Tenant:** Unidade de conta (Multi-tenant).
- **User:** Usuários do sistema (Login via JWT).
- **Listing:** Anúncios importados (ML/Shopee). Campos chave: `externalId`, `title`, `price`, `status`, `healthScore`.
- **Recommendation:** Sugestões da IA. Campos: `type` (titulo, preco, imagem), `status` (pending, applied, rejected).

`schema.prisma` atual:

// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums
enum UserRole {
  owner
  manager
  operator
}

enum Marketplace {
  shopee
  mercadolivre
  amazon
  magalu
}

enum ConnectionStatus {
  active
  expired
  revoked
  error
}

enum ListingStatus {
  active
  paused
  closed
  sold_out
  draft
}

enum ListingQualityScore {
  poor
  fair
  good
  excellent
}

enum RecommendationType {
  title
  description
  images
  price
  shipping
  attributes
  stock
  cross_sell
}

enum RecommendationStatus {
  pending
  applied
  dismissed
}

enum SyncStatus {
  pending
  running
  completed
  failed
}

enum RuleStatus {
  active
  inactive
}

enum ActionType {
  title_optimization
  image_audit
  attribute_completion
  price_adjustment
  stock_update
}

// Models
model Tenant {
  id         String   @id @default(uuid())
  name       String
  created_at DateTime @default(now())

  users                   User[]
  marketplaceConnections  MarketplaceConnection[]
  listings                Listing[]
  recommendations         Recommendation[]
  syncJobs                SyncJob[]
  pricingRules            PricingRule[]
  listingActionOutcomes   ListingActionOutcome[]
}

model User {
  id         String   @id @default(uuid())
  email      String   @unique
  password   String
  name       String?
  role       UserRole @default(operator)
  created_at DateTime @default(now())
  tenant_id  String

  tenant Tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id])
}

model MarketplaceConnection {
  id               String            @id @default(uuid())
  tenant_id        String
  marketplace      Marketplace
  external_user_id String
  access_token     String
  refresh_token    String?
  token_expires_at DateTime?
  status           ConnectionStatus  @default(active)
  last_sync_at     DateTime?
  created_at       DateTime          @default(now())
  updated_at       DateTime          @updatedAt

  tenant Tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@unique([tenant_id, marketplace])
  @@index([tenant_id])
  @@index([marketplace])
}

model Listing {
  id                String                @id @default(uuid())
  tenant_id         String
  marketplace       Marketplace
  external_id       String
  title             String
  description       String?
  price             Decimal               @db.Decimal(10, 2)
  original_price    Decimal?              @db.Decimal(10, 2)
  available_quantity Int
  sold_quantity      Int                  @default(0)
  status            ListingStatus         @default(active)
  permalink         String?
  thumbnail         String?
  pictures          Json?
  attributes        Json?
  variations        Json?
  shipping          Json?
  tags              Json?
  health_score      ListingQualityScore?  @default(fair)
  health_issues     Json?
  created_at        DateTime              @default(now())
  updated_at        DateTime              @updatedAt
  last_synced_at    DateTime?

  tenant           Tenant                 @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  recommendations  Recommendation[]
  actionOutcomes   ListingActionOutcome[]

  @@unique([tenant_id, marketplace, external_id])
  @@index([tenant_id])
  @@index([marketplace])
  @@index([status])
  @@index([health_score])
}

model Recommendation {
  id              String               @id @default(uuid())
  tenant_id       String
  listing_id      String
  type            RecommendationType
  title           String
  description     String
  ai_explanation  String?
  status          RecommendationStatus @default(pending)
  created_at      DateTime             @default(now())
  applied_at      DateTime?
  dismissed_at    DateTime?

  tenant  Tenant  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  listing Listing @relation(fields: [listing_id], references: [id], onDelete: Cascade)

  @@index([tenant_id])
  @@index([listing_id])
  @@index([type])
  @@index([status])
}

model SyncJob {
  id            String      @id @default(uuid())
  tenant_id     String
  marketplace   Marketplace
  status        SyncStatus  @default(pending)
  started_at    DateTime?
  finished_at   DateTime?
  error_message String?
  created_at    DateTime    @default(now())

  tenant Tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id])
  @@index([marketplace])
  @@index([status])
}

model PricingRule {
  id                String      @id @default(uuid())
  tenant_id         String
  name              String
  description       String?
  status            RuleStatus  @default(active)
  marketplace       Marketplace
  min_margin        Decimal?    @db.Decimal(5, 2)
  max_discount      Decimal?    @db.Decimal(5, 2)
  competitor_ceiling Decimal?   @db.Decimal(5, 2)
  apply_automatically Boolean   @default(false)
  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt

  tenant Tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id])
  @@index([marketplace])
  @@index([status])
}

model ListingActionOutcome {
  id                  String      @id @default(uuid())
  tenant_id           String
  listing_id          String
  action_id           String
  action_type         ActionType
  old_price           Decimal?    @db.Decimal(10, 2)
  new_price           Decimal?    @db.Decimal(10, 2)
  old_title           String?
  new_title           String?
  old_stock           Int?
  new_stock           Int?
  views_before        Int?
  views_after         Int?
  sales_before        Int?
  sales_after         Int?
  revenue_before      Decimal?    @db.Decimal(10, 2)
  revenue_after       Decimal?    @db.Decimal(10, 2)
  effectiveness_score Decimal?    @db.Decimal(5, 2)
  executed_at         DateTime    @default(now())
  created_at          DateTime    @default(now())

  tenant  Tenant  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  listing Listing @relation(fields: [listing_id], references: [id], onDelete: Cascade)

  @@unique([tenant_id, action_id])
  @@index([tenant_id])
  @@index([listing_id])
  @@index([action_type])
  @@index([executed_at])
}
