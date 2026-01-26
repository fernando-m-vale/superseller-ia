# NEXT SESSION PLAN — 2026-01-22

## ✅ Status atual (hoje encerrou)
- Orders/GMV: OK (série diária contínua, UTC, overview preenchendo periodDays)
- Conexão Mercado Livre: OK (reauth_required + erros tratados + migration aplicada em PROD)
- Visits: ✅ **RESOLVIDO**
  - ✅ Pipeline e persistência funcionando
  - ✅ Parser corrigido para formato real (results.total/visits_detail)
  - ✅ Valores > 0 no DB: `positive_days = 91`, `total_visits_period = 803`
  - ✅ UI exibindo gráfico de visitas com valores reais

## 🎯 Próximos passos práticos

### 1) Validar orders quando connection active mudou de sellerId
**Objetivo:** Confirmar se comportamento de orders=0 quando connection active mudou de sellerId é esperado
- Verificar se orders do seller atual (connection active) estão sendo trazidos corretamente
- Se connection active mudou de `sellerId`, orders podem refletir seller antigo
- **Ação:** Investigar se orders=0 é devido a mudança de connection ou outro problema

### 2) Corrigir testes quebrados
- `ai-recommendations` (@superseller/ai export)
- `metrics.test` (dependente de seed/dados)

### 3) Validar botão "Atualizar dados" no UI
- Garantir que chama endpoint correto: `POST /api/v1/sync/mercadolivre/refresh?days=X`
- Validar que gráfico atualiza após refresh (React Query invalidation)
- Confirmar feedback visual (loading, success, error)

### 4) Fechar ML Data Audit
- Documentar resolução de visits
- Validar orders com múltiplas connections
- Estabilizar testes
- Marcar audit como concluído

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
