Contratos de API e Dados

Status: Atualizado (Pós-Implementação de IA e Vendas)

1. Visão Geral do Schema

O schema oficial (Single Source of Truth) está em apps/api/prisma/schema.prisma.
Este documento destaca as estruturas críticas implementadas recentemente e os padrões de integração.

2. Estruturas de Dados (Models Implementados)

A. Vendas e Pedidos (Mercado Livre)

Responsável pelo cálculo de GMV e histórico financeiro.

model Order {
  id              String      @id @default(uuid())
  tenantId        String
  marketplace     Marketplace // ENUM: MERCADOLIVRE, SHOPEE
  externalId      String      // ID do pedido no marketplace (ex: 20000...)
  totalAmount     Decimal     // Valor total da venda
  status          String      // paid, shipped, delivered, cancelled
  dateCreated     DateTime    // Data da venda original
  
  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([tenantId, externalId])
}

model OrderItem {
  id          String  @id @default(uuid())
  orderId     String
  listingId   String? // Relacionamento opcional com anúncio
  title       String
  quantity    Int
  unitPrice   Decimal
  sku         String?
  
  order       Order   @relation(fields: [orderId], references: [id])
}


B. Inteligência e Qualidade

Novos campos e tabelas para suportar o Super Seller Score e Recomendações.

Atualização em Listing:

model Listing {
  // ... campos existentes ...
  super_seller_score Int?   // 0 a 100
  score_breakdown    Json?  // { cadastro: 30, trafego: 10, ... }
  ai_analysis        Json?  // Cache da última análise do GPT
}


Nova Tabela Recommendation:

model Recommendation {
  id          String   @id @default(uuid())
  tenantId    String
  listingId   String
  type        String   // SEO, PRICE, PHOTO, STOCK
  priority    String   // HIGH, MEDIUM, LOW
  status      String   // PENDING, APPLIED, DISMISSED
  title       String   // "Melhore o título"
  description String   // "Seu título é muito curto..."
  ai_content  Json?    // Sugestões geradas pela IA (Novo Título, etc)
  
  listing     Listing  @relation(fields: [listingId], references: [id])
}


3. Endpoints da API (Rotas Chave)

Módulo de IA (Generative)

Status: GET /api/v1/ai/status

Retorna: { status: 'online', keyConfigured: true, model: 'gpt-4o' }

Analisar Anúncio: POST /api/v1/ai/analyze/:listingId

Payload: {} (Vazio)

Retorna: { score: 85, hacks: [...], suggested_title: "..." }

Módulo de Recomendações

Listar: GET /api/v1/recommendations?status=PENDING

Gerar (Forçar Análise): POST /api/v1/recommendations/generate

Aplicar/Resolver: PATCH /api/v1/recommendations/:id/apply

Módulo de Sync (Dados)

Sync Completo: POST /api/v1/sync/mercadolivre/full

Sync Pedidos: POST /api/v1/sync/mercadolivre/orders?days=30

4. Planejamento Futuro (Backlog)

Módulo de Publicidade (Ads) - Planejado

Para suportar gestão de Mercado Ads e Shopee Ads.

model AdCampaign {
  id            String   @id @default(uuid())
  tenantId      String
  marketplace   Marketplace
  externalId    String
  name          String
  status        String   // ACTIVE, PAUSED
  dailyBudget   Decimal
  roas          Decimal?
  
  metrics       AdMetric[]
}


5. Padrões e Convenções

IDs Externos: Sempre armazenados como String para evitar estouro de Inteiros (ex: IDs do ML são gigantes).

Valores Monetários: Sempre Decimal no Prisma e number (float) no TypeScript, cuidado com arredondamentos.

JSON Fields: Usar casting explícito as InputJsonValue no código ao salvar objetos complexos (ex: score_breakdown).