# DAILY EXECUTION LOG — 2026-01-22

## 🎯 Foco do dia
Diagnóstico e correção do sync de visits + robustez do refresh (orders limit clamp).

## ✅ Planejado / Feito
- [x] Instrumentar `syncVisitsByRange` com logs detalhados (visitsMap sum, intersectionCount, read-back)
- [x] Corrigir parser de visits para formato real do ML (results.total/visits_detail)
- [x] Normalizar datas ISO para YYYY-MM-DD UTC antes de salvar no map
- [x] Adicionar type guard (`VisitPoint`, `isVisitPoint`) para corrigir erro TypeScript TS2322
- [x] Corrigir erro 400 "Limit must be a lower or equal than 51" em orders (clamp explícito)
- [x] Tratamento: erro 400 de orders não interrompe refresh de metrics/visits
- [x] Validar visits no DB: `positive_days = 91`, `total_visits_period = 803`
- [x] Validar UI: gráfico de visitas exibindo valores reais

## 🧠 Descobertas
- **Formato real da API ML:** `response.data.results[]` com campos `date`, `total` e `visits_detail[]` (quantity)
- Parser anterior buscava `entry.visits` que não existia no formato real
- Datas em formato ISO (`2026-01-22T00:00:00Z`) precisavam normalização antes de salvar no map
- **Múltiplas conexões ML:** existe connection `active` (provider_account_id = 189663082) e `revoked` (2019955315)
- Sistema usa sempre a conexão `active` mais recente; divergências de `sellerId` podem explicar diferenças em orders

## ⚠️ Bloqueios / riscos
- **Erro 400 orders limit:** ocorreu em produção; corrigido com clamp `limit <= 51`
- **Orders com connection active vs revoked:** investigar se orders=0 quando connection mudou de sellerId é comportamento esperado

## 📌 Decisões tomadas
- **Visitas:** `0` apenas quando fetch ok e dia ausente no mapa; erro → `NULL`
- **Parser:** extrai na ordem: `entry.visits` → `entry.total` → soma de `visits_detail[].quantity`
- **Orders limit:** clamp explícito `limit = Math.min(requestedLimit ?? 51, 51)` em todos os lugares
- **Erro 400 orders:** não interrompe refresh de metrics/visits; apenas 401/403 interrompem com `reauth_required`
- **Instrumentação:** adicionada para diagnóstico (visitsMap sum, intersectionCount, read-back, DB fingerprint)

## ➡️ Próximo passo claro
1) Validar comportamento de orders quando connection active mudou de sellerId
2) Corrigir testes quebrados (ai-recommendations, metrics.test)
3) Validar botão "Atualizar dados" no UI e garantir que chama endpoint correto e atualiza gráfico
4) Fechar ML Data Audit (visits resolvido, orders validado, testes estáveis)
