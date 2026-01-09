> ⚠️ Este documento descreve o modelo conceitual do IA Score.
> A aplicação prática, UX, cache, benchmark e roadmap estão documentados em `IA_SCORE_V2.md`.

# IA Score Model — SuperSeller IA (V1.1)

## Objetivo
Criar um score explicável, baseado em dados reais, que represente a qualidade e o potencial de crescimento de um anúncio no Mercado Livre — **sem afirmar algo que a API não entrega**.

## Dimensões do Score

| Dimensão          | Peso | Pontos Máximos |
|-------------------|------|----------------|
| Cadastro          | 20%  | 20             |
| Mídia             | 20%  | 20             |
| Performance       | 30%  | 30             |
| SEO               | 20%  | 20             |
| Competitividade   | 10%  | 10             |

**Score Final:** Soma das dimensões (0–100)

---

## Regras de Cálculo

### Cadastro (0–20)
- Título length > 10: 5 pontos
- Descrição length > 200: 5 pontos
- Categoria preenchida: 5 pontos
- Status = active: 5 pontos

### Mídia (0–20)
- pictures_count >= 6: 10 pontos (ideal)
- pictures_count >= 3: 5 pontos (parcial)
- **Clips (vídeo)**
  - has_video = true: +10 pontos
  - has_video = false: +0 pontos
  - has_video = null: **não penaliza** (indisponível/não detectável via API)

> ℹ️ Observação: “Clips (vídeo)” nem sempre é detectável de forma confiável via API. Quando `has_video = null`, UI e IA devem tratar como **“Não detectável via API”** e orientar validação no painel do Mercado Livre.

### Performance (0–30)
**Base V1 (quando disponível):**
- visits > 0: 10 pontos
- orders > 0: 10 pontos
- conversion_rate vs baseline (2%):
  - >= 2%: 10 pontos
  - >= 1%: 5 pontos
  - > 0%: 2 pontos

#### Performance — Regras especiais de disponibilidade (crítico)
- Se `performanceAvailable = false` (ex: `visits`/`impressions`/`clicks` indisponíveis via API no período):
  - A dimensão **não deve ser considerada gargalo**
  - A dimensão não deve “punir” o anúncio por falta de dados
  - A IA **não pode afirmar** “tráfego baixo”, “conversão baixa”, “performance ruim”
  - A IA deve usar linguagem condicional:
    - “Se você quiser aumentar tráfego…”
    - “Quando os dados de performance estiverem disponíveis…”
  - A UI deve mostrar o status de disponibilidade (ex: “Indisponível via API”)

### SEO (0–20)
- CTR relativo:
  - >= 2%: 10 pontos
  - >= 1%: 5 pontos
  - > 0%: 2 pontos
- semantic_score: 10 pontos (placeholder V1)

> ℹ️ CTR depende de `impressions` e `clicks`. Se esses dados estiverem ausentes, a IA deve tratar SEO com cautela (sem afirmações absolutas sobre CTR).

### Competitividade (0–10)
- Placeholder V1: 5 pontos fixos (50% do máximo)
- V2: benchmark por categoria
- V3: comparação com concorrentes

---

## Qualidade dos Dados (Data Quality)

Cada análise deve incluir um bloco de qualidade de dados para garantir transparência e evitar “alucinação”:

- `missing`: campos ausentes (ex: impressions, clicks, ctr)
- `warnings`: limitações conhecidas da API
- `completenessScore`: % de completude dos dados considerados
- `visitsCoverage`:
  - `filledDays`: quantos dias têm `visits` preenchido (não NULL)
  - `totalDays`: total de dias no período
- `performanceAvailable`: boolean (se a performance é avaliável)
- `sources`: fonte usada por dimensão (ex: performance: listing_metrics_daily)

Regras:
- Dados ausentes **não devem** ser convertidos implicitamente em 0.
- Quando a API não retornar um valor, gravar **NULL** (ex: visits=NULL).
- `visitsCoverage.filledDays = 0` implica `performanceAvailable=false`.

---

## Fontes de Dados

- `listings` (cadastro, mídia)
- `listing_metrics_daily` (métricas diárias; janela móvel, ex: 7/30 dias)
- `listing_ai_analysis` (cache de análises IA por fingerprint)

Regras fundamentais:
- **visits** vêm somente da Visits API e devem ser gravadas por dia.
- Se a Visits API não retornar, gravar `visits = NULL` (nunca 0).
- Métricas não disponíveis via API devem permanecer ausentes/NULL (sem estimativas implícitas).

---

## Integração com IA

O IA Score é calculado **ANTES** da análise pela IA. A IA:
- **NÃO calcula** o score
- **Explica** gaps identificados no breakdown
- **Sugere** ações específicas para melhorar cada dimensão
- **Prioriza** dimensões com menor score
- **Respeita Data Quality** (não afirma o que não é suportado por dados)

---

## Potencial de Ganho

O sistema calcula automaticamente o potencial de ganho por dimensão:
- Mídia: +10 a +20 (fotos/vídeo)
- Performance: +5 a +15 (conversão/tráfego) — **apenas quando `performanceAvailable=true`**
- Cadastro: +5 a +10 (título/descrição)
- SEO: +5 a +10 (CTR/palavras-chave) — depende de dados disponíveis
- Competitividade: +5 a +10 (placeholder → benchmark/concorrência)

---

## Validações e Clamps

- **Clamp por dimensão:** cada score de dimensão é limitado ao seu máximo  
  (cadastro ≤ 20, mídia ≤ 20, performance ≤ 30, seo ≤ 20, competitividade ≤ 10)
- **Clamp do score final:** score total sempre entre 0–100
- **Coerência:** score total = soma das dimensões (não pode exceder 100)

---

## Cache de Análise IA (Fingerprint)

Para reduzir custo e garantir consistência:

- A análise IA é cacheada em `listing_ai_analysis` por:
  - `tenant_id`
  - `listing_id`
  - `period_days`
  - `fingerprint` (SHA256)

- O fingerprint é gerado a partir de:
  - campos estáveis do anúncio
  - métricas agregadas do período
  - `prompt_version`

Regras:
- Fingerprint **não pode** incluir campos voláteis (ex: `updated_at`).
- Serialização deve ser determinística (ex: `stableStringify` ordenando keys recursivamente).

Comportamento:
- Cache hit → retorna análise salva (`cacheHit=true`)
- Cache miss → gera nova análise e salva (`cacheHit=false`)
- `forceRefresh=true` → ignora cache e gera novo resultado (`cacheHit=false`)

---

## Endpoints

- `GET /api/v1/ai/score/:listingId` — calcula e retorna o score breakdown
- `POST /api/v1/ai/analyze/:listingId` — análise completa (score + IA + dataQuality + cacheHit)
  - Query: `?forceRefresh=true`

---

## Roadmap (produto)

- V2: Benchmark por categoria (competitividade real)
- V3: Concorrentes (share de preço, mídia, SEO, reputação)
- V4: Ads / ROAS (quando disponível via API / integrações)
- V5: Multi-marketplace (Shopee, Amazon, Magalu) + visão unificada de performance
