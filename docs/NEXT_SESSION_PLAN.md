# 🚀 NOVO ROADMAP — DIA 06 a DIA 10

## Próxima Sessão — Deploy Fix V2 Action Details + Validação

**Status atual:** 
- ✅ ActionDetailsV2 implementado e corrigido (builds passando)
- ✅ Flags ativadas em PROD (API + WEB)
- ✅ Fixes implementados (índice único + coercion Zod)
- ⏳ **Deploy PROD pendente:** Merge branch Devin + aplicar migration + deploy API

**Próximo passo:** Merge branch Devin, aplicar migration em PROD, deploy API, validar endpoints

---

### Etapa A — Merge Branch Devin + Preparar Deploy

**Objetivo:** Incorporar fixes de coercion Zod e migration de índice

**Ações:**
- [ ] Merge `devin/1772743406-fix-v2-action-details-schema` → `main`
- [ ] Verificar que migration `20260305200000_drop_old_actionid_unique_index` está presente
- [ ] Verificar que coercion Zod está em `apps/api/src/services/schemas/ActionDetailsV2.ts`
- [ ] Build local passa: `pnpm --filter @superseller/api build`

**Arquivos esperados após merge:**
- `apps/api/prisma/migrations/20260305200000_drop_old_actionid_unique_index/migration.sql`
- `apps/api/src/services/schemas/ActionDetailsV2.ts` (com `z.preprocess`)

---

### Etapa B — Aplicar Migration em PROD

**Objetivo:** Remover índice único antigo que bloqueia V2

**Comandos:**
```bash
# 1. Obter DATABASE_URL do Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id prod/DATABASE_URL \
  --query SecretString \
  --output text)

# 2. Aplicar migration
cd apps/api
npx prisma migrate deploy

# 3. Verificar migration aplicada
psql $DATABASE_URL -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%20260305%';"
```

**Checklist PASS/FAIL:**

#### PASS ✅
- [ ] Migration `20260305200000_drop_old_actionid_unique_index` aplicada sem erros
- [ ] Índice `listing_action_details_actionId_key` removido (verificar via `\d listing_action_details` no psql)
- [ ] Migration aparece em `_prisma_migrations` table

#### FAIL ❌
- [ ] Migration falha ao aplicar (erro SQL)
- [ ] Índice `listing_action_details_actionId_key` ainda existe após migration
- [ ] Migration não aparece em `_prisma_migrations`

**Runbook completo:** `apps/api/docs/RUNBOOK_PROD_ACTION_DETAILS_V2_FIX_20260305.md`

---

### Etapa C — Deploy API em PROD

**Objetivo:** Deploy App Runner com fixes de coercion Zod

**Ações:**
- [ ] Push `main` para trigger deploy automático OU deploy manual via AWS Console
- [ ] Aguardar deploy completar (verificar status no App Runner)
- [ ] Verificar logs iniciais (sem erros de startup)

**Validação:**
- [ ] App Runner status: `RUNNING`
- [ ] Logs não mostram erros de import/compilação
- [ ] Health check `/health` retorna 200

---

### Etapa D — Validar Endpoints

**Objetivo:** Confirmar que V1 e V2 funcionam corretamente

**Comandos de validação:**

```bash
# V1 (deve retornar 200)
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v1" \
  -H "Authorization: Bearer {token}" \
  -v

# V2 primeira chamada (deve retornar 202 GENERATING ou 200 se cache hit)
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v2" \
  -H "Authorization: Bearer {token}" \
  -v

# V2 segunda chamada (deve retornar 200 com cached: true)
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v2" \
  -H "Authorization: Bearer {token}" \
  -v
```

**Checklist PASS/FAIL:**

#### PASS ✅
- [ ] `/details?schema=v1` retorna `200 OK` com `version: "action_details_v1"`
- [ ] `/details?schema=v2` retorna `200 OK` ou `202 Accepted` (não mais 500)
- [ ] Se 200: response contém `version: "action_details_v2"` e `cached: boolean`
- [ ] Se 202: response contém `status: "GENERATING"`
- [ ] Segunda chamada V2 retorna `200 OK` com `cached: true`

