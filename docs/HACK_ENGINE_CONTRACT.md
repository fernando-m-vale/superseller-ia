# HackEngine v1 — Contrato e Documentação

**DIA 09 — SuperSeller IA**

## 📋 Visão Geral

O HackEngine v1 é um sistema determinístico que gera hacks específicos e acionáveis baseados em signals extraídos de um anúncio. O engine é 100% determinístico, baseado apenas em dados auditáveis, sem uso de LLM para decisões.

### Filosofia

- **100% determinístico:** Todas as decisões são baseadas em regras explícitas e dados auditáveis
- **Baseado em dados reais:** Signals extraídos diretamente do listing, pricing, shipping, metrics e benchmark
- **Nenhum hack genérico:** Cada hack é específico ao anúncio analisado
- **Pode retornar 0 hacks:** Se nenhuma regra for disparada, nenhum hack é sugerido
- **Respeita histórico do usuário:** Hacks confirmados nunca são sugeridos novamente; hacks descartados têm cooldown de 30 dias
- **Preparado para automação:** Estrutura permite futura integração com APIs do Mercado Livre

---

## 🔌 Contratos TypeScript

### ListingSignals

```typescript
interface ListingSignals {
  status: 'active' | 'paused' | 'closed' | 'unknown';
  categoryId?: string;
  categoryPath?: string[];
  isCatalog?: boolean;

  price: number;
  originalPrice?: number | null;
  hasPromotion: boolean;
  discountPercent?: number | null;
  currency: 'BRL';

  availableQuantity?: number | null;
  isOutOfStock?: boolean;

  shippingMode?: 'full' | 'flex' | 'me2' | 'unknown';
  isFreeShipping?: boolean;
  isFullEligible?: boolean;

  picturesCount?: number;
  hasVideo?: boolean;
  hasClips?: boolean;

  variationsCount?: number;
  hasVariations?: boolean;
  isKitHeuristic?: boolean;

  metrics30d?: {
    visits?: number | null;
    orders?: number | null;
    revenue?: number | null;
    conversionRate?: number | null;
  };

  benchmark?: {
    medianPrice?: number | null;
    p25Price?: number | null;
    p75Price?: number | null;
  };

  debug?: Record<string, unknown>;
}
```

### HackEngineInput

```typescript
interface HackEngineInput {
  version: 'v1';
  marketplace: 'mercadolivre';
  tenantId: string;
  listingId: string;
  listingIdExt?: string;
  signals: ListingSignals;
  history?: Array<{
    hackId: string;
    status: 'confirmed' | 'dismissed';
    dismissedAt?: Date | null;
  }>;
  nowUtc: Date;
}
```

### HackEngineOutput

```typescript
interface HackEngineOutput {
  version: 'v1';
  listingId: string;
  generatedAtUtc: Date;
  hacks: HackSuggestion[];
  meta: HackEngineMeta;
}

interface HackSuggestion {
  id: HackId;
  title: string;
  summary: string;
  why: string[];
  impact: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  evidence: string[];
  // HOTFIX 09.5: CTA opcional para tornar o hack acionável no painel
  suggestedActionUrl?: string | null;
}

interface HackEngineMeta {
  rulesEvaluated: number;
  rulesTriggered: number;
  skippedBecauseOfHistory: number;
  skippedBecauseOfRequirements: number;
}

type HackId = 
  | 'ml_full_shipping'
  | 'ml_bundle_kit'
  | 'ml_smart_variations'
  | 'ml_category_adjustment'
  | 'ml_psychological_pricing';

type ConfidenceLevel = 'low' | 'medium' | 'high';
```

---

## 🎨 UX 2.0 — Padrão do Card

**Data:** HOTFIX DIA 09.5 (UX + Qualidade Estratégica)

### Hierarquia Visual

Os hacks são exibidos em cards de decisão com hierarquia visual forte:

