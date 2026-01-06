# SuperSeller IA — NEXT SESSION PLAN

## Objetivo da próxima sessão
Fechar completamente a **PRIORIDADE ZERO (ML Data Audit)** e deixar o sistema pronto para uso real por usuários.

---

## 🎯 Foco central
- Listings reais ingeridos (mesmo com PolicyAgent ativo)
- Visits reais persistidas
- Dashboard refletindo estados corretos
- Pipeline automático pós-OAuth validado

---

## Checklist — Bloco 1 (Fundação de dados)

- [ ] Executar FULL sync em PROD
  - Confirmar fallback via Orders acionado
  - Validar `COUNT(*) FROM listings > 0`
- [ ] Validar logs:
  - discoveryBlocked=true
  - ordersFound > 0
  - uniqueItemIds > 0

---

## Checklist — Bloco 2 (Visits)

- [ ] Executar sync incremental de visits
- [ ] Confirmar criação de registros em `listing_metrics_daily`
- [ ] Garantir:
  - visits ≠ NULL quando API retornar
  - NULL preservado quando indisponível

---

## Checklist — Bloco 3 (Dashboard & UX)

- [ ] Ajustar UI para estados:
  - “Carregando dados”
  - “Dados parciais”
  - “Dados completos”
- [ ] Garantir:
  - UI nunca mostra “0 visitas” quando visits = NULL
  - IA nunca conclui ausência sem evidência
- [ ] Validar modal de análise:
  - Reset de state ao trocar listing
  - Nenhuma análise herdada

---

## Checklist — Bloco 4 (Automação)

- [ ] Conectar OAuth → FULL sync automático
- [ ] Backfill automático de visits (30 dias)
- [ ] Planejar cron / jobs:
  - Orders
  - Visits
  - Recalc score

---

## Critérios de aceite da sessão

- Listings reais aparecem no dashboard
- Visits aparecem após sync
- Nenhuma métrica estimada
- Sistema funciona com limitações reais do ML
- PRIORIDADE ZERO pode ser encerrada oficialmente
