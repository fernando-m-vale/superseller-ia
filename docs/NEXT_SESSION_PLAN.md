# 🚀 NOVO ROADMAP — DIA 06 a DIA 10

## Próxima Sessão — Validação Modelo B + Continuidade FASE 1

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