#### FAIL ❌
- [ ] `/details?schema=v1` retorna `500 Internal Server Error`
- [ ] `/details?schema=v2` retorna `500 Internal Server Error`
- [ ] Response contém erro Prisma P2002 (unique constraint)
- [ ] Response contém erro Zod validation

---

### Etapa E — Validar UI "Ver detalhes"

**Objetivo:** Confirmar que modal funciona em PROD

**Ações:**
- [ ] Abrir listing no frontend PROD
- [ ] Clicar em "Ver detalhes" em uma ação
- [ ] Modal abre sem erro
- [ ] Conteúdo renderiza corretamente (V1 ou V2 conforme flag)

**Checklist PASS/FAIL:**

#### PASS ✅
- [ ] Modal abre sem erro no console
- [ ] Conteúdo renderiza (skeleton → dados)
- [ ] Botões "Copiar" funcionam (se V2)
- [ ] Botões "Aplicar/Descartar" funcionam

#### FAIL ❌
- [ ] Modal não abre (erro no console)
- [ ] Erro 500 visível na UI
- [ ] Conteúdo não renderiza (fica em loading)

---

### Etapa F — Checar Logs do App Runner

**Objetivo:** Confirmar que não há erros recorrentes

**Comandos:**
```bash
# Ver logs recentes (últimas 100 linhas)
aws logs tail /aws/apprunner/{service-name}/application \
  --since 10m \
  --filter-pattern "P2002|schema_version|ZodError|ActionDetails"
```

**Checklist PASS/FAIL:**

#### PASS ✅
- [ ] Logs não mostram erros P2002 (unique constraint)
- [ ] Logs não mostram erros Zod validation recorrentes
- [ ] Logs mostram gerações V2 bem-sucedidas (status READY)

#### FAIL ❌
- [ ] Logs mostram erros P2002 recorrentes
- [ ] Logs mostram erros Zod validation recorrentes
- [ ] Logs mostram falhas de geração V2

---

### Etapa G — Cleanup (se necessário)

**Objetivo:** Remover recursos temporários criados durante debug

**Ações:**
- [ ] Verificar se há Lambdas/roles temporários criados para debug
- [ ] Remover recursos não utilizados
- [ ] Documentar recursos mantidos (se houver)

---

### Etapa 0 — Aplicar Migration em PROD (URGENTE) — HISTÓRICO

**Objetivo:** Destravar endpoint `/details` que está retornando 500

**Checklist PASS/FAIL:**

#### PASS ✅
- [ ] Migration `20260303130000_add_schema_version_to_action_details` aplicada sem erros
- [ ] Coluna `schema_version` existe na tabela `listing_action_details`
- [ ] Índices criados corretamente (`listing_action_details_actionId_schemaVersion_key`, `listing_action_details_actionId_schemaVersion_idx`)
- [ ] Endpoint `/details?schema=v1` retorna `200 OK` (não mais 500)
- [ ] Endpoint `/details?schema=v2` retorna `200 OK` ou `202 Accepted`
- [ ] Logs do App Runner não mostram erros relacionados a `schema_version`

#### FAIL ❌
- [ ] Migration falha ao aplicar (erro SQL)
- [ ] Coluna `schema_version` não existe após migration
- [ ] Endpoint `/details?schema=v1` ainda retorna `500 Internal Server Error`
- [ ] Endpoint `/details?schema=v2` retorna `500 Internal Server Error`
- [ ] Logs mostram erros relacionados a `schema_version` ou `schemaVersion`

**Runbook:** `apps/api/docs/RUNBOOK_MIGRATION_ACTION_DETAILS_V2.md`

