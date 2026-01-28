# DAILY EXECUTION LOG — 2026-01-22

## ✅ STATUS: CONCLUÍDO

## 🎯 Foco do dia
**Correção definitiva do sync de visits + tratamento de bloqueios PolicyAgent**

---

# DAILY EXECUTION LOG — 2026-01-27 (Dia 2)

## ✅ STATUS: EM FINALIZAÇÃO

## 🎯 Foco do dia
**Consolidação da Análise IA V2.1 (backend + frontend) + Descontinuação da V1 + Garantia de cache e controle de custo + Estabilização de arquitetura para evolução futura**

## ✅ Planejado / Feito
- [x] Instrumentar `syncVisitsByRange` com logs detalhados (visitsMap sum, intersectionCount, read-back)
- [x] Corrigir parser de visits para formato real do ML (results.total/visits_detail)
- [x] Normalizar datas ISO para YYYY-MM-DD UTC antes de salvar no map
- [x] Adicionar type guard (`VisitPoint`, `isVisitPoint`) para corrigir erro TypeScript TS2322
- [x] Corrigir erro 400 "Limit must be a lower or equal than 51" em orders (clamp explícito)
- [x] Tratamento: erro 400 de orders não interrompe refresh de metrics/visits
- [x] Validar visits no DB: `positive_days = 91`, `total_visits_period = 803`
- [x] Validar UI: gráfico de visitas exibindo valores reais
- [x] **Implementar tratamento de 403 PolicyAgent (PA_UNAUTHORIZED_RESULT_FROM_POLICIES)**
- [x] **Introduzir `access_status` (accessible / unauthorized / blocked_by_policy)**
- [x] **Reconciliação de status paused vs active via batch API autenticada**
- [x] **Observabilidade via `/refresh` (reconcile.details com actionTaken)**
- [x] **Filtros de sync: excluir listings com `access_status != accessible`**

## 🧠 Descobertas
- **Formato real da API ML:** `response.data.results[]` com campos `date`, `total` e `visits_detail[]` (quantity)
- Parser anterior buscava `entry.visits` que não existia no formato real
- Datas em formato ISO (`2026-01-22T00:00:00Z`) precisavam normalização antes de salvar no map
- **Múltiplas conexões ML:** existe connection `active` (provider_account_id = 189663082) e `revoked` (2019955315)
- Sistema usa sempre a conexão `active` mais recente; divergências de `sellerId` podem explicar diferenças em orders
- **403 PolicyAgent:** Alguns listings retornam `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` mesmo com token válido (listings "órfãos" de conexões antigas)
- **Batch API `/items?ids=...`:** Retorna array na mesma ordem dos IDs enviados; cada item tem `{code, body}` onde `code=200` → item completo, `code!=200` → erro

## ⚠️ Bloqueios / riscos
- **Erro 400 orders limit:** ocorreu em produção; corrigido com clamp `limit <= 51`
- **Orders com connection active vs revoked:** investigar se orders=0 quando connection mudou de sellerId é comportamento esperado
- **Listings bloqueados por PolicyAgent:** Não são processados em visits/metrics (comportamento correto)

## 📌 Decisões tomadas

### Visits (NULL vs 0)
- **Visitas:** `0` apenas quando fetch ok e dia ausente no mapa; erro → `NULL`
- **Parser:** extrai na ordem: `entry.visits` → `entry.total` → soma de `visits_detail[].quantity`
- **Normalização:** datas ISO convertidas para `YYYY-MM-DD` UTC antes de salvar no map

### Orders
- **Limit clamp:** `limit` nunca excede 51 (ML API não aceita > 51)
- **Erro 400:** não interrompe refresh de metrics/visits; apenas 401/403 interrompem com `reauth_required`

### Access Control & PolicyAgent
- **`access_status`:** Separação clara entre status do anúncio (`active`/`paused`) e acesso via API (`accessible`/`unauthorized`/`blocked_by_policy`)
- **403 PolicyAgent:** Marca `access_status='blocked_by_policy'` com `access_blocked_code`, `access_blocked_reason`, `access_blocked_at`
- **Não alterar `status`:** Quando bloqueado por PolicyAgent, `status` permanece desconhecido (não alterar)
- **Filtros de sync:** Processar apenas listings com `access_status='accessible'` E `status IN ('active', 'paused')`
- **Reconciliação:** Verifica `paused` no DB vs `active` no ML e atualiza; também verifica se listings bloqueados voltaram a ser acessíveis

### Observabilidade
- **Instrumentação:** adicionada para diagnóstico (visitsMap sum, intersectionCount, read-back, DB fingerprint)
- **`/refresh` response:** Inclui `reconcile.details` com `actionTaken` ('marked_blocked_by_policy', 'updated_status', 'skipped', etc.)
- **Logs limitados:** Apenas primeiros 10 listings para não poluir logs

