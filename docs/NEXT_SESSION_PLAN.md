# SuperSeller IA — NEXT SESSION PLAN

## Objetivo da próxima sessão
**Encerrar a PRIORIDADE ZERO (ML Data Audit)** com pipeline de dados totalmente confiável, auditável e pronto para uso real.

---

## 🎯 Foco central
- Backfill de Visits funcionando corretamente
- `listing_metrics_daily` populada com granularidade diária
- NULL tratado corretamente (sem métricas inventadas)
- Pipeline pós-OAuth validado de ponta a ponta

---

## Checklist — Bloco 1 (Hotfix Visits Backfill)

- [ ] Ajustar service de backfill para:
  - Criar linhas em `listing_metrics_daily` **sempre**
  - visits = valor real quando API retornar
  - visits = NULL quando API não retornar
  - period_days = 1
  - source = `visits_api`
- [ ] Garantir:
  - `rowsUpserted >= listings × days`
  - `rowsWithNull` > 0 quando API não retornar
- [ ] Adicionar logs explícitos:
  - endpoint chamado (`/items/visits`)
  - status code
  - quantidade de dados retornados

---

## Checklist — Bloco 2 (Validação em PROD)

- [ ] Executar:
  - `POST /sync/mercadolivre/full`
  - `POST /sync/mercadolivre/visits/backfill?days=1`
- [ ] Validar SQL:
```sql
SELECT COUNT(*)
FROM listing_metrics_daily
WHERE date >= (CURRENT_DATE - INTERVAL '1 day');

 Esperado: COUNT >= número de listings

Checklist — Bloco 3 (Dashboard & IA)
 UI exibir corretamente estados:

“Dados indisponíveis via API”

“Dados parciais”

 Garantir:

UI nunca mostra “0 visitas” quando visits = NULL

IA nunca conclui ausência de visitas sem evidência

 Modal de análise:

Reset de state ao trocar listing

Nenhuma análise herdada

Checklist — Bloco 4 (Automação)
 Validar fluxo pós-OAuth:

OAuth → FULL sync → Visits backfill

 Planejar jobs:

Orders incremental

Visits incremental

Recalcular métricas / score

Critérios de aceite da sessão
listing_metrics_daily populada corretamente

NULL tratado de forma semântica

Nenhuma métrica estimada

Pipeline confiável mesmo com limitações do ML

PRIORIDADE ZERO encerrada oficialmente

