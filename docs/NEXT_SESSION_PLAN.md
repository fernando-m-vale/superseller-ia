# NEXT SESSION PLAN — Dia 2

## ✅ Status atual (Dia 1 concluído)
- Orders/GMV: OK (série diária contínua, UTC, overview preenchendo periodDays)
- Conexão Mercado Livre: OK (reauth_required + erros tratados + migration aplicada em PROD)
- Visits: ✅ **RESOLVIDO**
  - ✅ Pipeline e persistência funcionando
  - ✅ Parser corrigido para formato real (results.total/visits_detail)
  - ✅ Valores > 0 no DB: `positive_days = 91`, `total_visits_period = 803`
  - ✅ UI exibindo gráfico de visitas com valores reais
  - ✅ 0 NULL visits quando fetch é bem-sucedido
- Access Control & PolicyAgent: ✅ **RESOLVIDO**
  - ✅ Listings bloqueados marcados corretamente (`access_status='blocked_by_policy'`)
  - ✅ Reconciliação de status (`paused` vs `active`) funcionando
  - ✅ UI exibe mensagens específicas para bloqueios
  - ✅ Sync não processa listings bloqueados

## 🎯 Foco do Dia 2: Orders + estrutura multi-contas

### PRIORIDADE 1: Orders (seller_id, connection switch)
**Objetivo:** Garantir que orders refletem o seller da conexão ativa atual

**Tarefas:**
1. **Validar comportamento de orders quando connection active mudou de sellerId**
   - Verificar se orders do seller atual (connection active) estão sendo trazidos corretamente
   - Se connection active mudou de `sellerId`, orders podem refletir seller antigo
   - **Ação:** Investigar se orders=0 é devido a mudança de connection ou outro problema
   - **Evidência necessária:** Confirmar se orders do seller atual (provider_account_id da connection active) estão no DB

2. **Corrigir ingestão de orders se necessário**
   - Se orders estão sendo buscados do seller errado, ajustar query/filtro
   - Garantir que `orders.seller_id` corresponde ao `provider_account_id` da connection active
   - Validar que `order_items.listing_id` está preenchido corretamente

3. **Validar métricas agregadas**
   - Confirmar que `listing_metrics_daily.orders` e `gmv` refletem orders do seller atual
   - Verificar se há discrepâncias entre orders no DB e métricas agregadas

### PRIORIDADE 2: UX de multi-contas (opcional, se tempo permitir)
**Objetivo:** Melhorar experiência quando há múltiplas conexões

**Tarefas:**
1. **Investigar estrutura para suportar múltiplas contas/conexões**
   - Avaliar se é necessário suporte a múltiplas conexões ativas simultaneamente
   - Se sim, definir UX: seletor de conta, filtro por conexão, etc.
   - Se não, documentar decisão de usar sempre a conexão `active` mais recente

2. **Melhorar feedback visual para conexões**
   - Exibir qual conexão está sendo usada (provider_account_id, nickname)
   - Mostrar aviso se há conexões revogadas/antigas
   - CTA para reconectar se necessário

### PRIORIDADE 3: Estabilização (se tempo permitir)
1. **Corrigir testes quebrados**
   - `ai-recommendations` (@superseller/ai export)
   - `metrics.test` (dependente de seed/dados)

2. **Validar botão "Atualizar dados" no UI**
   - Garantir que chama endpoint correto: `POST /api/v1/sync/mercadolivre/refresh?days=X`
   - Validar que gráfico atualiza após refresh (React Query invalidation)
   - Confirmar feedback visual (loading, success, error)

## 🧯 Notas importantes
- **Não reanalisar visits:** Visits está resolvido e validado; focar em orders
- **Backfill manual:** Por enquanto, backfill é manual; não implementar automação agora
- **Multi-conexões:** Não implementar suporte completo agora; apenas validar comportamento atual

## 🟢 Após VISITS (retomar plano épico já aprovado)
### ONDA 1 — IA SCORE V2 (AÇÃO + EXPLICABILIDADE)
- Criar `apps/api/src/services/ScoreActionEngine.ts`
- Implementar `explainScore(scoreBreakdown, dataQuality)`
- Enriquecer `POST /api/v1/ai/analyze/:listingId` com:
  - `actionPlan[]`
  - `scoreExplanation[]`
- Testes obrigatórios:
  - performance indisponível
  - mídia incompleta
  - ordenação por impacto

## 🧯 Operação / custos (manual)
- Aplicar runbook `docs/RUNBOOK_ENV_TOGGLE.md` para desligar quando não estiver usando
- Atenção: desligar RDS pode impedir API/Web e jobs; reativar antes de testar
