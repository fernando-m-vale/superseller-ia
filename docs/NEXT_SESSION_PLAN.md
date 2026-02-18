# 🚀 NOVO ROADMAP — DIA 06 a DIA 10

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

## 🗓️ DIA 09 — Hacks ML Contextuais

**Objetivo:** Gerar hacks específicos e acionáveis baseados em dados reais do anúncio (não genéricos).

**Foco:** Hacks contextualizados e reais baseados em dados do anúncio (frete, kits, variações, categoria, preço psicológico).

### Entregas (DoD Dia 09)

**Backend:**
- ✅ HackEngine com signals específicos por tipo de hack
- ✅ Signals baseados em dados reais (frete grátis, variações, categoria, preço)
- ✅ Endpoint `/api/v1/ai/analyze` retorna `hacks` contextualizados
- ✅ Testes unitários para cada tipo de hack

**Frontend:**
- ✅ UI de hacks contextualizados (não genéricos)
- ✅ Badge de confiança por hack
- ✅ CTA "Aplicar hack" quando executável
- ✅ Explicação clara de cada hack

**Critérios de qualidade:**
- Hacks devem ser específicos ao anúncio (não genéricos)
- Signals devem ser baseados em dados reais (não inventados)
- UI deve mostrar apenas hacks relevantes (ocultar se genérico)

### Plano de execução (checklist)

**1. Backend — HackEngine:**
- [ ] Criar `HackEngine.ts` com signals por tipo
- [ ] Implementar signals:
  - Frete grátis (verificar shipping.free_shipping, shipping.mode)
  - Kits (verificar attributes, variations)
  - Variações (verificar variations_count, variations)
  - Categoria (verificar category_id, category_path)
  - Preço psicológico (verificar price, original_price, discount_percent)
- [ ] Integrar com `/api/v1/ai/analyze`
- [ ] Testes unitários para cada signal

**2. Frontend — UI de Hacks:**
- [ ] Componente `HacksPanel` com hacks contextualizados
- [ ] Badge de confiança (high/medium/low)
- [ ] CTA "Aplicar hack" quando executável
- [ ] Ocultar hacks genéricos/redundantes

**3. Testes:**
- [ ] Testar com anúncio com frete grátis
- [ ] Testar com anúncio com variações
- [ ] Testar com anúncio sem hacks relevantes (deve ocultar seção)

**4. Documentação:**
- [ ] Documentar signals e critérios de cada hack
- [ ] Documentar decisões arquiteturais

**Impacto:** Hacks específicos e acionáveis aumentam valor percebido e taxa de conversão.

**⚠️ Antes de iniciar:**
- [ ] Corrigir secret `prod/DB_URL` no Secrets Manager (housekeeping do DIA 08)

---

## 🗓️ DIA 10 — Empacotamento Comercial + Go Live

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
