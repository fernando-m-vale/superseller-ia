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

## 🗓️ DIA 08 — Validação Final (Produção)

**Objetivo:** Validar que o sistema de jobs automáticos está funcionando corretamente em produção.

### Passos amanhã

1. **Rodar queries SQL de validação**
   - Verificar que não existem múltiplos TENANT_SYNC queued simultâneos
   - Confirmar transição de status: queued → processing → succeeded
   - Validar que last_auto_sync_at não gera minutos negativos
   - Confirmar que listings.last_synced_at atualiza após sync

2. **Validar logs do JobRunner**
   - Confirmar ENABLE_JOB_RUNNER=true
   - Buscar "JobRunner enabled" nos logs
   - Verificar "Job claimed" e "Job finished"
   - (Opcional) Verificar heartbeat se DEBUG_JOB_RUNNER=1

3. **Confirmar processamento real de jobs**
   - Abrir /listings e verificar que apenas 1 TENANT_SYNC é criado
   - Verificar que jobs são processados (started_at preenchido)
   - Confirmar que LISTING_SYNC jobs são criados e executados

4. **Validar timestamps após migration**
   - Verificar tipos de coluna (timestamptz)
   - Confirmar consistência de timestamps
   - Validar que comparações de tempo funcionam corretamente

5. **Confirmar que dedupe está funcionando**
   - Verificar índice único parcial
   - Testar criação de job duplicado (deve retornar job existente)

6. **Decidir:**
   - ✅ **DIA 08 FECHADO** → Iniciar DIA 09 (Hacks ML Contextualizados)
   - ⚠️ **AJUSTES NECESSÁRIOS** → Documentar e corrigir
   - 🔴 **BLOQUEADOR** → Escalar e resolver

**Referência:** Ver `docs/DIA08_PROD_VALIDATION_CHECKLIST.md` para checklist completo.

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

**Entrega**
- Hacks de frete
- Hacks de kits
- Hacks de variações
- Hacks de categoria
- Estratégia de preço psicológico

**Baseados no anúncio atual.**

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