### Decisões conscientes (backlog)
- **Backfill manual:** Por enquanto, backfill de visits é manual via endpoint; automação futura
- **Multi-conexões:** Não resolver suporte a múltiplas conexões ativas simultaneamente agora (usa sempre a mais recente `active`)
- **Inserção manual de anúncios:** Não implementado; sistema depende de sync do ML

## ➡️ Próximo passo claro
**Dia 2: Foco em Orders + estrutura multi-contas**
1) Validar comportamento de orders quando connection active mudou de sellerId
2) Investigar estrutura para suportar múltiplas contas/conexões (UX e backend)
3) Corrigir testes quebrados (ai-recommendations, metrics.test)
4) Validar botão "Atualizar dados" no UI

---

## ✅ Planejado / Feito (Dia 2)
- [x] Finalizar prompt e schema da IA V2.1
- [x] Integrar V2.1 ao backend (`POST /api/v1/ai/analyze/:listingId`)
- [x] Implementar conversão V2.1 → V1 compatível (`convertV21ToV1`)
- [x] Ativar V2.1 na rota com fallback para V1
- [x] Garantir cache funcional (regeneração quando `analysisV21` ausente)
- [x] Integrar V2.1 ao frontend (types, hook, componente)
- [x] Remover UI V1 completamente
- [x] Implementar UX de cache (banner quando cacheHit, botão "Regerar análise")
- [x] Corrigir binding completo do `analysisV21` no frontend
- [x] Renderizar diagnóstico, ações, título sugerido, descrição sugerida, análise de preço, análise de mídia
- [x] Corrigir erros de build TypeScript (tipos, variáveis não declaradas)
- [x] Validar fluxo completo de análise por anúncio

## 🧠 Descobertas (Dia 2)
- **V2.1 gera JSON rico e confiável:** Schema estruturado com `diagnostic`, `actions`, `title_analysis`, `description_analysis`, `price_analysis`, `media_analysis`
- **Binding cuidadoso no frontend:** Schema real da API é `response.data.analysisV21` (não `response.data.data.analysisV21`)
- **Cache é essencial para controle de custos:** OpenAI GPT-4o é caro; cache por listing evita chamadas redundantes
- **Limitações da API do Mercado Livre:** Exigem decisões de produto (ex: backfill manual por enquanto)
- **Problemas atuais são de integração, não de lógica ou IA:** V2.1 funciona bem; desafio foi mapear corretamente no frontend

## ⚠️ Bloqueios / Riscos (Dia 2)
- **Mapping incompleto do analysisV21 no frontend:** Inicialmente tentou acessar campos inexistentes (`verdict`, `title.suggested`, `description.fullText`, `images.plan`) — **RESOLVIDO**
- **Preço promocional ainda não refletido corretamente:** `price_base` vs `price_final` precisa validação visual
- **UX com termos técnicos:** "V2.1", "indisponível" não orientados ao usuário final — precisa refinamento de copy
- **CI rodando em commit antigo:** Commit `d7d90e9` ainda tinha código antigo; commit `0ad1bf2` corrigiu — **RESOLVIDO**

## 📌 Decisões tomadas (Dia 2)

### Análise IA V2.1
- **V1 da análise de IA foi oficialmente descontinuada:** Apenas V2.1 será exibida ao usuário
- **Cache reaproveitado da V1 para V2.1:** Cache existente é regenerado automaticamente quando `analysisV21` ausente
- **Fallback para V1:** Se V2.1 falhar, sistema ainda pode gerar V1 (mas não exibe ao usuário)
- **Versionamento de prompt:** `PROMPT_VERSION = 'ai-v2.1'` para invalidação de cache

### Backfill e Automação
- **Backfill automático ficará para fase futura:** Decisão consciente de manter manual por enquanto
- **Preparar fundação para análise de imagens:** Armazenar `pictures_json`, `pictures_count` sem ativar IA visual agora

### Frontend
- **Remoção completa da UI V1:** Modal exibe apenas V2.1
- **UX de cache:** Banner discreto quando `cacheHit=true` ou `message.includes('(cache)')`
- **Botão "Regerar análise":** Sempre disponível quando `analysisV21` existe; chama endpoint com `forceRefresh=true`

### Integração
- **Schema real da API:** `response.data.analysisV21` (não `response.data.data.analysisV21`)
- **Metadados para UX:** `analyzedAt`, `cacheHit`, `message` expostos no hook para feedback ao usuário

## ➡️ Próximo passo claro (Dia 2 → Dia 3)
**Encerrar pendências do Dia 2 e estabilizar completamente a Análise IA V2.1:**
1) Validar renderização completa de todos os campos do `analysisV21`
2) Corrigir exibição de preço base vs preço promocional
3) Ajustar copy do modal para linguagem de usuário final (remover termos técnicos)
4) Validar cache (não gerar nova análise sem necessidade)
5) Confirmar que não há chamadas redundantes à OpenAI
