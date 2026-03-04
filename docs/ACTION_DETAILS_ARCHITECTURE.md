# Action Details — Arquitetura (Modelo B / Híbrido)

Este documento descreve a arquitetura da **Camada de Execução Assistida** no formato **Modelo B (Híbrido)**:
- **Card compacto** no Kanban (rápido, escaneável)
- **Plano detalhado sob demanda** ao clicar em “Detalhes”

Objetivos:
- UX premium sem poluir o Kanban
- Detalhes ricos apenas quando o usuário pede (lazy)
- Controle de custo de LLM (geração e cache)
- Evolução futura para execução automática com consentimento e rollback

---

## Conceitos

- **ListingAction (ação estrutural)**: item estável e curto (título, descrição, status, prioridade, impacto esperado).
- **ActionDetails (plano detalhado)**: conteúdo longo e operacional (por que importa, como fazer, checklist, copy, benchmark etc).

**Regra central:** o Kanban não deve carregar detalhes antecipadamente.

---

## Banco de Dados — `listing_action_details`

Tabela nova proposta:

- **`id`**: PK
- **`listing_id`**: FK para o listing
- **`action_id`**: FK para a ação (ou `listing_action.id`)
- **`details_json`**: JSONB (contrato `ActionDetailsV1`)
- **`available`** (opcional): boolean (se existe detalhe gerado)
- **`prompt_version`**: versão do prompt usado (para invalidar cache)
- **`model`**: modelo LLM utilizado (observabilidade/custo)
- **`created_at` / `updated_at`**
- **`generated_at`** (opcional): quando o detalhe foi gerado
- **`error_message`** (opcional): última falha de geração (debug)

Índices recomendados:
- Unique: (`listing_id`, `action_id`)
- Index: (`listing_id`, `updated_at`)

---

## Endpoint

### GET `/api/v1/listings/:listingId/actions/:actionId/details`

Comportamento:
- **Cache hit**: retorna `details_json` imediatamente.
- **Cache miss**: gera sob demanda (LLM) → persiste em `listing_action_details` → retorna.
- **Falha de geração**: retorna erro controlado (ex: 502) ou fallback mínimo (ver seção de fallback).

Requisitos de segurança:
- Respeitar `tenant_id` do listing e da action.
- Não permitir acesso cruzado entre tenants.

---

## Fluxo de Geração Sob Demanda

1. Usuário clica em **“Detalhes”** no card do Kanban.
2. Frontend abre modal/drawer e chama o endpoint `/details`.
3. Backend:
   - valida auth + tenant
   - busca cache em `listing_action_details`
   - se não existir/expirou: chama gerador (LLM) com contexto mínimo necessário
   - persiste resultado
4. Frontend renderiza o plano (skeleton → conteúdo).

---

## Contrato JSON — `ActionDetailsV1`

Estrutura recomendada (mínimo):

- **`whyThisMatters`**: string
- **`howToSteps`**: string[]
- **`doThisNow`**: string[] (checklist)
- **`copySuggestions`**:
  - `titles`: `{ variation: 'A'|'B'|'C', text: string }[]`
  - `description`: string (template)
  - `bullets`: string[]
- **`benchmark`**:
  - `available`: boolean
  - `notes?`: string
  - `data?`: objeto (quando existir)
- **`impact?`**: `'low'|'medium'|'high'`
- **`effort?`**: `'low'|'medium'|'high'`
- **`priority?`**: `'critical'|'high'|'medium'|'low'` (ou string compatível)
- **`confidence?`**: `'high'|'medium'|'low'` (ou string compatível)

Observação:
- Campos opcionais permitem evolução incremental do backend sem quebrar o frontend.

---

## Estratégia de Fallback

Quando a geração não for possível (LLM indisponível, timeout, erro de dados):
- Retornar um **fallback mínimo** baseado na ação estrutural:
  - `whyThisMatters`: usar uma frase curta (ex: “Esta ação melhora a qualidade do anúncio e tende a aumentar conversão.”)
  - `howToSteps`: 3 passos genéricos e seguros (sem inventar dados)
  - `doThisNow`: checklist curto
  - `benchmark.available=false` + `notes` explicando indisponibilidade

Importante:
- Nunca “alucinar” benchmark ou dados específicos.

---

## Controle de Custo (LLM)

Pilares:
- **Lazy generation**: só gera ao clicar.
- **Cache por (`listingId`, `actionId`, `prompt_version`)**.
- **TTL** (opcional): expirar após X dias ou quando houver nova análise (novo batchId).
- **Rate limit**: limite diário por tenant para geração de detalhes.
- **Observabilidade**: logar custo estimado, latência e taxa de hit/miss.

---

## ActionDetailsV2 — Arquitetura

### Visão Geral

ActionDetailsV2 introduz artifacts tipados e específicos por ActionType, mantendo V1 como fallback seguro via rollout paralelo.

