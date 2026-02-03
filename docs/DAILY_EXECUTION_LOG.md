# DAILY EXECUTION LOG — 2026-01-22

## ✅ STATUS: CONCLUÍDO

## 🎯 Foco do dia
**Correção definitiva do sync de visits + tratamento de bloqueios PolicyAgent**

---

# DAILY EXECUTION LOG — 2026-01-27 (Dia 2)

## ⚠️ STATUS: TECNICAMENTE FUNCIONAL, PRODUTO AINDA NÃO FECHADO

## 🎯 Foco do dia
**Consolidação da Análise IA Expert (ml-expert-v1) + Descontinuação da V1 + Garantia de cache e controle de custo + Estabilização de arquitetura para evolução futura**

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
- [x] **Ativar Prompt Especialista (ml-expert-v1) em produção**
- [x] **Remover completamente V1 (sem fallback)**
- [x] **Implementar validação robusta de JSON (response_format, regex extraction, retry)**
- [x] **Corrigir bug crítico de listing incorreto (cache invalidation, prompt_version validation)**
- [x] **Implementar normalização snake_case → camelCase no frontend**
- [x] **Atualizar modal para renderizar dados reais do Expert (verdict, titleFix, descriptionFix, imagePlan, priceFix, algorithmHacks, finalActionPlan)**
- [x] **Remover dependência de savedRecommendations**

## 🧠 Descobertas
- **Formato real da API ML:** `response.data.results[]` com campos `date`, `total` e `visits_detail[]` (quantity)
- Parser anterior buscava `entry.visits` que não existia no formato real
- Datas em formato ISO (`2026-01-22T00:00:00Z`) precisavam normalização antes de salvar no map
- **Múltiplas conexões ML:** existe connection `active` (provider_account_id = 189663082) e `revoked` (2019955315)
- Sistema usa sempre a conexão `active` mais recente; divergências de `sellerId` podem explicar diferenças em orders
- **403 PolicyAgent:** Alguns listings retornam `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` mesmo com token válido (listings "órfãos" de conexões antigas)
- **Batch API `/items?ids=...`:** Retorna array na mesma ordem dos IDs enviados; cada item tem `{code, body}` onde `code=200` → item completo, `code!=200` → erro
- **OpenAI retorna JSON não-estrito:** Precisa `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Cache pode ter prompt_version antigo:** Validação obrigatória de `prompt_version` antes de usar cache
- **Frontend esperava camelCase mas API retorna snake_case:** Normalização necessária para compatibilidade
- **Análises misturavam dados entre anúncios:** Bug crítico resolvido com reset de state quando `listingId` muda

## ⚠️ Bloqueios / riscos
- **Erro 400 orders limit:** ocorreu em produção; corrigido com clamp `limit <= 51`
- **Orders com connection active vs revoked:** investigar se orders=0 quando connection mudou de sellerId é comportamento esperado
- **Listings bloqueados por PolicyAgent:** Não são processados em visits/metrics (comportamento correto)
- **🔴 Descrição rasa:** IA entregando descrições curtas que não atendem proposta de valor — **BLOQUEADOR DO DIA 2**
- **🔴 Promoção chutada:** IA afirma "não há promoção" sem dados explícitos — **BLOQUEADOR DO DIA 2**
- **🔴 Vídeo com lógica incorreta:** Sugere "Adicionar vídeo" mesmo com `hasClipDetected = null` — **BLOQUEADOR DO DIA 2**
- **🟡 EditUrl ausente:** Botão "Abrir no Mercado Livre" abre página pública, não edição — **MELHORIA**
- **🟡 UX do modal confusa:** Layout funciona mas precisa hierarquia melhor — **MELHORIA**

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

### Análise IA Expert (ml-expert-v1)
- **V1 oficialmente aposentado:** Sem fallback; sistema usa exclusivamente Prompt Especialista
- **Validação robusta de JSON:** `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Cache com validação de prompt_version:** Regenera automaticamente se `prompt_version` não corresponder
- **Normalização snake_case → camelCase:** Frontend recebe dados normalizados para facilitar uso
- **Bug crítico de listing incorreto resolvido:** Reset de state quando `listingId` muda; validação de `listingId` na resposta

