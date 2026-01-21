# NEXT SESSION PLAN — 2026-01-21

## ✅ Status atual (hoje encerrou)
- Orders/GMV: OK (série diária contínua, UTC, overview preenchendo periodDays)
- Conexão Mercado Livre: OK (reauth_required + erros tratados + migration aplicada em PROD)
- Visits: PARCIAL
  - ✅ Pipeline e persistência estão rodando (rowsUpserted bate)
  - ✅ Não grava mais NULL (default 0 quando fetch ok)
  - ❌ Todos os values ainda 0 → gráfico zerado

## 🎯 Prioridade absoluta (P0) — VISITS > 0 no DB
### Objetivo (DoD)
- Pelo menos 1 dia no range com `SUM(visits) > 0`
- `/metrics/overview?days=7|30` retorna `visitsByDay` com valores > 0 em dias reais
- UI exibe série de visitas (e não mostra “visitas indisponíveis”)

### Checklist técnico (ordem)
1) Confirmar endpoint real de visitas (chamada direta com token)
   - Escolher 1 listing_id_ext (ex: MLBxxxx)
   - Fazer request manual (curl/Postman) com access_token:
     - endpoint usado no código hoje
     - validar status code + body
   - Se retornar 0 ou vazio, testar endpoints alternativos do ML (verificar doc oficial):
     - possibilidade de endpoint agregado por item/intervalo
     - necessidade de seller_id, date_from/date_to, ou outro recurso

2) Verificar itemId/identificador
   - listing_id_ext no DB está no formato correto para endpoint?
   - Se endpoint exigir numérico, converter/obter o id correto (resolver via /items/{id} ou outro recurso)

3) Verificar permissões/escopo do token
   - Token pode estar ok para orders, mas não para visitas (estatísticas)
   - Se precisar escopo adicional, ajustar flow ou reautorização com permissões corretas

4) Validar timezone/dia
   - Confirmar se a API do ML retorna por dia “local” (BRT) ou UTC
   - Ajustar normalização para mapear corretamente (YYYY-MM-DD) sem “escorregar” 1 dia

5) Persistência
   - Garantir UPSERT atualiza `visits` corretamente
   - Garantir que quando fetch ok e dia não está no payload, o default 0 é aplicado (já implementado)
   - Garantir que quando fetch falha, o valor fique NULL (coverage coerente)

### Queries de validação
- Agregado geral:
  SELECT COUNT(*) total_rows, COUNT(visits) rows_with_visits, COALESCE(SUM(visits),0) total_visits
  FROM listing_metrics_daily
  WHERE tenant_id='<tenant>' AND date>='<from>' AND date<='<to>';

- Série por dia:
  SELECT date::date, SUM(visits) visits
  FROM listing_metrics_daily
  WHERE tenant_id='<tenant>' AND date>='<from>' AND date<='<to>'
  GROUP BY 1 ORDER BY 1;

- Por listing:
  SELECT l.listing_id_ext, COUNT(*) days, COUNT(m.visits) days_with_visits, COALESCE(SUM(m.visits),0) total_visits
  FROM listing_metrics_daily m
  JOIN listings l ON l.id=m.listing_id
  WHERE m.tenant_id='<tenant>' AND m.date>='<from>' AND m.date<='<to>'
  GROUP BY 1 ORDER BY total_visits DESC;

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