**Comandos principais:**
```bash
# 1. Obter DATABASE_URL do Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id prod/DATABASE_URL \
  --query SecretString \
  --output text)

# 2. Aplicar migration
cd apps/api
npx prisma migrate deploy

# 3. Validar endpoints
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v1" \
  -H "Authorization: Bearer {token}"
```

**Critério de sucesso:** Endpoint `/details?schema=v1` retorna `200 OK` (não mais 500)

---

### Etapa 1 — Validar flags em produção (após hotfix)

**Objetivo:** Habilitar V2 gradualmente para validação

**Ações:**
- [ ] **API (App Runner):** Definir `ACTION_DETAILS_V2_ENABLED=true` no Secrets Manager / Environment Variables
- [ ] **WEB (App Runner):** Definir `NEXT_PUBLIC_ACTION_DETAILS_V2_ENABLED=true` no Environment Variables
- [ ] **Redeploy ambos serviços** (API + WEB) para aplicar variáveis
- [ ] **Verificar logs:** Confirmar que flags foram carregadas corretamente

**Comandos de validação:**
```bash
# Verificar se API está usando V2
curl -X GET "https://api.superselleria.com.br/api/v1/listings/{listingId}/actions/{actionId}/details?schema=v2" \
  -H "Authorization: Bearer {token}" \
  -H "x-debug: 1"

# Verificar header x-schema-forced (deve estar ausente se V2 habilitado)
```

**Critério de sucesso:** Endpoint retorna `version: "action_details_v2"` quando `schema=v2`

---

### Etapa 2 — Validar endpoint

**Objetivo:** Confirmar que endpoint V2 está funcionando corretamente

**Checklist:**
- [ ] **Chamada básica:** `GET /api/v1/listings/:listingId/actions/:actionId/details?schema=v2`
- [ ] **Response contém:** `"version": "action_details_v2"`
- [ ] **Cache miss:** Primeira chamada retorna `cached: false` e status 200 (ou 202 se GENERATING)
- [ ] **Cache hit:** Segunda chamada retorna `cached: true` e status 200
- [ ] **Status 202 (GENERATING):** Se geração em andamento, retorna 202 com mensagem apropriada
- [ ] **Erro controlado:** Se falha, retorna erro 500 com mensagem clara (não 502 genérico)

**Evidências a capturar:**
- Response JSON completo (primeira chamada - cache miss)
- Response JSON completo (segunda chamada - cache hit)
- Tempo de resposta (latência)
- Logs do backend (geração LLM, validação, persistência)

---

### Etapa 3 — Validar qualidade dos artifacts

**Objetivo:** Confirmar que V2 gera artifacts específicos e não genéricos

**Testes por ActionType:**

#### 3.1 SEO_TITLE_REWRITE
- [ ] **titleSuggestions:** Retorna 3-5 títulos (não genéricos)
- [ ] **Cada título:** Máximo 60 caracteres, inclui palavras-chave relevantes
- [ ] **keywordSuggestions:** Retorna 3+ palavras-chave com placement e rationale
- [ ] **Coerência:** Títulos citam dados específicos (ex: "Seu anúncio tem X visitas")

#### 3.2 DESCRIPTION_REWRITE_BLOCKS
- [ ] **descriptionTemplate:** Contém headline, blocks (mínimo 2), bullets (mínimo 3)
- [ ] **bulletSuggestions:** Retorna 3+ bullets copyáveis
- [ ] **keywordSuggestions:** Retorna 3+ palavras-chave para incluir
- [ ] **Coerência:** Template cita dados específicos do anúncio

#### 3.3 MEDIA_GALLERY_PLAN
- [ ] **galleryPlan:** Retorna 6-12 slots
- [ ] **Cada slot:** Contém `slotNumber`, `objective`, `whatToShow`, `overlaySuggestion` (opcional)
- [ ] **Objetivos específicos:** "mostrar uso real", "close técnico", "comparação", etc.
- [ ] **Não genérico:** Descrições específicas do produto, não templates

