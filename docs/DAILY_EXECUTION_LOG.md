# DAILY EXECUTION LOG — 2026-01-06

## 🎯 Foco do dia
PRIORIDADE ZERO — ML Data Audit  
Garantir ingestão real de dados do Mercado Livre (Listings, Orders, Visits), sem estimativas, alinhada às restrições reais da API.

---

## ✅ Planejado
- [x] Validar ingestão de dados do Mercado Livre em ambiente PROD (AWS)
- [x] Confirmar comportamento da API de Listings (Search / User Items)
- [x] Integrar Visits API real
- [x] Garantir coerência BD → API → IA → UI
- [x] Criar estratégia definitiva para ingestão de listings
- [x] Criar debug endpoints para diagnóstico em produção

---

## 🧠 Descobertas
- A API de discovery de anúncios (`/sites/MLB/search`, `/users/{id}/items/search`) retorna **403 (PolicyAgent)** mesmo com:
  - OAuth válido
  - Seller real
  - Ambiente PROD
- O bloqueio **não é bug** nem erro de implementação.
- Orders API funciona normalmente e reflete anúncios reais vendidos.
- Visits API funciona corretamente **somente após listings existirem**.
- Frontend (app.superselleria.com.br) não expõe rotas da API — chamadas devem ir para `api.superselleria.com.br`.

---

## ⚠️ Bloqueios / riscos
- PolicyAgent do Mercado Livre impede discovery tradicional de listings.
- Sellers sem vendas recentes podem não ter listings via fallback Orders.
- Necessidade de tratar estados “dados parciais” no dashboard.

---

## 📌 Decisões tomadas
- **Fallback via Orders definido como estratégia CANÔNICA** para ingestão de listings.
- Orders passam a ser fonte de descoberta de anúncios quando Search API falhar.
- Proibido estimar métricas (impressions, clicks, ctr).
- `NULL` passa a ser valor explícito e semântico.
- Criar fluxo automático pós-OAuth (FULL + backfill + jobs).
- PRIORIDADE ZERO mantida até fechamento completo do pipeline de dados.

---

## ➡️ Próximo passo claro
- Validar FULL sync + fallback Orders em produção
- Garantir criação real de listings
- Rodar Visits sync com listings existentes
- Ajustar dashboard para estados “carregando / parcial”
- Encerrar PRIORIDADE ZERO
