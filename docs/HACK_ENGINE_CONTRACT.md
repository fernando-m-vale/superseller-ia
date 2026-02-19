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

**Título:** "Ajustar Categoria"

**Resumo:** A categoria correta é fundamental para que o anúncio apareça nas buscas certas.

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
- Categoria atual
- Visitas (30d)
- Pedidos (30d)

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

2. **HackEngine** (`apps/api/src/services/HackEngine.ts`)
   - Gera hacks baseados em signals
   - Aplica regras de histórico (confirmed/dismissed)

3. **ListingHacksService** (`apps/api/src/services/ListingHacksService.ts`)
   - Persiste feedback do usuário
   - Busca histórico de hacks

4. **Endpoint analyze** (`apps/api/src/routes/ai-analyze.routes.ts`)
   - Integra HackEngine no fluxo de análise
   - Retorna `growthHacks` e `growthHacksMeta` no payload

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

**Versão:** 1.0  
**Data:** 2026-02-19  
**Status:** ✅ Implementado