#### 3.4 MEDIA_ADD_VIDEO_CLIP
- [ ] **videoScript:** Contém `hook` (3-5 segundos) e `scenes` (mínimo 2)
- [ ] **Hook:** Captura atenção imediata (problema/benefício/curiosidade)
- [ ] **Scenes:** Cada cena tem `order`, `description`, `durationSeconds` (opcional)
- [ ] **Coerência:** Roteiro específico do produto, não genérico

#### 3.5 PRICE_PSYCHOLOGICAL
- [ ] **suggestions:** Retorna 1-3 sugestões de preço
- [ ] **Cada sugestão:** `suggestedPrice`, `rationale`, `expectedImpact` (opcional)
- [ ] **Rationale:** Cita dados específicos (preço atual, benchmark, promoção ativa)
- [ ] **Coerência:** Considera `hasPromotion` e `discountPercent` quando aplicável

**Critério de sucesso:** Artifacts são específicos, citam dados reais, não são templates genéricos

---

### Etapa 4 — Avaliar qualidade geral

**Objetivo:** Verificar se V2 melhorou a qualidade em relação a V1

**Checklist:**
- [ ] **Conteúdo ainda genérico?** Comparar V1 vs V2 para mesma ação
- [ ] **Ordem dos cards coerente?** Prioridade/impacto fazem sentido?
- [ ] **Quantidade de ações adequada?** Não está gerando ações demais/poucas?
- [ ] **Impacto vs esforço coerentes?** Ações de alto impacto têm esforço justificado?
- [ ] **Benchmark:** Quando `available=false`, explica heurísticas claramente?
- [ ] **RequiredInputs:** Quando falta informação, lista `requiredInputs` com `howToConfirm`?

**Evidências a capturar:**
- Screenshot comparativo V1 vs V2 (mesma ação)
- Exemplos de artifacts gerados (titleSuggestions, descriptionTemplate, galleryPlan)
- Métricas de telemetria (tokens, latência, taxa de erro)

---

### Etapa 5 — Decidir ajustes

**Objetivo:** Avaliar se ajustes são necessários antes de ativar 100%

**Decisões possíveis:**

#### Se artifacts ainda genéricos:
- [ ] Ajustar prompt base (regras anti-template mais rígidas)
- [ ] Ajustar snippets por ActionType (exemplos mais específicos)
- [ ] Adicionar validação pós-geração (rejeitar se muito genérico)

#### Se artifacts faltando:
- [ ] Ajustar `requiredArtifacts` por ActionType
- [ ] Melhorar retry repair (prompt mais específico)
- [ ] Adicionar fallback para artifacts opcionais

#### Se ranking/ordem incoerente:
- [ ] Ajustar lógica de priorização no `ActionDetailsService`
- [ ] Revisar mapeamento `actionKey` → `ActionType`

#### Se qualidade OK:
- [ ] Manter rollout gradual (10% → 50% → 100%)
- [ ] Monitorar telemetria por 1 dia
- [ ] Desligar V1 após validação completa

---

### Etapa 6 — Monitoramento (1 dia)

**Objetivo:** Validar estabilidade e qualidade em produção

**Métricas a monitorar:**
- Taxa de cache hit/miss
- Latência média de geração (V2 vs V1)
- Taxa de retry repair
- Taxa de erro (500, 502, timeout)
- Custo estimado (tokens in/out)
- Taxa de 202 (GENERATING)

**Ações:**
- [ ] Configurar alertas para taxa de erro > 5%
- [ ] Configurar alertas para latência > 30s
- [ ] Revisar logs diariamente
- [ ] Coletar feedback de usuários (se aplicável)

---

## Próxima Sessão — Validação Modelo B + Continuidade FASE 1 (Histórico)

Checklist:

