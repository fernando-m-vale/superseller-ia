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

## Roadmap Evolutivo da Feature

### V1 (Agora) — Modelo B (Híbrido)
- Modal/drawer com detalhes sob demanda
- Cache persistido
- Botões aplicar/descartar também no modal

### V2 — Qualidade + Consistência
- Prompt mais restrito e padronizado por tipo de ação
- Validação de schema (zod) no backend
- Melhor fallback e mensagens de erro

### V3 — Execução Real (DIA 16–18)
- Apply via API (com consentimento explícito)
- Histórico completo, logs, auditoria
- Rollback e trilha de mudanças