### Decisões conscientes (backlog)
- **Backfill manual:** Por enquanto, backfill de visits é manual via endpoint; automação futura
- **Multi-conexões:** Não resolver suporte a múltiplas conexões ativas simultaneamente agora (usa sempre a mais recente `active`)
- **Inserção manual de anúncios:** Não implementado; sistema depende de sync do ML

### Decisões de produto (registradas)
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos; caso contrário → resposta condicional
- **Descrição é feature central:** Descrição curta = BUG de produto; densidade mínima obrigatória definida no prompt
- **Prompt especialista é o padrão:** V1 oficialmente aposentado; todo output deve ser "pronto para aplicar"

## ➡️ Próximo passo claro
**Encerrar Dia 2: Corrigir bloqueadores de qualidade do output da IA**

1. **Ajustar prompt do Expert para descrição profunda obrigatória**
   - Densidade mínima definida no prompt
   - Estrutura obrigatória (benefícios, tamanhos, confiança, CTA)
   - SEO forte

2. **Corrigir promoção (dados + regra)**
   - Backend deve enviar `has_promotion`, `promotion_price`, `original_price`
   - IA deve dizer "não foi possível confirmar" se dado não existir
   - Não pode afirmar ausência sem certeza

3. **Corrigir lógica de vídeo condicional**
   - `true` → não sugerir
   - `false` → sugerir
   - `null` → sugestão condicional ("se não houver vídeo…")

4. **Implementar editUrl do Mercado Livre**
   - Backend fornece `editUrl`
   - Front prioriza `editUrl` sobre `publicUrl`

5. **Validar novamente output vs expectativa de especialista**
   - Descrição estruturada e profunda
   - Promoção determinística
   - Vídeo com lógica correta
   - Links de edição funcionando

**Só então encerrar Dia 2 oficialmente.**

---

# DAILY EXECUTION LOG — 2026-02-02 (Dia 2 — Especialização da IA Mercado Livre)

## ✅ STATUS: ENCERRADO COM SUCESSO

## 🎯 Foco do dia
**Especialização da IA Mercado Livre: Prompts versionados, validações de qualidade, debug payload e testes com fixture**

## ✅ Planejado / Feito
- [x] **UX V2.1 implementada:** Accordion inline substituindo modal lateral, cards consultor sênior
- [x] **Prompts versionados criados:**
  - `mlExpertV21.ts` — Consultor Sênior com guardrails de qualidade (900 chars, 7 ações, estrutura obrigatória)
  - `mlSalesV22.ts` — Foco em vendas e execução (Plano 7 dias, hypothesis, how_to_execute_today)
  - Registry centralizado (`packages/ai/src/prompts/registry.ts`)
- [x] **Validações de qualidade implementadas:**
  - Description >= 900 caracteres
  - Title >= 45 caracteres (55-60 preferido)
  - Final action plan >= 7 itens
  - Image plan conforme pictures_count
  - **Validação de promoção:** Se `hasPromotion=true`, DEVE mencionar `originalPrice` e `priceFinal`
  - **Validação de clip:** Se `hasClips=null`, NÃO pode afirmar ausência; deve usar frase padrão
- [x] **Retry automático:** Se validação falhar, 1 retry com prompt reforçado
- [x] **Debug payload endpoint:** `GET /api/v1/ai/debug-payload/:listingIdExt` (sanitizado, sem tokens/PII)
- [x] **Fixture e testes:**
  - `item-MLB4217107417.json` criado
  - Testes do registry de prompts (`packages/ai/__tests__/prompts-registry.test.ts`)
  - Testes do validador de qualidade (`apps/api/src/__tests__/ai-quality-validator.test.ts`)
- [x] **Endpoints de promoção:**
  - `POST /api/v1/sync/mercadolivre/listings/:listingIdExt/force-refresh`
  - `POST /api/v1/sync/mercadolivre/listings/backfill-promotions?limit=200`
- [x] **Endpoint de meta:** `GET /api/v1/meta` (gitSha, buildTime, env)
- [x] **Correção de build:** Desabilitado `composite: true` no tsconfig do package ai para gerar `.d.ts` corretamente