[ ] Validar nova tabela `listing_action_details`  
[ ] Testar endpoint `/details` (cache miss)  
[ ] Testar cache hit  
[ ] Validar modal frontend  
[ ] Avaliar qualidade do plano gerado  
[ ] Ajustar prompt se necessário  
[ ] Iniciar planejamento DIA 11 (Execução Assistida Forte)

Definir ponto atual:

→ Estamos no fim do DIA 10 (Produto Vendável estabilizado)  
→ Início prático do DIA 11 (Execução Assistida Forte)

---

## 🔜 Próxima Sessão — Validação HOTFIX 09.13 + Pipeline de Clip/Vídeo

### Passo 0 — Validar HOTFIX 09.13 — Debug Payload de Vídeo/Clip (15-20 min)

**Objetivo:** Confirmar se o problema de `has_clips=false` está no payload do ML ou na lógica de extração.

**Listagens de Referência:**
- COM clip esperado: `MLB4167251409` (UUID: `459e4527-8b84-413b-ae76-7ae5788a44ac`)
- SEM clip esperado: `MLB4217107417` (UUID: `4d51feff-f852-4585-9f07-c6b711e56571`)

**Comando de Validação:**
```bash
curl -X POST "https://api.superselleria.com.br/api/v1/listings/import" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-debug: 1" \
  -d '{
    "source": "mercadolivre",
    "externalId": "MLB4167251409",
    "forceRefresh": true
  }'
```

**Checklist de Validação:**
1. [ ] Response inclui `debug.mlPayload` preenchido
2. [ ] `mlPayload.mlFieldsSummary` mostra campos presentes no batch
3. [ ] `mlPayload.fallbackTried` = `true` (se batch não tinha `video_id`)
4. [ ] `mlPayload.fallbackHadVideoId` mostra resultado do fallback
5. [ ] `data.last_synced_at` foi atualizado (timestamp recente)
6. [ ] Consultar DB: `has_clips` deve ser `true` se ML retornou `video_id`
7. [ ] Rodar analyze e validar `mediaVerdict.hasClipDetected` e `score.media`

**Decisões Baseadas na Validação:**
- **Cenário A**: ML retorna `video_id` mas `has_clips` ainda é `false` → Bug na persistência
- **Cenário B**: ML não retorna `video_id` mesmo no GET individual → API não expõe OU item não tem clip
- **Cenário C**: Fallback não é executado → Bug na lógica de detecção

**Evidências a Capturar:**
- Response JSON completo (com `debug.mlPayload`)
- Screenshot da UI do ML mostrando clip
- Query SQL mostrando `has_clips`, `has_video`, `last_synced_at`
- Payload do analyze mostrando `mediaVerdict` e `score.media`

**Ver documentação completa:** `docs/DAILY_EXECUTION_LOG.md` — Seção "PRÓXIMA SESSÃO — PLANO DE VALIDAÇÃO"

---

### Passo 0.1 — Executar MINI-CHECKLIST PROD — DIA 09 (10-15 min) — HISTÓRICO

**Objetivo:** Validar que todas as correções dos HOTFIX 09.5 e 09.6 estão funcionando corretamente em produção antes de declarar DIA 09 oficialmente fechado.

**Runbook:** `docs/RUNBOOK_VALIDATION_DAY09.md`

**Checklist (10 itens):**
1. [ ] Accordion abre: no máximo 1 GET latest (sem loop)
2. [ ] Não existe POST analyze automático ao abrir
3. [ ] POST analyze só via botão "Regenerar análise"
4. [ ] Hacks: botões clicáveis e 1 click = 1 request de feedback
5. [ ] Persistência: após reload, status confirmado/dismissed persiste
6. [ ] ml_smart_variations omitido se variationsCount >= 5
7. [ ] Full omitido quando shippingMode unknown e isFullEligible != true
8. [ ] Clip tri-state: se hasClips true, não sugerir clip/vídeo
9. [ ] Categoria: exibe breadcrumb (quando disponível) ou fallback claro
10. [ ] Opportunity Score: aparece, ordena, e Top 3 exibido

