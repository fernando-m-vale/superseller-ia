# DAILY EXECUTION LOG — 2026-01-20

## 🎯 Foco do dia
Consolidar série diária real no Overview (orders/GMV) e iniciar sincronização de VISITS.

## ✅ Planejado
- [x] Corrigir série diária (range inclusive + UTC) no endpoint /metrics/overview
- [x] Corrigir agregação orders/GMV por dia via listing_metrics_daily
- [x] Corrigir vínculo de order_items com listings (listing_id)
- [x] Criar refresh que sincroniza orders + rebuild metrics
- [x] Corrigir reconexão Mercado Livre (tratamento de erros + schema reauth_required + migrations em PROD)
- [x] Implementar sincronização de visits e expor no /overview
- [ ] Validar visits no DB e na UI com valores > 0
- [ ] Garantir consistência de datas ML vs SuperSeller (timezone e definição de “dia”)

## 🧠 Descobertas
- Série diária (orders/GMV) estava “esparsa” e com range errado; corrigimos para periodDays dias completos e contínuos, em UTC.
- order_items não tinha listing_id preenchido (quebrava agregação por listing); corrigimos ingestão + script de backfill.
- Refresh falhava em trazer pedidos por problema de conexão e filtros na API ML; evoluímos o sync, logs e tratamento.
- Reconexão do ML quebrou por migration não aplicada em PROD (P2022 coluna inexistente); resolvido com migrate deploy/manual.
- VISITS agora não grava mais NULL (default 0 quando fetch ok), porém **todos os valores continuam 0** → precisamos investigar a API/endpoint/escopo/shape retornado pelo ML.

## ⚠️ Bloqueios / riscos
- VISITS persistindo 0 em todos os dias mesmo com vendas e visitas no painel do ML.
  Possíveis causas:
  - endpoint incorreto / parâmetro last/unit incompatível
  - itemId format errado (MLB... vs numérico, ou outra variação)
  - escopo/permissão do token não inclui estatísticas/visitas
  - retorno da API traz visits em outro campo/shape ou por timezone diferente (dia ML ≠ dia UTC)
  - rate limiting / fallback retornando payload vazio silenciosamente

## 📌 Decisões tomadas
- Não automatizar liga/desliga do ambiente por enquanto; criar runbook manual para reduzir custo.
- Manter padrão UTC em todo pipeline (orders, metrics, overview) para consistência interna.
- Próxima sessão focar 100% em VISITS (provar endpoint/retorno e persistência) antes de avançar IA Score V2.

## ➡️ Próximo passo claro
1) Debug de VISITS via logs e chamada direta ao ML (1 itemId) para confirmar:
   - status code, payload, campos e contagem de pontos
2) Ajustar integração de VISITS (endpoint/parâmetros/escopo) até obter visits > 0 no DB
3) Validar /overview: visitsCoverage.filledDays = periodDays e gráfico exibindo visitas
4) Só depois retomar “IA SCORE V2 (Onda 1)”
