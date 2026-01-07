# DAILY EXECUTION LOG — 2026-01-06

## 🎯 Foco do dia
PRIORIDADE ZERO — ML Data Audit  
Garantir ingestão **real** de dados do Mercado Livre (Listings, Orders, Visits), sem estimativas, alinhada às restrições reais da API.

---

## ✅ Planejado
- [x] Validar OAuth e permissões em ambiente PROD
- [x] Confirmar comportamento real da API de Listings (Search / User Items)
- [x] Definir estratégia canônica para ingestão de listings
- [x] Implementar fallback via Orders
- [x] Popular tabela `listings` em PROD
- [x] Criar auditoria de origem dos dados (`source`, `discovery_blocked`)
- [x] Implementar endpoint de backfill de Visits
- [x] Ajustar debug endpoints e corrigir erros de build

---

## 🧠 Descobertas
- Endpoints de discovery de listings do Mercado Livre  
  (`/sites/MLB/search`, `/users/{id}/items/search`) retornam **403 (PolicyAgent)** mesmo com:
  - OAuth válido
  - Seller real
  - Ambiente PROD (AWS)
- O bloqueio **não é bug** nem erro de implementação — é limitação real da API.
- Orders API funciona corretamente e reflete anúncios reais vendidos.
- Listings podem (e devem) ser descobertos via Orders como fallback.
- Visits API **não retorna dados para todos os itens/dias**, e isso é esperado.
- `listing_metrics_daily` precisa registrar **linhas mesmo quando visits = NULL** para manter trilha auditável.
- Problema identificado no backfill atual: ele executa, mas **não cria linhas quando a API não retorna visitas**.

---

## ⚠️ Bloqueios / riscos
- PolicyAgent impede catálogo completo de anúncios via API.
- Sellers sem vendas recentes não terão listings via fallback Orders.
- Visits API pode retornar vazio → exige tratamento correto de NULL.
- Backfill atual de Visits não grava linhas quando não há retorno da API (BUG CONHECIDO).

---

## 📌 Decisões tomadas
- **Fallback via Orders é a estratégia CANÔNICA** para ingestão de listings.
- Criar auditoria persistente em `listings`:
  - `source` (ex: `orders_fallback`)
  - `discovery_blocked` (boolean)
- Proibido estimar métricas (impressions, clicks, ctr).
- `NULL` é valor explícito e semântico (≠ 0).
- Backfill de Visits deve:
  - Gravar **por dia**
  - Criar linhas mesmo quando visits = NULL
- Corrigir backfill como hotfix antes de encerrar PRIORIDADE ZERO.

---

## ➡️ Próximo passo claro (para amanhã)
- Corrigir lógica do backfill de Visits:
  - Fazer upsert diário **sempre**
  - Registrar visits = NULL quando API não retornar
- Validar `listing_metrics_daily` com rows >= listings × days
- Encerrar oficialmente a PRIORIDADE ZERO