**Comandos/Rotas para Validar:**
- `GET /api/v1/ai/analyze/:listingId/latest?periodDays=30` (Network tab)
- `POST /api/v1/ai/analyze/:listingId?forceRefresh=false` (apenas via botão "Regenerar análise")
- `POST /api/v1/listings/:listingId/hacks/:hackId/feedback` (Network tab)

**Evidence Capture:**
- Screenshots do Network tab (GET latest, POST analyze, POST feedback)
- Payloads JSON (salvar 1 de cada tipo)
- Screenshots da UI (hacks ordenados, Top 3, breadcrumb categoria, badges)
- SQL queries confirmando condições (variations_count, shipping_mode, has_clips)

**Critério de PASS:** Todos os 10 itens devem passar.

**Se PASS → Declarar "DIA 09 CLOSED" e prosseguir para Passo 1.**  
**Se FAIL → Investigar, corrigir, re-validar.**

---

### Passo 0.1 — Validar HOTFIX 09.5 (Histórico — já implementado)

**Status:** ✅ HOTFIX 09.5 implementado

**Correções aplicadas:**
- ✅ Botões dos hacks corrigidos (não ficam `disabled` por `undefined`)
- ✅ Stop definitivo no analyze duplo (sem POST /analyze automático; fetchExisting memoizado)
- ✅ Hack categoria mais acionável (breadcrumb textual + evidência com baseline de conversão quando disponível)
- ✅ Tri-state `hasClips` preservado em signals (true/false/null)
- ✅ `suggestedActionUrl?` nos hacks + CTA “Abrir no Mercado Livre” quando disponível

**Validação rápida (P0):**
- [ ] Abrir accordion → no máximo 1 GET latest por listingId
- [ ] Nenhum POST /analyze automático (somente via botão)
- [ ] Botões hack: 1 clique → 1 POST feedback (Network 200)
- [ ] Hack categoria mostra breadcrumb (não apenas MLBxxxx)
- [ ] Clip não é sugerido quando `hasClips === true`
- [ ] Build API e Web passando

**Se PASS → Prosseguir para MINI-CHECKLIST HOTFIX 09.1**

---

### Passo 0.1 — Validar HOTFIX 09.4 (Histórico)

**Status:** ✅ HOTFIX 09.4 implementado (pré-requisito do 09.5)

**Correções aplicadas:**
- ✅ Payload GET /latest normalizado (mesmo formato do POST /analyze)
- ✅ Anti-loop latch definitivo por listingId (idle/inflight/done/failed)
- ✅ Normalização resiliente com validação de campos obrigatórios
- ✅ Fallback UI para erros de carregamento

---

### Passo 0.1 — Validar HOTFIX 09.2 (Histórico)

**Status:** ✅ HOTFIX 09.2 implementado (pré-requisito do 09.3)

**Correções aplicadas:**
- ✅ variations_count persistido no DB via sync ML
- ✅ SignalsBuilder usa listing.variations_count (fonte de verdade)
- ✅ Endpoint GET /latest criado (não dispara análise ao abrir accordion)
- ✅ Frontend atualizado para usar GET latest primeiro

---

### Passo 1 — Declarar DIA 09 CLOSED (após validação)

**Após Passo 0 (checklist) passar:**

1. Atualizar `docs/DAILY_EXECUTION_LOG.md`:
   - Marcar "DIA 09 CLOSED"
   - Registrar evidence capturada
   - Listar itens validados

2. Atualizar `docs/NEXT_SESSION_PLAN.md`:
   - Marcar "DIA 09 CLOSED"
   - Remover checklist de validação (movido para runbook)

3. Commit (se necessário):
   - `docs: day 09 closed (prod validation passed)`

---

### Passo 2 — Iniciar DIA 10

## 🗓️ DIA 10 — Empacotamento Comercial + Go Live