**Princípios:**
- Schema JSON-safe (Zod) compatível com Prisma
- Mapping ActionType → requiredArtifacts
- Prompt Base + Snippets por ActionType
- Retry repair se faltar artifact obrigatório
- Persistência com schemaVersion (V1/V2 coexistem)
- Rollout paralelo via feature flag

### Fluxo de Geração V2

1. **Front solicita details** (`schema=v2` via query param)
2. **Service verifica cache** (`actionId + schemaVersion`)
3. **Se cache miss:**
   - Gera via OpenAI JSON mode com prompt V2 (base + snippet do ActionType)
   - Valida via `ActionDetailsV2Schema.parse()`
   - Valida `requiredArtifacts` via `validateArtifacts()`
   - Se faltar artifact obrigatório → retry 1x com prompt "repair"
   - Se ainda faltar → marca como FAILED
4. **Persiste como READY** com `schemaVersion='v2'` e `promptVersion='action-details-v2'`
5. **Front renderiza sections tipadas** via `ActionDetailsV2Sections` quando `version === 'action_details_v2'`

### Schema JSON-Safe

**JsonValueSchema (recursivo):**
```typescript
z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
)
```

**Uso:** `benchmark.data` usa `JsonValueSchema.optional()` ao invés de `z.unknown().optional()`

**Garantia:** Após validação Zod, objeto é cast para `Prisma.InputJsonValue` antes de persistir

### Mapeamento ActionType → Artifacts

**ActionTypes suportados:**
- `SEO_TITLE_REWRITE` → `titleSuggestions` + `keywordSuggestions`
- `DESCRIPTION_REWRITE_BLOCKS` → `descriptionTemplate` + `bulletSuggestions` + `keywordSuggestions`
- `MEDIA_GALLERY_PLAN` → `galleryPlan` (6-12 slots)
- `MEDIA_ADD_VIDEO_CLIP` → `videoScript` (hook + scenes)
- `PRICE_PSYCHOLOGICAL` → `pricing.suggestions`
- `VARIATIONS_ADD` → `variations`
- `KITS_CREATE_COMBO` → `kits`
- `TECH_SPECS_FILL_ATTRIBUTES` → `techSpecs`
- `TRUST_GUARANTEES_HIGHLIGHT` → `trustGuarantees`
- `SEO_KEYWORDS_ENRICH` → `keywordSuggestions`

**Validação:** `validateArtifacts()` verifica se todos os `requiredArtifacts` estão presentes após geração

### Prompt Builder V2

**Estrutura:**
- **Base:** Regras anti-template, coerência `hasPromotion`, citar 2 fatos do contexto
- **Snippet por ActionType:** Diretrizes específicas e artifacts obrigatórios

**Exemplo (SEO_TITLE_REWRITE):**
```
AÇÃO: Reescrever título do anúncio para SEO e conversão.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.copy.titleSuggestions: array com 3-5 títulos prontos para copiar
- artifacts.copy.keywordSuggestions: array com 3+ palavras-chave principais

DIRETRIZES:
- Títulos devem incluir: produto principal, marca/modelo, principal diferencial
- Primeiras 40 letras são críticas (aparecem em busca)
- Use variações: uma focada em SEO, outra em conversão, outra em promoção
```

### Rollout Paralelo

**Feature Flags:**
- `ACTION_DETAILS_V2_ENABLED` (server) - default: false
- `NEXT_PUBLIC_ACTION_DETAILS_V2_ENABLED` (web) - default: false

**Comportamento:**
- Se ambas flags `true`: frontend solicita `schema=v2`, backend gera V2
- Se qualquer flag `false`: frontend solicita `schema=v1`, backend retorna V1 (ou força v1 com header)

**Cache:**
- Segregado por `(actionId, schemaVersion)`
- V1 e V2 podem coexistir para mesma `actionId`
- Unique constraint garante isolamento

**Telemetria:**
- V2 persiste `promptVersion='action-details-v2'`, `model`, `costTokensIn`, `costTokensOut`
- Compatível com observabilidade existente

---

## Roadmap Evolutivo da Feature

### V1 (Atual) — Modelo B (Híbrido)
- Modal/drawer com detalhes sob demanda
- Cache persistido
- Botões aplicar/descartar também no modal
- **Status:** ✅ Funcional, mantido como fallback

### V2 (Implementado) — Artifacts Tipados
- ✅ Schema JSON-safe (Zod) compatível com Prisma
- ✅ Prompt base + snippets por ActionType
- ✅ Validação de artifacts obrigatórios
- ✅ Retry repair automático
- ✅ Rollout paralelo via feature flag
- **Status:** ✅ Implementado, ⏳ Validação em produção pendente

### V3 — Execução Real (DIA 16–18)
- Apply via API (com consentimento explícito)
- Histórico completo, logs, auditoria
- Rollback e trilha de mudanças

