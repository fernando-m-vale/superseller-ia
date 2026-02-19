# 🚀 NOVO ROADMAP — DIA 06 a DIA 10

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