**Pré-requisito:** ✅ HOTFIX DIA 09.1 validado e DIA 09 oficialmente fechado

**Objetivos:**

1. **Refinar proposta de valor**
   - Definir mensagem principal do produto
   - Identificar diferenciais competitivos
   - Criar narrativa de transformação (antes/depois)

2. **Definir narrativa comercial**
   - Storytelling para early adopters
   - Casos de uso principais
   - Benefícios mensuráveis

3. **Definir pricing inicial**
   - Estrutura de planos (Starter / Growth / Pro)
   - Limites e features por plano
   - Estratégia de preço (freemium? trial? paid only?)

4. **Preparar landing/argumentação**
   - Hero section com proposta de valor
   - Seção de features principais
   - Social proof (quando disponível)
   - CTA claro

5. **Definir estratégia de early adopters**
   - Critérios para seleção de primeiros usuários
   - Programa de beta/early access
   - Incentivos para feedback

6. **Planejar comunicação para primeiros usuários**
   - Email de boas-vindas
   - Onboarding guiado
   - Suporte inicial (canal de comunicação)

**Entrega (DoD DIA 10):**
- ✅ Landing page funcional com proposta de valor clara
- ✅ Planos definidos e exibidos
- ✅ Onboarding guiado implementado
- ✅ Primeiro anúncio analisado automaticamente após cadastro
- ✅ Lista de espera / early users funcional

**Objetivo:** Preparar monetização real e lançamento para primeiros usuários.

---

## 🗓️ DIA 09 — ✅ FECHADO (2026-02-19)

**Status:** ✅ **CONCLUÍDO COM SUCESSO**

**Entregas realizadas:**
- ✅ HackEngine v1 completo (5 hacks + confidence scoring)
- ✅ SignalsBuilder determinístico
- ✅ Persistência de feedback (listing_hacks)
- ✅ UI integrada (HacksPanel)
- ✅ Documentação completa (HACK_ENGINE_CONTRACT.md)
- ✅ Testes unitários

**Documentação:**
- Contrato completo: `docs/HACK_ENGINE_CONTRACT.md`
- ADR: `docs/ARCHITECTURE_DECISIONS.md` (ADR-024)

---

## 🗓️ HOTFIX DIA 09.1 — ✅ FECHADO (2026-02-19)

**Status:** ✅ **CONCLUÍDO COM SUCESSO**

**Correções realizadas:**
- ✅ Fix SignalsBuilder: extração de variationsCount corrigida
- ✅ Fix HackEngine: gate para ml_full_shipping quando shippingMode='unknown'
- ✅ Fix Frontend: botões de feedback não clicáveis corrigidos
- ✅ Padronização: texto "clip" vs "vídeo" consistente
- ✅ UX: tooltip/legenda para Confidence adicionado
- ✅ Documentação atualizada

**Pré-requisito para DIA 10:** ✅ Concluído

---

## 🗓️ DIA 06 — Execução Assistida (Modo Aplicar)

**Objetivo:** Transformar análise em ação.

### Entrega
- Botão "Aplicar sugestão"
- Modal Antes / Depois
- Confirmação humana
- Registro interno de ação aplicada
- Badge "Implementado"

**Sem automação real ainda.**  
**Foco:** Percepção de produto mágico + seguro.

---

## 🗓️ DIA 07 — Cadastro Manual + Anúncios sem Venda

**Objetivo:** Permitir que o usuário traga anúncio por URL/ID (MLB...) e analisar mesmo sem venda/pausados/novos.

### Entrega (DoD Dia 07)
- Endpoint/flow: importar anúncio por ID externo (MLBxxxx) e criar listing interno no tenant
- UI: botão "Adicionar anúncio" + modal (colar URL/ID) + feedback de import
- Tratamento de "sem métricas": dataQuality mostrando ausência e recomendações focadas em cadastro/mídia/SEO
- Garantir que analyze funciona com metrics vazias (sem quebrar score/ação)