## 🧠 Descobertas
- **Prompts versionados:** Estrutura modular permite evolução sem quebrar código existente
- **Validação client-side:** Validação de qualidade antes de retornar ao usuário garante output consistente
- **Retry automático:** 1 retry com prompt reforçado resolve maioria dos casos de validação falha
- **Workaround temporário:** Imports diretos de `@superseller/ai/dist/prompts/*` necessário devido a problema de resolução de módulos TypeScript (registrado como tech debt)
- **Build do package ai:** `composite: true` estava impedindo geração correta de arquivos `.d.ts`

## ⚠️ Bloqueios / Riscos
- **🔴 `/api/v1/meta` retornando 404 em produção:** Suspeita de problema de deploy/gateway/envoy/cache
- **🟡 Workaround de imports diretos:** Registrado como tech debt; precisa corrigir exports do package `@superseller/ai`
- **🟡 Rotas em produção:** Endpoints `force-refresh` e `debug-payload` podem estar retornando 404 (problema de infra/deploy, não conceitual)

## 📌 Decisões tomadas
- **Debug payload é endpoint oficial de transparência da IA:** Permite comparar "o que enviamos" vs "o que volta"
- **Validação de qualidade é gate obrigatório:** Antes de responder usuário, validação garante output consistente
- **Prompts versionados via env:** `AI_PROMPT_VERSION` permite alternar entre V2.1 Expert e V2.2 Sales
- **Registry centralizado:** Facilita acesso e evolução de prompts
- **Fixture para testes:** `item-MLB4217107417.json` permite testes anti-regressão

## ➡️ Próximo passo claro
**Dia 3: Análise Profunda de Anúncio**
1. Validar qual serviço está rodando atrás de `api.superselleria.com.br`
2. Usar `/sync/status` vs `/meta` para identificar mismatch
3. Validar promo e debug-payload com ambiente correto
4. Comparar output da IA com análise humana (MLB4217107417)

---

## ✅ Planejado / Feito (Dia 2 — Detalhado)
- [x] Finalizar prompt e schema da IA Expert (ml-expert-v1)
- [x] Integrar Expert ao backend (`POST /api/v1/ai/analyze/:listingId`)
- [x] Remover completamente V1 (sem fallback)
- [x] Implementar validação robusta de JSON (response_format, regex extraction, retry)
- [x] Garantir cache funcional (regeneração quando `analysisV21` ausente)
- [x] Corrigir bug crítico de listing incorreto (cache invalidation, prompt_version validation)
- [x] Integrar Expert ao frontend (types, hook, componente)
- [x] Implementar normalização snake_case → camelCase
- [x] Remover UI V1 completamente
- [x] Implementar UX de cache (banner quando cacheHit, botão "Regerar análise")
- [x] Corrigir binding completo do `analysisV21` no frontend
- [x] Renderizar diagnóstico, ações, título sugerido, descrição sugerida, análise de preço, plano de imagens, hacks algorítmicos
- [x] Corrigir erros de build TypeScript (tipos, variáveis não declaradas)
- [x] Validar fluxo completo de análise por anúncio
- [x] Remover dependência de savedRecommendations