1. **Impacto (forte)** — Badge destacado com cor por nível (Alto/Médio/Baixo)
2. **Confiança (discreta + tooltip)** — Badge suave com ícone de informação explicativa
3. **Opportunity Score** — Badge "Opportunity X/100" calculado como `(confidence * 0.6) + (impactWeight * 0.4)`
4. **Evidências em mini dashboard (grid)** — Até 6 itens em grid responsivo (2 colunas mobile, 3 desktop)
5. **Diagnóstico** — Caixa destacada com ícone de alerta
6. **Recomendação objetiva** — Caixa com borda primária contendo:
   - Texto principal da recomendação
   - Sugestão (opcional, em caixa aninhada)
   - Nota (opcional, em itálico)
7. **CTAs com ação direta** — Botões com stopPropagation para evitar conflito com Accordion

### Campos Exibidos

#### Header
- Título do hack
- Badge de prioridade (#1, #2, etc.) — opcional
- Badge de Impacto (Alto/Médio/Baixo)
- Badge de Opportunity Score (X/100)
- Badge de Confidence (X% Alta/Média/Baixa) + tooltip

#### Diagnóstico
- Texto explicativo do problema/oportunidade (opcional)

#### Evidências (Grid)
- Até 6 itens em formato `{ label, formatted }`
- Grid responsivo: 2 colunas (mobile) / 3 colunas (desktop)
- Cada item em card com borda

#### Recomendação
- Texto principal (obrigatório)
- Sugestão (opcional, em caixa aninhada)
- Nota (opcional, em itálico)

#### CTAs
- Ações externas (links para Mercado Livre) — opcional
- Botão "Confirmar implementação" (primário)
- Botão "Não se aplica" (outline)

### Melhorias Específicas

#### Hack de Categoria (ml_category_adjustment)
- **Exibição:** Mostra `categoryPath` (breadcrumb) quando disponível, caso contrário mostra `categoryId` com nota "clique para revisar no ML"
- **Recomendação:** Não afirma "incorreta" sem evidência forte; usa "verificar se está na subcategoria mais específica"
- **Evidências:** Inclui comparação de conversão (atual vs baseline) quando disponível

#### Consistência Clip vs Vídeo
- Sempre usar "clip" (não "vídeo") na UI
- Não sugerir adicionar clip quando `hasClips === true`

---

## 🎯 Opportunity Score (Frontend v1) — HOTFIX 09.6

O Opportunity Score é uma métrica calculada no frontend que combina Impact, Confidence e Gap Score para ordenar e priorizar hacks. É usado para destacar os Top 3 hacks com maior potencial de resultado.

### Fórmula

```
OpportunityScore = clamp(round(0.45 * ImpactScore + 0.35 * Confidence + 0.20 * GapScore), 0..100)
```

### Componentes

#### Impact Score (0-100)
- `high` = 90
- `medium` = 65
- `low` = 35

#### Gap Score (0-100)
Indica o "gap" entre performance atual e potencial:

**Visits Score:**
- `visits >= 300` => 40
- `visits >= 200` => 30
- `visits >= 100` => 15
- `else` => 5

**CR Penalty Score:**
- `conversionRate < 0.01` (1%) => 40
- `conversionRate < 0.02` (2%) => 25
- `conversionRate < 0.03` (3%) => 10
- `else` => 5

**Orders Score:**
- `orders == 0` => 20
- `orders <= 2` => 12
- `orders <= 10` => 6
- `else` => 2

**GapScore = clamp(visitsScore + crPenaltyScore + ordersScore, 0..100)**

### Labels e Variantes

- **Score >= 75:** "🔥 Alta oportunidade" (badge `default`)
- **Score 50-74:** "Boa oportunidade" (badge `secondary`)
- **Score < 50:** "Oportunidade baixa (revisar contexto)" (badge `outline`)

### Ordenação

Os hacks são ordenados por:
1. **Opportunity Score** (descendente)
2. **Impact** (high > medium > low)
3. **Confidence** (descendente)
4. **Hack ID** (ascendente, para estabilidade)

### Prioridade

- **Top 3:** Hacks com maior Opportunity Score aparecem primeiro na seção "🔥 Prioridades (Top 3)"
- **Outros:** Hacks restantes aparecem na seção "Outros hacks"
- **Confirmados:** Hacks já aplicados aparecem na seção "Já aplicados" (no final)

### Implementação

- **Helper:** `apps/web/src/lib/hacks/opportunityScore.ts`
- **Cálculo:** Executado no `HacksPanel` antes da renderização
- **Exibição:** Badge no `HackCardUX2` com label e variante baseados no score

---

## 📊 Bandas de Confidence

O HackEngine usa bandas fixas para classificar confidence:

- **0-39:** `low` (Baixa)
- **40-69:** `medium` (Média)
- **70-100:** `high` (Alta)

A confidence é calculada através de pontuação determinística baseada em signals. Cada hack tem suas próprias regras de pontuação.

### Como Interpretar Confidence

**Confidence (Confiança)** é a confiança do sistema na recomendação, baseada nos dados do anúncio (visitas, conversão, preço, mídia etc.).

- **Alta (≥70%):** Recomendação muito confiável. O sistema tem evidências fortes de que a ação trará resultados positivos.
- **Média (40-69%):** Recomendação moderadamente confiável. O sistema tem evidências moderadas, mas pode haver fatores não considerados.
- **Baixa (0-39%):** Recomendação com baixa confiança. O sistema tem poucas evidências ou há fatores que reduzem a confiabilidade.

**Nota:** Confidence não é uma garantia de sucesso, mas sim uma medida de quão bem os dados do anúncio se alinham com as regras determinísticas do hack.

---

## 🎯 Regras de Histórico

### Confirmed (Confirmado)

- **Regra:** Se um hack foi marcado como `confirmed`, ele **nunca** será sugerido novamente para aquele listing
- **Persistência:** Status `confirmed` é permanente até que o listing seja deletado ou o registro seja removido manualmente

### Dismissed (Descartado)

- **Regra:** Se um hack foi marcado como `dismissed`, ele não será sugerido por **30 dias** (cooldown)
- **Após 30 dias:** O hack pode ser reavaliado e sugerido novamente se as condições ainda forem atendidas
- **Cálculo:** `daysSinceDismissed = (nowUtc - dismissedAt) / (1000 * 60 * 60 * 24)`
- **Cooldown:** `daysSinceDismissed < 30` → não sugerir

---

## 🚀 Hacks Implementados

### Hack 1: ml_full_shipping

**ID:** `ml_full_shipping`

**Título:** "Ativar Frete Grátis Full"

**Resumo:** Ativar frete grátis Full pode aumentar significativamente a visibilidade e conversão do anúncio.

**Impact:** `high`

**Gates (Omitir se):**
- `shippingMode === 'full'` → omitir completamente
- `shippingMode === 'unknown'` E `isFullEligible !== true` → omitir completamente (HOTFIX 09.1: genérico e inseguro)
- `isFullEligible === false` → blocking=true, cap confidence ≤ 35

**Regras Especiais (HOTFIX 09.1):**
- Se `shippingMode === 'unknown'` MAS `isFullEligible === true`:
  - Permitir sugerir, mas com confidence cap ≤ 35
  - blocking=false (não é blocking, mas precisa de atenção)
  - Mensagem deve indicar: "Não foi possível confirmar o modo atual; Full é elegível"

**Pontuação:**

| Condição | Pontos |
|----------|--------|
| visits ≥ 300 | +25 |
| conversionRate < 2% | +20 |
| shippingMode = me2/unknown | +15 |
| isFreeShipping = false | +10 |
| estoque ≥ 5 ou null | +10 |
| visits < 100 | -20 |
| outOfStock ou qty = 0 | -15 |
| price < 30 | -10 |

**Evidências:**
- Modo de envio atual
- Visitas (30d)
- Taxa de conversão

---

### Hack 2: ml_bundle_kit

**ID:** `ml_bundle_kit`

**Título:** "Criar Kit/Combo"

**Resumo:** Criar um kit ou combo pode aumentar o ticket médio e diferenciar o anúncio da concorrência.

**Impact:** `medium` (se confidence ≥ 70) ou `high` (se confidence ≥ 70)

**Gates (Omitir se):**
- `isKitHeuristic === true` → omitir completamente

**Pontuação:**

| Condição | Pontos |
|----------|--------|
| visits ≥ 200 | +25 |
| conversionRate < 1.5% | +20 |
| price ≤ 120 | +15 |
| qty ≥ 10 | +10 |
| variationsCount ≥ 2 | +10 |
| promo ≥ 20% | +10 |
| qty ≤ 2 | -20 |
| orders ≥ 15 e CR ≥ 3% | -15 |
| isCatalog = true | -10 |

**Evidências:**
- Visitas (30d)
- Taxa de conversão
- Preço atual

---

### Hack 3: ml_smart_variations

**ID:** `ml_smart_variations`

**Título:** "Adicionar Variações Inteligentes"

**Resumo:** Adicionar variações (tamanho, cor, modelo) pode aumentar significativamente as vendas.

**Impact:** `medium`

**Pontuação:**

| Condição | Pontos |
|----------|--------|
| visits ≥ 200 | +25 |
| CR < 2% | +20 |
| hasVariations = false | +15 |
| picturesCount ≥ 6 | +10 |
| categoryId presente | +10 |
| qty ≥ 5 | +10 |
| variationsCount ≥ 5 | -25 |
| picturesCount < 4 | -15 |
| visits < 80 | -15 |

**Evidências:**
- Visitas (30d)
- Taxa de conversão
- Imagens

---

### Hack 4: ml_category_adjustment

**ID:** `ml_category_adjustment`

**Título (HOTFIX 09.5):** pode variar conforme evidências
- Com baseline de conversão disponível: "Revisar Categoria (baseado em conversão)"
- Sem baseline: "Verificar Categoria Específica" (não afirma erro)

**Resumo (HOTFIX 09.5):**
- Com baseline: compara conversão do anúncio vs baseline da categoria e sugere revisão quando há descolamento relevante
- Sem baseline: recomenda validação manual (sem afirmar que está errada)

**Impact:** `medium`

**Gates (Omitir se):**
- `categoryId` ausente → blocking=true, cap confidence ≤ 40

**Pontuação:**

| Condição | Pontos |
|----------|--------|
| visits ≥ 300 e orders = 0 | +30 |
| CR < 1% e visits ≥ 200 | +25 |
| categoryPath depth ≤ 2 | +15 |
| isCatalog = false | +10 |
| benchmark presente e preço dentro p25..p75 | +10 |
| orders ≥ 10 | -20 |
| visits < 100 | -15 |

**Evidências:**
- Categoria atual (breadcrumb textual quando disponível; evita exibir apenas MLBxxxx)
- Visitas (30d)
- Pedidos (30d)
- (quando disponível) Conversão atual (%)
- (quando disponível) Baseline de conversão da categoria (%)

---

### Hack 5: ml_psychological_pricing

**ID:** `ml_psychological_pricing`

**Título:** "Ajustar Preço Psicológico"

**Resumo:** Preços que terminam em .90 ou .99 são percebidos como mais atrativos pelos consumidores.

**Impact:** `low` (se confidence < 70) ou `medium` (se confidence ≥ 70)

**Gates (Omitir se):**
- `price < 20` → omitir completamente
- Preço já termina em `.90`, `.99` ou `.89` → omitir completamente

**Pontuação:**

| Condição | Pontos |
|----------|--------|
| visits ≥ 300 | +25 |
| CR < 2% | +20 |
| preço redondo (.00/.50) | +15 |
| benchmark median e price até 10% acima | +15 |
| sem promoção | +10 |
| discount ≥ 30% | -20 |
| orders ≥ 15 | -15 |
| visits < 120 | -15 |

**Evidências:**
- Preço atual
- Visitas (30d)
- Taxa de conversão

---

## 🔍 isKitHeuristic

Função determinística que identifica se um listing é um kit/combo baseado em heurísticas.

**Regras:**

1. **Palavras-chave no título (case-insensitive):**
   - `kit`
   - `combo`
   - `conjunto`
   - `c/`

2. **Variações + palavras de múltiplos itens:**
   - Se `variationsCount >= 2` E título contém:
     - `+`
     - `e`
     - `com`
     - `pack`
     - `pacote`
     - `lote`

**Retorno:** `boolean`

**Sem LLM:** Totalmente determinístico, baseado apenas em análise de string.

---

## 📡 Payload no Analyze

O HackEngine é integrado no endpoint `/api/v1/ai/analyze/:listingId` e retorna hacks no payload:

```json
{
  "message": "Análise concluída com sucesso",
  "data": {
    "listingId": "...",
    "score": 75,
    "analysisV21": { ... },
    "growthHacks": [
      {
        "id": "ml_full_shipping",
        "title": "Ativar Frete Grátis Full",
        "summary": "...",
        "why": [ ... ],
        "impact": "high",
        "confidence": 82,
        "confidenceLevel": "high",
        "evidence": [ ... ]
      }
    ],
    "growthHacksMeta": {
      "rulesEvaluated": 5,
      "rulesTriggered": 2,
      "skippedBecauseOfHistory": 1,
      "skippedBecauseOfRequirements": 2
    }
  }
}
```

---

## 🔄 Endpoints de Feedback

### POST /api/v1/listings/:listingId/hacks/:hackId/feedback

Registra feedback do usuário sobre um hack sugerido.

**Payload:**
```json
{
  "status": "confirmed" | "dismissed",
  "notes": "string (opcional)"
}
```

**Response (200 OK):**
```json
{
  "message": "Feedback registrado com sucesso",
  "data": {
    "listingId": "...",
    "hackId": "ml_full_shipping",
    "status": "confirmed",
    "notes": null
  }
}
```

**Regras:**
- Upsert: atualiza se existir, cria se não existir
- `confirmed_at` é preenchido quando `status === 'confirmed'`
- `dismissed_at` é preenchido quando `status === 'dismissed'`
- Validação: listing deve pertencer ao tenant

---

## 📝 Exemplos de JSON

### Exemplo 1: Input com signals completos

```json
{
  "version": "v1",
  "marketplace": "mercadolivre",
  "tenantId": "tenant-123",
  "listingId": "listing-456",
  "listingIdExt": "MLB1234567890",
  "signals": {
    "status": "active",
    "categoryId": "MLB1234",
    "categoryPath": ["Eletrônicos", "Celulares"],
    "price": 299.90,
    "originalPrice": 399.90,
    "hasPromotion": true,
    "discountPercent": 25,
    "currency": "BRL",
    "availableQuantity": 10,
    "isOutOfStock": false,
    "shippingMode": "me2",
    "isFreeShipping": false,
    "isFullEligible": true,
    "picturesCount": 8,
    "hasVideo": false,
    "hasClips": null,
    "variationsCount": 0,
    "hasVariations": false,
    "isKitHeuristic": false,
    "metrics30d": {
      "visits": 450,
      "orders": 5,
      "revenue": 1499.50,
      "conversionRate": 1.11
    },
    "benchmark": {
      "medianPrice": 320.00,
      "p25Price": 280.00,
      "p75Price": 350.00
    }
  },
  "history": [],
  "nowUtc": "2026-02-19T10:00:00Z"
}
```

### Exemplo 2: Output com hacks gerados

```json
{
  "version": "v1",
  "listingId": "listing-456",
  "generatedAtUtc": "2026-02-19T10:00:00Z",
  "hacks": [
    {
      "id": "ml_full_shipping",
      "title": "Ativar Frete Grátis Full",
      "summary": "Ativar frete grátis Full pode aumentar significativamente a visibilidade e conversão do anúncio.",
      "why": [
        "Frete grátis é um dos principais fatores de decisão de compra no Mercado Livre",
        "Anúncios com frete grátis aparecem em destaque nas buscas",
        "Aumenta a taxa de conversão e reduz o abandono de carrinho"
      ],
      "impact": "high",
      "confidence": 82,
      "confidenceLevel": "high",
      "evidence": [
        "Modo de envio atual: me2",
        "Visitas (30d): 450",
        "Taxa de conversão: 1.11%"
      ]
    },
    {
      "id": "ml_psychological_pricing",
      "title": "Ajustar Preço Psicológico",
      "summary": "Preços que terminam em .90 ou .99 são percebidos como mais atrativos pelos consumidores.",
      "why": [
        "Preços psicológicos aumentam a percepção de valor",
        "Melhoram a taxa de conversão",
        "Diferenciação visual na listagem de resultados"
      ],
      "impact": "medium",
      "confidence": 65,
      "confidenceLevel": "medium",
      "evidence": [
        "Preço atual: R$ 299.90",
        "Visitas (30d): 450",
        "Taxa de conversão: 1.11%"
      ]
    }
  ],
  "meta": {
    "rulesEvaluated": 5,
    "rulesTriggered": 2,
    "skippedBecauseOfHistory": 0,
    "skippedBecauseOfRequirements": 3
  }
}
```

### Exemplo 3: Input com histórico (hack confirmado)

```json
{
  "version": "v1",
  "marketplace": "mercadolivre",
  "tenantId": "tenant-123",
  "listingId": "listing-456",
  "signals": { ... },
  "history": [
    {
      "hackId": "ml_full_shipping",
      "status": "confirmed",
      "confirmedAt": "2026-02-15T10:00:00Z"
    }
  ],
  "nowUtc": "2026-02-19T10:00:00Z"
}
```

**Output esperado:** `ml_full_shipping` não aparece em `hacks[]`, `meta.skippedBecauseOfHistory = 1`

### Exemplo 4: Input com histórico (hack descartado há 15 dias)

```json
{
  "version": "v1",
  "marketplace": "mercadolivre",
  "tenantId": "tenant-123",
  "listingId": "listing-456",
  "signals": { ... },
  "history": [
    {
      "hackId": "ml_bundle_kit",
      "status": "dismissed",
      "dismissedAt": "2026-02-04T10:00:00Z"
    }
  ],
  "nowUtc": "2026-02-19T10:00:00Z"
}
```

**Output esperado:** `ml_bundle_kit` não aparece em `hacks[]`, `meta.skippedBecauseOfHistory = 1` (cooldown ativo)

---

## 🧪 Testes Unitários

### SignalsBuilder

**Teste 1: isKitHeuristic com palavra-chave**
```typescript
const listing = { title: "Kit Completo de Ferramentas", ... };
expect(isKitHeuristic(listing)).toBe(true);
```

**Teste 2: isKitHeuristic com variações**
```typescript
const listing = { title: "Produto A + Produto B", ... };
expect(isKitHeuristic(listing, 2)).toBe(true);
```

**Teste 3: isKitHeuristic negativo**
```typescript
const listing = { title: "Produto Simples", ... };
expect(isKitHeuristic(listing, 0)).toBe(false);
```

### HackEngine

**Teste 1: ml_full_shipping dispara**
```typescript
const signals = {
  shippingMode: 'me2',
  isFullEligible: true,
  metrics30d: { visits: 400, conversionRate: 1.5 },
  availableQuantity: 10,
  price: 50,
  isOutOfStock: false,
};
const result = evaluateMlFullShipping(signals);
expect(result.shouldOmit).toBe(false);
expect(result.score).toBeGreaterThan(0);
```

**Teste 2: ml_full_shipping omite (shippingMode = full)**
```typescript
const signals = { shippingMode: 'full', ... };
const result = evaluateMlFullShipping(signals);
expect(result.shouldOmit).toBe(true);
```

**Teste 3: ml_bundle_kit omite (isKitHeuristic = true)**
```typescript
const signals = { isKitHeuristic: true, ... };
const result = evaluateMlBundleKit(signals);
expect(result.shouldOmit).toBe(true);
```

**Teste 4: Cooldown 30 dias**
```typescript
const history = [{
  hackId: 'ml_full_shipping',
  status: 'dismissed',
  dismissedAt: new Date('2026-01-20'),
}];
const nowUtc = new Date('2026-02-19'); // 30 dias depois
expect(isHackInCooldown(history, 'ml_full_shipping', nowUtc)).toBe(false);
```

**Teste 5: Cooldown ativo (< 30 dias)**
```typescript
const history = [{
  hackId: 'ml_full_shipping',
  status: 'dismissed',
  dismissedAt: new Date('2026-02-04'),
}];
const nowUtc = new Date('2026-02-19'); // 15 dias depois
expect(isHackInCooldown(history, 'ml_full_shipping', nowUtc)).toBe(true);
```

---

## 🔗 Integração

### Backend

1. **SignalsBuilder** (`apps/api/src/services/SignalsBuilder.ts`)
   - Extrai signals determinísticos de um listing
   - Implementa `isKitHeuristic`
   - **HOTFIX 09.2:** `variationsCount` extraído de `listing.variations_count` (fonte de verdade persistida no sync ML)
   - **Fonte de variationsCount:** Campo `variations_count` no model Listing, extraído do `item.variations` durante sync ML

2. **HackEngine** (`apps/api/src/services/HackEngine.ts`)
   - Gera hacks baseados em signals
   - Aplica regras de histórico (confirmed/dismissed)

3. **ListingHacksService** (`apps/api/src/services/ListingHacksService.ts`)
   - Persiste feedback do usuário
   - Busca histórico de hacks

4. **Endpoint analyze** (`apps/api/src/routes/ai-analyze.routes.ts`)
   - Integra HackEngine no fluxo de análise
   - Retorna `growthHacks` e `growthHacksMeta` no payload
   - **HOTFIX 09.2:** Novo endpoint `GET /api/v1/ai/analyze/:listingId/latest`
     - Retorna última análise sem chamar OpenAI
     - Validação: se analyzedAt < now-7d => retorna 404
     - Payload idêntico ao POST analyze mas com `meta.fetchOnly=true`

5. **Endpoint feedback** (`apps/api/src/routes/listings.ts`)
   - `POST /api/v1/listings/:listingId/hacks/:hackId/feedback`
   - Registra feedback do usuário

### Frontend

1. **HacksPanel** (`apps/web/src/components/ai/HacksPanel.tsx`)
   - Componente React para exibir hacks
   - Botões "Confirmar implementação" e "Não se aplica"
   - Badges de impact e confidence

2. **ListingAIAnalysisPanel** (`apps/web/src/components/listings/ListingAIAnalysisPanel.tsx`)
   - Integra HacksPanel na análise
   - Passa props `growthHacks` e `growthHacksMeta`

3. **Hook use-ai-analyze** (`apps/web/src/hooks/use-ai-analyze.ts`)
   - Tipos atualizados para incluir `growthHacks` e `growthHacksMeta`

---

## 📊 Tabela Resumo de Regras

| Hack ID | Título | Impact | Gates | Confidence Range |
|---------|--------|--------|-------|------------------|
| `ml_full_shipping` | Ativar Frete Grátis Full | high | shippingMode=full → omit<br>shippingMode=unknown + isFullEligible≠true → omit<br>isFullEligible=false → cap≤35 | 0-100 (cap 35 se blocking ou unknown) |
| `ml_bundle_kit` | Criar Kit/Combo | medium/high | isKitHeuristic=true → omit | 0-100 |
| `ml_smart_variations` | Adicionar Variações | medium | - | 0-100 |
| `ml_category_adjustment` | Ajustar Categoria | medium | categoryId ausente → cap≤40 | 0-100 (cap 40 se blocking) |
| `ml_psychological_pricing` | Ajustar Preço Psicológico | low/medium | price<20 → omit<br>termina .90/.99/.89 → omit | 0-100 |

---

## 🎯 Critérios de Aceite (DoD DIA 09)

- ✅ Hacks aparecem para um anúncio real
- ✅ Confidence coerente com regras (bandas 0-39/40-69/70-100)
- ✅ Feedback persistido e respeitado (confirmed nunca sugere, dismissed 30d cooldown)
- ✅ Engine nunca sugere hack dismissed (<30d) ou confirmed
- ✅ Documentação completa gerada
- ✅ Testes unitários determinísticos
- ✅ UI com confirmação e estado persistido
- ✅ Build verde (API e WEB)

---

## 📚 Referências

- **Arquitetura:** `docs/ARCHITECTURE_DECISIONS.md`
- **Log de execução:** `docs/DAILY_EXECUTION_LOG.md`
- **Próximos passos:** `docs/NEXT_SESSION_PLAN.md`

---

**Versão:** 1.2 (HOTFIX 09.5 + 09.6)  
**Data:** 2026-02-XX  
**Status:** ✅ Implementado (validação PROD pendente)

---

## 🔧 Operational Notes

### Category Breadcrumb Service

**Cache:** TTL de 24h (in-memory singleton)

**Degradação graciosa:**
- Se API ML (`GET /categories/{id}`) falhar (timeout, 404, 500, etc):
  - Sistema continua sem breadcrumb (não bloqueia análise)
  - Log de warning registrado
  - Hack de categoria ainda pode ser sugerido, mas sem breadcrumb textual
  - Evidência exibirá `categoryId` (ex: "MLB1234") ou mensagem clara

**Como verificar se cache está funcionando:**
- Logs: `[CATEGORY-BREADCRUMB]` prefix
- Stats: `getCategoryBreadcrumbCacheStats()` (helper disponível para debug)

**Limpeza de cache:**
- Cache expira automaticamente após 24h
- Função `clearCategoryBreadcrumbCache()` disponível para testes/limpeza manual

### ML API Rate Limits

**Benchmark Service:**
- Se API ML retornar 403 (rate limit ou token expirado):
  - Benchmark fica opcional (não bloqueia análise)
  - Hack de categoria pode ser sugerido sem comparação de conversão
  - Mensagem: "Sem baseline suficiente para afirmar erro. Vale validar se a categoria está específica e correta."

**Category Breadcrumb:**
- Se API ML retornar 403 ou timeout:
  - Breadcrumb não é resolvido (não bloqueia análise)
  - Hack de categoria ainda pode ser sugerido, mas sem breadcrumb textual

### Frontend — Opportunity Score

**Cálculo:** Executado no frontend (não no backend)

**Dependências:**
- `metrics30d` deve ser passado para `HacksPanel` via props
- Se `metrics30d` não estiver disponível, Gap Score será baixo (mas não quebra)

**Fallback:**
- Se `opportunityScore` não vier calculado, `HackCardUX2` usa fallback simples:
  - `Math.round(confidence * 0.6 + (impact === 'high' ? 90 : impact === 'medium' ? 65 : 35) * 0.4)`
  - Não ideal, mas evita erro de renderização

---

**Versão:** 1.2 (HOTFIX 09.5 + 09.6)  
**Data:** 2026-02-XX  
**Status:** ✅ Implementado (validação PROD pendente)

---

## 🔧 HOTFIX 09.2 — Mudanças

### Fonte de variationsCount

**Antes (HOTFIX 09.1):**
- Tentativa de extrair de `pictures_json` (incorreto)
- Fallback para 0 se não encontrado

**Depois (HOTFIX 09.2):**
- **Fonte de verdade:** Campo `listing.variations_count` persistido no banco
- **Extração no sync ML:** `MercadoLivreSyncService` extrai de `item.variations?.length` ou `item.variations_count`
- **SignalsBuilder:** Usa diretamente `listing.variations_count ?? 0`
- **Migration:** `20260220000000_add_variations_count_to_listing`

### Endpoint GET /latest

**Novo endpoint:** `GET /api/v1/ai/analyze/:listingId/latest?periodDays=30`

**Comportamento:**
- Busca última análise do listing ordenada por `created_at DESC`
- Não chama OpenAI (fetch-only)
- **HOTFIX 09.4:** Retorna payload IDÊNTICO ao POST /analyze (mesmo contrato/shape)
  - Sempre inclui `listingId` no `data`
  - Campos normalizados: `metrics30d` (não `metrics_30d`), `score`, `scoreBreakdown`, `potentialGain`
  - Inclui todos os campos: `analysisV21`, `benchmark`, `benchmarkInsights`, `generatedContent`, `growthHacks`, `growthHacksMeta`, `appliedActions`, `promo`, `pricingNormalized`, `actionPlan`, `scoreExplanation`, `mediaVerdict`
- **Validação:** Se `analyzedAt < now-7d` => retorna 404

**Uso no frontend:**
- `fetchExisting()` agora usa GET latest primeiro
- **HOTFIX 09.4:** Anti-loop latch definitivo por listingId (idle/inflight/done/failed)
- **HOTFIX 09.4:** Normalização resiliente com validação de campos obrigatórios (listingId, analyzedAt, score)
- **HOTFIX 09.4:** Fallback UI quando erro/shape inválido (não loopa)
- Se encontrar análise recente: renderiza e NÃO dispara POST analyze
- Se não encontrar: permite que usuário clique em "Gerar análise"
- Botão "Regenerar" continua usando POST com `forceRefresh=true`

### Botões de Feedback

**Correções:**
- Handlers `onPointerDown` e `onMouseDown` adicionados com `preventDefault()` e `stopPropagation()`
- z-index aumentado: `relative z-20` e `pointer-events-auto`
- type="button" garantido para evitar submit acidental
