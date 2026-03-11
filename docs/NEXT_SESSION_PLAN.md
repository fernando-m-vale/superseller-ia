# NEXT SESSION PLAN — SuperSeller IA
Atualizado em: 2026-03-10

## Próxima sessão — Dia 11: Data Layer + Jobs Automáticos

**Objetivo:** Implementar sync automático e persistir o máximo possível de dados da API do Mercado Livre para alimentar futuras análises da IA.

---

## Entregas esperadas (Dia 11)

- [ ] **Sync automático de visitas** — jobs recorrentes, persistência em `listing_metrics_daily` (ou equivalente)
- [ ] **Sync automático de pedidos** — atualização de métricas de vendas
- [ ] **Sync automático de promoções** — dados de preço promocional atualizados
- [ ] **Sync automático de preço** — preço atual persistido

**Princípio:** Persistir no banco o máximo possível de dados da API do ML. Esses dados alimentarão o refinamento da IA (Dia 14) e outras análises.

---

## Referências

- Roadmap completo: `docs/ROADMAP.md`
- Contexto do produto e limitações: `docs/PROJECT_CONTEXT.md`