### Plano de execução (checklist)
- Backend: rota POST /listings/import (ou similar) + validação + sync inicial + persistência
- Frontend: CTA na listagem + modal + refresh lista
- Testes: importar ID válido, inválido, de outro seller, e anúncio pausado
- Documentar decisões e riscos

**Impacto:** Produto ajuda a vender, não apenas analisar o que já vende. Permite "Primeiro valor" (1 anúncio manual + 1 ação aplicada).

---

## 🗓️ DIA 08 — ✅ FECHADO (2026-02-18)

**Status:** ✅ **CONCLUÍDO COM SUCESSO**

**Validações realizadas:**
- ✅ Bug self-lock corrigido: 0 skipped lock_running após deploy (10 históricos antes)
- ✅ Migration aplicada: `20260214000000_fix_sync_jobs_timezone_and_dedupe` com `finished_at` preenchido
- ✅ Índice único parcial criado: `sync_jobs_lock_key_unique` presente em PROD
- ✅ JobRunner funcionando: `jobRunnerEnabled: true`, jobs sendo processados
- ✅ Listings sincronizando: `last_synced_at` sendo atualizado

**Pendência (housekeeping):**
- ⚠️ Corrigir secret `prod/DB_URL` no Secrets Manager (estava com placeholder `<DB_ENDPOINT>`)
- **Ação:** Atualizar para endpoint real: `superseller-prod-db.ctei6kco4072.us-east-2.rds.amazonaws.com`
- **Risco:** Não bloqueador, mas deve ser corrigido para padronização

**Documentação:**
- Checklist completo: `docs/DIA08_PROD_VALIDATION_CHECKLIST.md`
- Validação detalhada: `apps/api/docs/HOTFIX_DIA08_VALIDATION.md`

---

## 🗓️ DIA 08 — Jobs Automáticos (Implementação)

**Objetivo:** Produto que trabalha sozinho.

### Entrega
- Cron diário:
  - sync visits (30 dias)
  - sync orders (30 dias)
  - sync promo
  - sync clips
- Flag: "Dados atualizados há X horas"
- Locks + cooldowns (anti-spam)
- Multi-tenant desde o início
- Preparado para SQS/EventBridge

**Impacto:** Escalabilidade SaaS real.

**Status:** ✅ Implementação completa, ⏳ Validação final pendente

---

## 🗓️ DIA 09 — ✅ FECHADO (Hacks ML Contextuais)

**Status:** ✅ **CONCLUÍDO**

**Entregas:**
- ✅ HackEngine v1 completo (5 hacks: ml_full_shipping, ml_bundle_kit, ml_smart_variations, ml_category_adjustment, ml_psychological_pricing)
- ✅ SignalsBuilder determinístico com isKitHeuristic
- ✅ Persistência de feedback (listing_hacks)
- ✅ UI integrada (HacksPanel)
- ✅ Documentação completa (HACK_ENGINE_CONTRACT.md)
- ✅ Testes unitários (SignalsBuilder e HackEngine)

**Documentação:**
- Contrato completo: `docs/HACK_ENGINE_CONTRACT.md`
- ADR: `docs/ARCHITECTURE_DECISIONS.md` (ADR-024)

---

## 🗓️ DIA 10 — Empacotamento Comercial + Go Live

**Pré-requisito:** ✅ HOTFIX DIA 09.1 concluído

**Entrega**
- Landing simples
- Planos (Starter / Growth / Pro)
- Onboarding guiado
- Primeiro anúncio analisado automaticamente
- Lista de espera / early users

**Objetivo:** Preparar monetização real.

---

## 📋 Backlog Pós-Dia 10

- Multi-marketplace
- Análise visual de imagens
- Estratégia de Ads
- Execução automática no ML
- Score evolutivo

---

## 📌 Notas Importantes

- Não remover histórico
- Apenas consolidar
- Manter consistência de linguagem
- Não criar versões paralelas de roadmap
