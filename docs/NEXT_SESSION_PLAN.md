A partir de 2026-01-05, o planejamento diário passou para DAILY_EXECUTION_LOG.md


# SuperSeller IA — Plano da Próxima Sessão

## Objetivo da sessão
Fechar completamente:
1. Ingestão correta de visitas
2. Coerência total entre BD, IA e UI
3. UX do modal (state reset)

---

## Checklist — 30 minutos (Quick Wins)

- [ ] Inspecionar payload da API `/ai/analyze`
  - Confirmar se `visits` chega como `null` ou `0`
- [ ] Ajustar frontend:
  - Nunca converter `null` → `0`
  - Se `visits === null`, mostrar:
    > “Visitas não disponíveis via API; valide no painel do Mercado Livre”
- [ ] Remover copy “visitas zeradas” quando visits = null

---

## Checklist — 60 minutos (Correções estruturais)

- [ ] Implementar ingestão via **Visits API**
  - Endpoint: `/visits/items/{item_id}`
  - Persistir:
    - visits_30d real
    - source = ml_visits
- [ ] Atualizar `listing_metrics_daily`:
  - visits deixa de ser sempre NULL
- [ ] Atualizar `buildAIAnalyzeInput`:
  - Calcular conversion apenas se visits conhecido

---

## Checklist — 120 minutos (UX e robustez)

- [ ] Corrigir bug do modal:
  - Resetar state ao trocar `listingId`
  - Invalidar cache/query por listing
- [ ] Garantir:
  - Cada clique → nova análise
  - Nenhuma análise “herdada”
- [ ] Validar end-to-end:
  - BD → API → IA → UI
- [ ] Atualizar documentação:
  - ML_METRICS_SYNC.md
  - PROJECT_CONTEXT.md

---

## Critérios de aceite da próxima sessão

- Visits no BD batem com painel do ML
- IA nunca afirma dados inexistentes
- Modal sempre mostra análise correta do anúncio clicado
- Nenhum F5 necessário para nova análise