## 🧠 Descobertas (Dia 2 — Detalhado)
- **Expert gera JSON rico e confiável:** Schema estruturado com `verdict`, `title_fix`, `description_fix`, `image_plan`, `price_fix`, `algorithm_hacks`, `final_action_plan`
- **OpenAI retorna JSON não-estrito:** Precisa `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Binding cuidadoso no frontend:** Schema real da API é `response.data.analysisV21` (não `response.data.data.analysisV21`)
- **Cache é essencial para controle de custos:** OpenAI GPT-4o é caro; cache por listing evita chamadas redundantes
- **Normalização necessária:** API retorna snake_case mas frontend espera camelCase
- **Análises misturavam dados entre anúncios:** Bug crítico resolvido com reset de state quando `listingId` muda
- **Limitações da API do Mercado Livre:** Exigem decisões de produto (ex: backfill manual por enquanto)
- **Problemas atuais são de qualidade do output, não de integração:** Expert funciona bem; desafio é garantir profundidade e precisão

## ⚠️ Bloqueios / Riscos (Dia 2 — Detalhado)
- **Mapping incompleto do analysisV21 no frontend:** Inicialmente tentou acessar campos inexistentes — **RESOLVIDO**
- **🔴 Descrição rasa:** IA entregando descrições curtas que não atendem proposta de valor — **BLOQUEADOR DO DIA 2**
- **🔴 Promoção chutada:** IA afirma "não há promoção" sem dados explícitos — **BLOQUEADOR DO DIA 2**
- **🔴 Vídeo com lógica incorreta:** Sugere "Adicionar vídeo" mesmo com `hasClipDetected = null` — **BLOQUEADOR DO DIA 2**
- **🟡 EditUrl ausente:** Botão "Abrir no Mercado Livre" abre página pública, não edição — **MELHORIA**
- **🟡 UX do modal confusa:** Layout funciona mas precisa hierarquia melhor — **MELHORIA**
- **CI rodando em commit antigo:** Commit `d7d90e9` ainda tinha código antigo; commit `0ad1bf2` corrigiu — **RESOLVIDO**

## 📌 Decisões tomadas (Dia 2 — Detalhado)

### Análise IA Expert (ml-expert-v1)
- **V1 da análise de IA foi oficialmente descontinuada:** Apenas Expert será exibida ao usuário
- **Cache reaproveitado da V1 para Expert:** Cache existente é regenerado automaticamente quando `analysisV21` ausente
- **Sem fallback para V1:** Se Expert falhar, sistema retorna erro 502 com mensagem clara
- **Versionamento de prompt:** `PROMPT_VERSION = 'ml-expert-v1'` para invalidação de cache
- **Validação robusta de JSON:** `response_format: { type: 'json_object' }` + regex extraction + retry com prompt reforçado
- **Normalização snake_case → camelCase:** Frontend recebe dados normalizados para facilitar uso

### Backfill e Automação
- **Backfill automático ficará para fase futura:** Decisão consciente de manter manual por enquanto
- **Preparar fundação para análise de imagens:** Armazenar `pictures_json`, `pictures_count` sem ativar IA visual agora

### Frontend
- **Remoção completa da UI V1:** Modal exibe apenas Expert
- **UX de cache:** Banner discreto quando `cacheHit=true` ou `message.includes('(cache)')`
- **Botão "Regerar análise":** Sempre disponível quando `analysisV21` existe; chama endpoint com `forceRefresh=true`
- **Normalização de dados:** Frontend recebe dados em camelCase via `normalizeAiAnalyzeResponse`

### Integração
- **Schema real da API:** `response.data.analysisV21` (não `response.data.data.analysisV21`)
- **Metadados para UX:** `analyzedAt`, `cacheHit`, `message` expostos no hook para feedback ao usuário
- **Bug crítico de listing incorreto resolvido:** Reset de state quando `listingId` muda; validação de `listingId` na resposta

### Decisões de produto (registradas)
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos; caso contrário → resposta condicional
- **Descrição é feature central:** Descrição curta = BUG de produto; densidade mínima obrigatória definida no prompt
- **Prompt especialista é o padrão:** V1 oficialmente aposentado; todo output deve ser "pronto para aplicar"

## ➡️ Próximo passo claro (Dia 2 → Dia 3)
**Encerrar pendências do Dia 2 e estabilizar completamente a Análise IA Expert:**

1. **Ajustar prompt do Expert para descrição profunda obrigatória**
   - Densidade mínima definida no prompt
   - Estrutura obrigatória (benefícios, tamanhos, confiança, CTA)
   - SEO forte

2. **Corrigir promoção (dados + regra)**
   - Backend deve enviar `has_promotion`, `promotion_price`, `original_price`
   - IA deve dizer "não foi possível confirmar" se dado não existir
   - Não pode afirmar ausência sem certeza

3. **Corrigir lógica de vídeo condicional**
   - `true` → não sugerir
   - `false` → sugerir
   - `null` → sugestão condicional ("se não houver vídeo…")

4. **Implementar editUrl do Mercado Livre**
   - Backend fornece `editUrl`
   - Front prioriza `editUrl` sobre `publicUrl`

5. **Validar novamente output vs expectativa de especialista**
   - Descrição estruturada e profunda
   - Promoção determinística
   - Vídeo com lógica correta
   - Links de edição funcionando

**Só então encerrar Dia 2 oficialmente.**
