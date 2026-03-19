# NEXT SESSION PLAN — SuperSeller IA
Atualizado em: 2026-03-19

## Próxima sessão — Validar Recommendation Engine V2 + Freshness/Jobs

**Objetivo:** Validar a Recommendation Engine V2 em casos reais (cards finais, evidência forte, coherência end-to-end e ausência de ruído técnico) e depois verificar a frente de freshness/jobs (lock_key/scheduler/JobRunner). Ajustar UX somente se a validação apontar necessidade, e escolher correção mínima segura para freshness/jobs apenas com evidência.

---
## Prioridade 1 — Validação da Recommendation Engine V2

Checklist de validação (amanhã):

- [ ] **Variedade de cards finais:** confirmar se a saída não parece um template fixo
- [ ] **Menor sensação de “cards fracos”:** confirmar redução de recomendações genéricas
- [ ] **Categoria/classificação só com evidência forte:** confirmar que não aparece sem base
- [ ] **Ads virando ação quando relevante:** confirmar que recomendações de Ads não ficam genéricas
- [ ] **Coerência end-to-end:** causa raiz → diagnóstico/verdict → ações finais → verdictText
- [ ] **Linguagem para seller:** garantir que não vaza texto técnico interno (fallback/debug/snapshot/integration)
- [ ] **UX de expand/collapse (verdictText):** expandir/recolher consistente (sem altura estranha/estado inconsistente)
- [ ] **Benchmark sem ruído:** quando ausente/vazio/irrelevante, não poluir a interface
- [ ] **Rebaixar sinais secundários:** clip e outros sinais acessórios não devem dominar a leitura

---
## Prioridade 2 — Ajustes de UX (somente se necessário)

- [ ] Se houver vazamento técnico: ajustar sanitização/ocultação no(s) pontos identificados
- [ ] Se houver redundância residual: consolidar apresentação de cards (sem mexer na arquitetura de dados)
- [ ] Se houver problemas de leitura/ordem: ajustar microcopy e hierarquia apenas no frontend

---
## Prioridade 3 — Freshness / jobs (risco operacional)

Checklist mínimo:

- [ ] Validar hipótese de `lock_key` fixa em scheduler recorrente: confirmar se jobs reenfileiram após sucesso ou se param silenciosamente
- [ ] Validar status real de `scheduler` e `JobRunner` (se o scheduler está ativo e se o JobRunner executa de fato)
- [ ] Confirmar diferença entre jobs `queued/running` vs `skipped` e motivos reais do `skipped`
- [ ] Se houver correção: decidir correção mínima segura (observabilidade/lock/cooldown/dedupe), sem “refactor” grande

---
## Ordem sugerida de execução (amanhã)

1. Validar Recommendation Engine V2 em 2–3 listings reais (contraste: evidência forte vs fraca)
2. Coletar evidências de qualquer vazamento técnico/ruído visual/bugs de expand/collapse
3. Se necessário, aplicar ajustes de UX estritamente localizados e confirmados por nova validação
4. Rodar checagem operacional de freshness/jobs (lock_key + scheduler + JobRunner) e registrar decisão de correção mínima segura

---
## Decisões que não devem ser reabertas sem evidência nova

- Não reabrir o fechamento do Dia 14.1 como saneamento da Action Layer
- Não desmontar novamente a estrutura de UX de cards (Fazer agora / suporte / boas práticas) sem evidência clara de regressão
- Não mudar arquitetura de jobs/locks sem confirmar comportamento real (reenfileiramento e status de execução)

---
## Referências

- Escopo Dia 14.1: `docs/DIA14_1_ACTION_LAYER_REFINEMENT.md`
- Back-end (pontos onde a codificação/engine foi consolidada): `apps/api/src/services/AnalysisResponseBuilders.ts`, `apps/api/src/services/RootCauseEngine.ts`, `apps/api/src/routes/ai-analyze.routes.ts`
- Front-end (pontos de UX afetados): `apps/web/src/components/listings/ListingAIAnalysisPanel.tsx`, `apps/web/src/components/listings/ActionKanban.tsx`, `apps/web/src/components/listings/ActionDetailsModal.tsx`
