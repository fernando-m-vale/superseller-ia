# ARCHITECTURE DECISIONS RECORD (ADR)

Este documento registra decisões arquiteturais importantes do SuperSeller IA.

## ADR-001: Padronização de tenant_id

**Data:** 2026-01-27  
**Status:** Decisão registrada, implementação futura

### Contexto
O sistema atualmente apresenta inconsistência no tipo de `tenant_id`:
- Algumas tabelas/consultas usam `TEXT`
- Outras usam `UUID`
- Comparações diretas podem falhar silenciosamente

### Decisão
**Padronizar `tenant_id` como UUID no domínio.**

### Justificativa
- UUID garante unicidade global
- Melhor performance em índices
- Padrão PostgreSQL recomendado para identificadores
- Facilita integrações futuras

### Impacto futuro
- Migração de dados existentes (TEXT → UUID)
- Atualização de queries e comparações
- Validação de formato em endpoints
- **Não é bloqueador atual:** Cast explícito mantém compatibilidade

### Alternativas consideradas
- Manter TEXT: Não escalável, problemas de performance
- UUID híbrido: Complexidade desnecessária

---

## ADR-002: Cache de Análise IA

**Data:** 2026-01-27  
**Status:** Implementado

### Contexto
Análise IA V2.1 usa OpenAI GPT-4o, que é caro. Chamadas redundantes aumentam custos desnecessariamente.

### Decisão
**Implementar cache de análise por listing com regeneração automática quando `analysisV21` ausente.**

### Justificativa
- OpenAI GPT-4o é caro por requisição
- Análise de um listing não muda frequentemente
- Cache evita custos desnecessários
- Regeneração automática garante dados atualizados quando necessário

### Implementação
- Cache armazenado em `ai_analysis_cache.result_json` (JSONB)
- Chave de cache: `fingerprint` (SHA256 hash de listing + prompt_version)
- `PROMPT_VERSION = 'ai-v2.1'` para invalidação de cache
- Se cache existe mas não tem `analysisV21`, considera inválido e regenera
- Botão "Regerar análise" permite bypass manual do cache

### Impacto
- **Custo:** Redução significativa de chamadas à OpenAI
- **Performance:** Respostas instantâneas quando cache hit
- **UX:** Banner discreto informa quando resultado vem do cache

### Alternativas consideradas
- Sem cache: Custos proibitivos
- Cache com TTL fixo: Menos flexível, pode regenerar desnecessariamente
- Cache apenas V1: Não aproveita melhorias da V2.1

---

## ADR-003: Análise de Imagens (Fundação)

**Data:** 2026-01-27  
**Status:** Fundação implementada, análise visual futura

### Contexto
Análise visual de imagens por IA seria valiosa, mas adiciona complexidade e custo significativos.

### Decisão
**Armazenar dados de imagens (`pictures_json`, `pictures_count`) sem ativar análise visual por IA neste momento.**

### Justificativa
- Análise visual por IA é cara e complexa
- Dados de imagens são úteis mesmo sem análise visual
- Fundação permite ativação futura sem refatoração
- Decisão consciente para evitar complexidade prematura

### Implementação
- `Listing.pictures_json` (JSONB): Array completo de pictures do ML
- `Listing.pictures_count`: Contagem de imagens
- Ingestão durante sync normal do Mercado Livre
- **Sem análise visual por IA:** Decisão consciente

### Impacto futuro
- Quando análise visual for necessária, dados já estão disponíveis
- Evita refatoração de schema e ingestão
- Permite ativação incremental (ex: apenas para listings com score baixo)

### Alternativas consideradas
- Análise visual imediata: Complexidade e custo prematuros
- Não armazenar dados: Perde oportunidade futura
- Armazenar apenas contagem: Limita análise futura

---

## ADR-004: Descontinuação da Análise IA V1

**Data:** 2026-01-27  
**Status:** Implementado

### Contexto
Análise IA V2.1 oferece estrutura rica e acionável, enquanto V1 é limitada.

### Decisão
**V1 da análise de IA foi oficialmente descontinuada. Apenas V2.1 será exibida ao usuário.**

### Justificativa
- V2.1 oferece estrutura muito mais rica (`diagnostic`, `actions`, `title_analysis`, `description_analysis`, etc.)
- V1 é limitada e não atende necessidades futuras
- Manter ambas cria confusão e complexidade desnecessária
- V2.1 tem fallback para V1 se necessário (mas não exibe ao usuário)

### Implementação
- UI V1 removida completamente do frontend
- Backend mantém conversão V2.1 → V1 (`convertV21ToV1`) para compatibilidade interna
- Cache V1 é regenerado automaticamente para V2.1 quando necessário
- Modal exibe apenas painel V2.1

### Impacto
- **UX:** Interface mais limpa e focada
- **Manutenção:** Menos código para manter
- **Evolução:** Foco único em melhorar V2.1

### Alternativas consideradas
- Manter ambas: Complexidade desnecessária
- Migração gradual: Atraso desnecessário, V2.1 já está pronta

---

## ADR-005: Backfill Manual (Decisão Consciente)

**Data:** 2026-01-27  
**Status:** Decisão consciente, automação futura

### Contexto
Backfill automático de visits/metrics seria útil, mas adiciona complexidade operacional.

### Decisão
**Backfill automático ficará para fase futura. Por enquanto, backfill é manual via endpoint.**

### Justificativa
- Backfill automático requer scheduler/cron configurado
- Complexidade operacional (monitoramento, alertas, tratamento de erros)
- Backfill manual atende necessidades atuais
- Decisão consciente para focar em estabilização primeiro

### Implementação
- Endpoint interno para backfill manual: `POST /api/v1/sync/mercadolivre/backfill`
- Automação futura via EventBridge Scheduler ou cron job
- Documentação de processo manual disponível

### Impacto futuro
- Quando necessário, implementar scheduler dedicado
- Monitoramento e alertas para falhas de backfill
- Tratamento de erros e retry logic

### Alternativas consideradas
- Backfill automático imediato: Complexidade prematura
- Sem backfill: Perde dados históricos importantes

---

## ADR-006: Multi-conexões (Usar Sempre a Mais Recente)

**Data:** 2026-01-27  
**Status:** Implementado, evolução futura planejada

### Contexto
Sistema pode ter múltiplas conexões Mercado Livre (ativas, revogadas, expiradas).

### Decisão
**Sistema usa sempre a conexão `active` mais recente. Suporte a múltiplas conexões simultâneas será implementado no futuro.**

### Justificativa
- Maioria dos casos usa apenas uma conexão ativa
- Suporte completo a múltiplas conexões adiciona complexidade significativa (UX, backend, dados)
- Decisão consciente para focar em estabilização primeiro
- Fundação permite evolução futura

### Implementação
- Query sempre filtra por `status = 'active'` e ordena por `created_at DESC`
- Listings vinculados à conexão ativa via `marketplace_connection_id`
- Sync processa apenas listings da conexão ativa

### Impacto futuro
- Quando necessário, implementar:
  - Seletor de conta no dashboard
  - Filtro por conexão
  - Dashboard consolidado vs por conta
  - Identidade visual da conta conectada

### Alternativas consideradas
- Suporte completo imediato: Complexidade prematura
- Sempre usar primeira conexão: Pode usar conexão antiga/revogada

---

## ADR-007: IA NÃO DEVE CHUTAR DADOS

**Data:** 2026-01-27  
**Status:** Decisão registrada, implementação em progresso

### Contexto
A IA estava afirmando ausência de promoção ou sugerindo ações sem dados explícitos, gerando informações incorretas.

### Decisão
**IA NÃO DEVE CHUTAR DADOS. Promoção e vídeo só podem ser afirmados com dados explícitos. Caso contrário → resposta condicional.**

### Justificativa
- Informações incorretas prejudicam confiança do usuário
- Afirmar ausência sem certeza é enganoso
- Resposta condicional é mais honesta e útil
- Dados explícitos garantem precisão

### Implementação
- **Promoção:** Se `has_promotion` não for fornecido ou for `null`, IA deve dizer "não foi possível confirmar se há promoção"
- **Vídeo:** Lógica condicional:
  - `hasClipDetected = true` → não sugerir adicionar vídeo
  - `hasClipDetected = false` → sugerir adicionar vídeo
  - `hasClipDetected = null` → sugestão condicional ("se não houver vídeo, considere adicionar…")
- **Backend:** Deve enviar `has_promotion`, `promotion_price`, `original_price` no input da IA

### Impacto
- **Precisão:** Informações mais confiáveis
- **Confiança:** Usuário sabe quando dados são incertos
- **Qualidade:** Output mais honesto e útil

### Alternativas consideradas
- Chutar dados: Gera informações incorretas
- Omitir completamente: Perde oportunidade de ajudar

---

## ADR-008: Descrição é Feature Central

**Data:** 2026-01-27  
**Status:** Decisão registrada, implementação em progresso

### Contexto
A IA estava entregando descrições rasas que não atendiam a proposta de valor do SuperSeller IA.

### Decisão
**Descrição é feature central. Descrição curta = BUG de produto. Densidade mínima obrigatória definida no prompt.**

### Justificativa
- Descrição é uma das principais entregas do SuperSeller IA
- Descrições rasas não atendem proposta de valor
- Copy pronta para colar é essencial
- Estrutura e SEO são críticos para conversão

### Implementação
- **Prompt:** Regra de densidade mínima obrigatória
- **Estrutura obrigatória:** Benefícios, tamanhos, confiança, CTA
- **SEO forte:** Palavras-chave relevantes
- **Copy pronta:** Texto completo pronto para colar no Mercado Livre

### Impacto
- **Valor:** Entrega principal do produto
- **Conversão:** Descrições profundas aumentam conversão
- **UX:** Copy pronta para usar

### Alternativas consideradas
- Descrições rasas: Não atende proposta de valor
- Estrutura opcional: Perde consistência

---

## ADR-009: Prompt Especialista é o Padrão

**Data:** 2026-01-27  
**Status:** Implementado

### Contexto
V1 da análise IA era genérica e não atendia necessidades específicas do Mercado Livre.

### Decisão
**Prompt especialista (ml-expert-v1) é o padrão. V1 oficialmente aposentado. Todo output deve ser "pronto para aplicar".**

### Justificativa
- Prompt especialista oferece análises mais profundas e acionáveis
- V1 era genérica e não atendia necessidades específicas
- Output "pronto para aplicar" é essencial para proposta de valor
- Foco único permite melhorias contínuas

### Implementação
- **Prompt ml-expert-v1:** Consultor sênior especialista em Mercado Livre
- **Sem fallback para V1:** Se Expert falhar, sistema retorna erro 502
- **Output estruturado:** `verdict`, `title_fix`, `description_fix`, `image_plan`, `price_fix`, `algorithm_hacks`, `final_action_plan`
- **Versionamento:** `PROMPT_VERSION = 'ml-expert-v1'` para invalidação de cache

### Impacto
- **Qualidade:** Análises mais profundas e acionáveis
- **Foco:** Melhorias contínuas em um único prompt
- **Valor:** Output "pronto para aplicar" atende proposta de valor

### Alternativas consideradas
- Manter V1 como fallback: Complexidade desnecessária
- Migração gradual: Atraso desnecessário, Expert já está pronto

---

## ADR-010: Debug Payload é Endpoint Oficial de Transparência da IA

**Data:** 2026-02-02  
**Status:** Implementado

### Contexto
Necessidade de transparência sobre o que a IA recebe vs o que retorna, para debug e validação de qualidade.

### Decisão
**Debug payload (`GET /api/v1/ai/debug-payload/:listingIdExt`) é endpoint oficial de transparência da IA.**

### Justificativa
- Permite comparar "o que enviamos" vs "o que volta"
- Facilita debug de problemas de qualidade
- Sanitizado (sem tokens/PII) garante segurança
- Essencial para validação de payloads em produção

### Implementação
- Endpoint: `GET /api/v1/ai/debug-payload/:listingIdExt`
- Auth obrigatório (mesmo guard de rotas existentes)
- Retorna snapshot sanitizado:
  - `listingIdExt`, `listingId`, `tenantId`, `fetchedAt`
  - `prompt` (version, model, temperature)
  - `listing` (title, status, picturesCount, hasClips)
  - `pricing` (price, priceFinal, originalPrice, hasPromotion, discountPercent, source)
  - `metrics30d` (visits, orders, revenue, conversionRate, ctr)
  - `dataQuality` (missing, warnings)
  - `aiInputSummary` (hasTitle, hasDescription, hasPictures, hasPromotionFlag, hasMetrics)
- **NÃO retorna:** tokens, headers, prompt raw completo, urls sensíveis, PII

### Impacto
- **Transparência:** Desenvolvedores podem validar payloads
- **Debug:** Facilita identificação de problemas
- **Qualidade:** Permite validação de dados enviados à IA

### Alternativas consideradas
- Logs apenas: Menos acessível, não sanitizado
- Endpoint sem auth: Risco de segurança

---

## ADR-011: Validação de Qualidade é Gate Obrigatório

**Data:** 2026-02-02  
**Status:** Implementado

### Contexto
Output da IA precisa atender padrões mínimos de qualidade antes de ser exibido ao usuário.

### Decisão
**Validação de qualidade é gate obrigatório antes de responder usuário.**

### Justificativa
- Garante output consistente e de alta qualidade
- Evita exibir análises rasas ou incompletas
- Retry automático resolve maioria dos casos
- Melhora experiência do usuário

### Implementação
- **Validações hard constraints:**
  - `description_fix.optimized_copy` >= 900 caracteres
  - `title_fix.after` >= 45 caracteres (55-60 preferido)
  - `final_action_plan` >= 7 itens
  - `image_plan` conforme `pictures_count`
  - **Promoção:** Se `hasPromotion=true`, DEVE mencionar `originalPrice` e `priceFinal`
  - **Clip:** Se `hasClips=null`, NÃO pode afirmar ausência; deve usar frase padrão
- **Retry automático:** Se validação falhar, 1 retry com prompt reforçado
- **Log estruturado:** Issues de qualidade são logados para análise

### Impacto
- **Qualidade:** Output sempre atende padrões mínimos
- **Consistência:** Análises sempre profundas e estruturadas
- **Confiança:** Usuário recebe sempre análises de alta qualidade

### Alternativas consideradas
- Sem validação: Output inconsistente, qualidade variável
- Validação apenas no frontend: Problemas só aparecem depois de gerar análise

---

## ADR-012: Seleção de Conexão de Marketplace

**Data:** 2026-02-03  
**Status:** Implementado

### Contexto
Sistema pode ter múltiplas conexões Mercado Livre por tenant (ativas, expiradas, revogadas). Código usava `findFirst` sem ordenação, causando seleção não-determinística e uso de conexão incorreta.

### Decisão
**Implementar `resolveMercadoLivreConnection()` com critérios explícitos:**
1. **Prioridade 1:** `access_token` presente E `expires_at` no futuro → prioridade máxima
2. **Prioridade 2:** `refresh_token` presente → prioridade
3. **Prioridade 3:** Fallback por `updated_at DESC` → mais recente

### Justificativa
- Evita uso de conexões antigas/inválidas
- Garante consistência em sync, backfill e análises
- Previne bugs silenciosos em produção
- Seleção determinística facilita debug e observabilidade

### Implementação
- **Resolver centralizado:** `apps/api/src/utils/ml-connection-resolver.ts`
- **Helper de token:** `apps/api/src/utils/ml-token-helper.ts` — não exige refresh_token se access_token válido
- **Logs estruturados:** `connectionId`, `providerAccountId`, `reason`, `expiresAt`, `updatedAt` (sem tokens/PII)
- **Aplicado em:** `MercadoLivreSyncService`, `MercadoLivreVisitsService`, `MercadoLivreOrdersService`

### Consequência
- **Código mais explícito:** Critérios de seleção claros e documentados
- **Menos "mágica":** Seleção determinística, não aleatória
- **Mais previsibilidade operacional:** Logs mostram qual conexão foi usada e por quê
- **Padrão aplicável:** Regra de arquitetura para futuras integrações (Shopee, etc)

### Alternativas consideradas
- Manter `findFirst` sem ordenação: Seleção não-determinística, bugs silenciosos
- Sempre usar primeira conexão: Pode usar conexão antiga/revogada
- Ordenar apenas por `updated_at`: Ignora validade do token

---

## ADR-013: Prices API como Fonte de Promoção

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
Promoções não eram capturadas corretamente via `/items?ids=...` (multiget). Mercado Livre recomenda usar `/items/{id}/prices` para dados de preços/promoções.

### Decisão
**Usar `/items/{id}/prices` (Prices API) como fonte de verdade para promoções. Fallback para `/items/{id}` se `/prices` falhar (403/404).**

### Justificativa
- Prices API é endpoint recomendado pelo ML para preços/promoções
- Retorna dados estruturados de `sale_price`, `prices`, `reference_prices`, `promotions`, `deals`
- Fallback garante robustez mesmo se endpoint não estiver disponível
- Enriquecimento automático quando multiget não traz dados suficientes

### Implementação
- **Método `fetchItemPrices()`:** Busca dados via `/items/{id}/prices`
- **Método `enrichItemPricing()`:** Prioriza Prices API, fallback para `/items/{id}`
- **Concorrência limitada:** 5 itens simultâneos para evitar rate limits
- **Logs estruturados:** `endpointUsed`, `hasSalePrice`, `pricesCount`, `referencePricesCount`
- **Campos garantidos:** `original_price`, `price_final`, `has_promotion`, `discount_percent`, `promotion_type`

### Impacto
- **Precisão:** Promoções capturadas corretamente
- **Robustez:** Fallback garante funcionamento mesmo com falhas
- **Observabilidade:** Logs permitem diagnóstico de problemas

### Alternativas consideradas
- Apenas multiget: Não captura promoções ativas
- Sem fallback: Quebra quando endpoint não disponível
- Enriquecimento síncrono: Muito lento para lotes grandes

---

## ADR-014: AI Prompt Versioning + Cache Invalidation

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
Cache de análise IA não invalidava quando prompt mudava, causando uso de análises geradas com prompt antigo.

### Decisão
**Fingerprint dinâmico deve incluir `AI_PROMPT_VERSION` para invalidar cache automaticamente quando prompt muda.**

### Justificativa
- Prompts evoluem e análises antigas podem não refletir melhorias
- Cache deve ser invalidado quando prompt muda
- Fingerprint dinâmico garante invalidação automática
- Evita análises inconsistentes com prompt atual

### Implementação
- **Fingerprint inclui `AI_PROMPT_VERSION`:** Hash SHA256 de listing + metrics + `AI_PROMPT_VERSION`
- **Validação de prompt_version:** Cache é considerado inválido se `prompt_version` não corresponder
- **Regeneração automática:** Se cache existe mas `prompt_version` não corresponde, regenera automaticamente
- **Variável de ambiente:** `AI_PROMPT_VERSION` permite alternar entre versões sem deploy

### Impacto
- **Consistência:** Análises sempre refletem prompt atual
- **Flexibilidade:** Mudança de prompt não requer limpeza manual de cache
- **Qualidade:** Evita uso de análises geradas com prompt antigo

### Alternativas consideradas
- TTL fixo: Menos flexível, pode regenerar desnecessariamente
- Limpeza manual: Complexidade operacional
- Sem versionamento: Análises inconsistentes

---

## ADR-015: Sanitização de Conteúdo Gerado Antes de Exibir e Quando Cacheado

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
Output da IA continha emojis e markdown que quebravam UI. Análises em cache não passavam por sanitização.

### Decisão
**Sanitização (`sanitizeExpertAnalysis()`) deve ocorrer tanto em retorno fresh quanto cached. Aplicar antes de exibir ao usuário.**

### Justificativa
- Emojis e markdown quebram UI (especialmente em componentes React)
- Análises em cache também precisam ser sanitizadas
- Sanitização única garante consistência
- ML Safe Mode: output limpo, sem emojis/markdown decorativo

### Implementação
- **Função `sanitizeExpertAnalysis()`:** Remove emojis, normaliza markdown, limpa caracteres especiais
- **Aplicado em:** Retorno fresh (após geração) e retorno cached (ao recuperar do cache)
- **ML Safe Mode:** Prompt instrui IA a não usar emojis/markdown
- **Validação:** Gate de qualidade verifica output sanitizado

### Impacto
- **UX:** UI não quebra com caracteres especiais
- **Consistência:** Análises sempre sanitizadas, independente de origem
- **Qualidade:** Output limpo e profissional

### Alternativas consideradas
- Sanitização apenas no frontend: Problemas aparecem depois de gerar
- Sem sanitização: UI quebra com emojis/markdown
- Sanitização apenas em fresh: Cache pode conter conteúdo não sanitizado

---

## ADR-016: Benchmark Nunca Retorna Null

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
BenchmarkService retornava `null` quando falhava, causando erro na UI que esperava objeto. Benchmark não renderizava em produção.

### Decisão
**BenchmarkService sempre retorna objeto, mesmo em caso de erro. Objeto inclui `benchmarkSummary.confidence = "unavailable"` quando dados indisponíveis.**

### Justificativa
- UI espera objeto, não null
- Melhor UX: mostrar "Comparação indisponível" do que erro
- Consistência: sempre retornar mesmo formato
- Observabilidade: logs estruturados mesmo em erro

### Implementação
- **BenchmarkService.calculateBenchmark():** Sempre retorna `BenchmarkResult`, nunca `null`
- **Em caso de erro:** Retorna objeto com `confidence: "unavailable"`, `youWinHere: []`, `youLoseHere: []`, `recommendations: []`
- **Logs estruturados:** Incluir `requestId`, `tenantId`, `listingId`, `categoryId`, `connectionId`, `marketplaceAccountId`, `stage`, `errorCode`, `errorMessage`
- **Header x-debug opcional:** Se `x-debug: 1`, incluir `benchmarkDebug` no payload com `{ stage, error }`

### Impacto
- **UX:** UI sempre renderiza benchmark (mesmo que "indisponível")
- **Observabilidade:** Logs estruturados facilitam debug
- **Consistência:** Sempre retornar mesmo formato

### Alternativas consideradas
- Retornar null: Quebra UI
- Retornar erro HTTP: Não é erro crítico, análise deve continuar
- Retornar objeto vazio: Melhor UX que null

---

## ADR-017: Regenerate Faz Refresh de Listing

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
Quando `forceRefresh=true`, análise usava dados stale (preço/promo antigos). Listing não era atualizado antes de analisar.

### Decisão
**Quando `forceRefresh=true`, atualizar listing via `fetchItemsDetails` antes de analisar. Garantir preço/promo atualizados.**

### Justificativa
- Análise deve usar dados mais recentes quando usuário solicita refresh
- Preço/promo stale gera insights incorretos
- Consistência: dados sempre atualizados quando solicitado

### Implementação
- **No endpoint `/api/v1/ai/analyze/:listingId`:** Se `forceRefresh=true` e `listing.marketplace === 'mercadolivre'`, chamar `syncService.fetchItemsDetails()` e `upsertListings()` antes de analisar
- **Atualizar objeto listing local:** Após refresh, buscar listing atualizado do DB e atualizar objeto local
- **Logs estruturados:** Incluir `requestId`, `listingId`, `price`, `price_final`, `original_price`, `has_promotion`, `discount_percent`

### Impacto
- **Qualidade:** Análise sempre usa dados atualizados quando solicitado
- **UX:** Usuário vê resultados baseados em dados frescos
- **Performance:** Refresh adiciona latência, mas necessário para qualidade

### Alternativas consideradas
- Não fazer refresh: Dados stale
- Refresh apenas no frontend: Não garante consistência
- Refresh sempre: Performance impactada desnecessariamente

---

## ADR-018: Prompt Version como Fonte Única

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
Sistema tinha múltiplas definições de `AI_PROMPT_VERSION` em diferentes arquivos (`OpenAIService.ts`, `ai-fingerprint.ts`), causando divergências e inconsistências.

### Decisão
**Centralizar `promptVersion` em fonte única: `apps/api/src/utils/prompt-version.ts`. Todos os módulos devem importar de lá.**

### Justificativa
- Evita divergências entre módulos
- Facilita mudança de versão (um único lugar)
- Consistência garantida em todo o sistema
- Facilita observabilidade (versão exposta em `/api/v1/meta`)

### Implementação
- **Criar `apps/api/src/utils/prompt-version.ts`:** Função `getPromptVersion()` retorna `process.env.AI_PROMPT_VERSION || 'ml-expert-v22'`
- **Atualizar todos os módulos:** `OpenAIService`, `ai-fingerprint`, `meta.routes`, `ai-analyze.routes` importam de fonte única
- **Expor em response:** `promptVersion` e `schemaVersion` incluídos no response de análise
- **Header x-api-commit:** Adicionado para identificar commit em produção

### Impacto
- **Consistência:** Versão sempre sincronizada
- **Observabilidade:** Versão exposta facilita debug
- **Manutenibilidade:** Mudança de versão em um único lugar

### Alternativas consideradas
- Manter múltiplas definições: Risco de divergência
- Usar apenas env var: Sem fallback padrão

---

## ADR-019: Deploy App Runner Resiliente a Estados Transitórios

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
Deploy App Runner falhava intermitentemente com erro "Can't start a deployment ... because it isn't in RUNNING state" quando serviço estava em estado transitório (`OPERATION_IN_PROGRESS`).

### Decisão
**Aguardar estado `RUNNING` antes de iniciar deployment. Polling com retry e timeout explícito.**

### Justificativa
- App Runner pode estar em estado transitório após deploy anterior
- Tentar iniciar deployment em estado não-RUNNING causa falha
- Pipeline deve ser resiliente a condições transitórias
- Melhor UX: pipeline não falha por condições temporárias

### Implementação
- **Pre-check antes de `start-deployment`:** Poll `aws apprunner describe-service` até `Status == RUNNING`
- **Retry com backoff:** Intervalo de 15s, máximo 20 retries (5 minutos)
- **Tratamento de erros:** Se AWS CLI falhar, retry com fallback
- **Timeout explícito:** Se não chegar a RUNNING após timeout, falhar com mensagem clara
- **Aplicado em:** `deploy-api.yml` e `deploy-web.yml`

### Impacto
- **Resiliência:** Pipeline não falha por estados transitórios
- **Confiabilidade:** Deploy mais confiável em cenários de deploys seguidos
- **Observabilidade:** Logs mostram status e retry count

### Alternativas consideradas
- Não aguardar: Falha frequente em estados transitórios
- Aguardar fixo: Timeout desnecessário quando já está RUNNING
- Retry sem timeout: Pode travar indefinidamente

---

## Registro de Decisões Futuras

### Pendentes de ADR formal
- Reconciliação completa de status (job dedicado)
- Orders x seller_id ao trocar conexão
- Limpeza de dados históricos (soft delete / reprocess)
- Inserção manual de anúncio (MLB…)
- Diferenciação clara de status (`paused`, `blocked_by_policy`, `unauthorized`) na UX
- UX do modal de análise (layout e hierarquia)
- Benchmark por categoria (agregação interna vs endpoints públicos)

---

## ADR-020: Promo Pricing via ML /prices com TTL e Feature Flag

**Data:** 2026-02-09  
**Status:** Implementado

### Contexto
Promoções não eram capturadas corretamente via `/items?ids=...` (multiget). Mercado Livre recomenda usar `/items/{id}/prices` para dados de preços/promoções. Sistema precisava ser escalável para milhares de anúncios sem allowlist hardcoded, e rate-limit friendly para evitar abuso da API do ML.

### Decisão
**Usar `/items/{id}/prices` (Prices API) como fonte de verdade para promoções, com TTL (Time To Live) baseado em `promotion_checked_at` e feature flag `USE_ML_PRICES_FOR_PROMO` via Secrets Manager. Override manual via query param `forcePromoPrices=true` para debug quando necessário.**

### Justificativa
- Prices API é endpoint recomendado pelo ML para preços/promoções
- Retorna dados estruturados de `sale_price`, `prices`, `reference_prices`, `promotions`, `deals`
- TTL garante rate-limit safety sem abuso da API do ML
- Feature flag permite ativar/desativar sem deploy
- Override manual permite debug/manual force quando necessário
- Escalável para milhares de anúncios (sem allowlist hardcoded)
- Multi-tenant ready (funciona para qualquer tenant/anúncio)

### Implementação
- **TTL baseado em `promotion_checked_at`:**
  - `/prices` só é chamado quando `promotion_checked_at` é `null` (nunca verificado) OU `now - promotion_checked_at > TTL` (expirado)
  - TTL padrão: 12h (`PROMO_PRICES_TTL_HOURS` configurável via env var)
  - `promotion_checked_at` é atualizado apenas quando `/prices` é efetivamente chamado
- **Feature flag via Secrets Manager:**
  - `USE_ML_PRICES_FOR_PROMO` injetado no App Runner via Terraform
  - Parser robusto (`getBooleanEnv()`) suporta plaintext (`"true"`) e JSON (`{"USE_ML_PRICES_FOR_PROMO":"true"}`)
  - Permite ativar/desativar sem deploy
- **Override manual:**
  - Endpoint `force-refresh` aceita query param `forcePromoPrices=true` para ignorar TTL
  - Força busca de `/prices` mesmo com `promotion_checked_at` recente
  - Útil para debug/manual force quando necessário
- **Observabilidade:**
  - Response do `force-refresh` inclui `config` e `enrichment` com detalhes completos
  - `enrichment.reason` indica por que pulou (`ttl_not_expired`, `flag_off`, etc)
  - Logs estruturados para diagnóstico

### Consequências positivas
- **Confiabilidade:** Promoções capturadas corretamente via source of truth
- **Escala:** Sistema escalável para milhares de anúncios sem allowlist
- **Rate-limit safety:** TTL garante que sistema não abuse da API do ML
- **Auditabilidade:** Observabilidade completa permite debug sem logs
- **Flexibilidade:** Feature flag permite ativar/desativar sem deploy
- **Multi-tenant ready:** Funciona para qualquer tenant/anúncio

### Trade-offs
- **Latência:** Chamada adicional a `/prices` adiciona latência (mitigado por TTL)
- **Rate-limit:** TTL pode atrasar atualização de promoções (aceitável para rate-limit safety)
- **Complexidade:** Parser robusto para env vars adiciona complexidade (necessário para robustez)

### Relação com multi-tenant SaaS
- Sistema não usa allowlist hardcoded (escala para qualquer tenant/anúncio)
- TTL garante rate-limit safety mesmo com múltiplos tenants
- Feature flag permite controle global sem deploy
- Override manual permite debug específico quando necessário

### Alternativas consideradas
- Heurística de desconto: Menos confiável, pode gerar dados incorretos
- Sem TTL: Abuso de rate-limit, custos desnecessários
- Allowlist hardcoded: Não escala, não é multi-tenant ready
- Sem feature flag: Requer deploy para ativar/desativar
- Sem override: Dificulta debug em produção

---

## ADR-005: Conversion como Fração (0..1)

**Data:** 2026-02-11  
**Status:** Implementado (HOTFIX P0)

### Contexto
Erro `PostgresError code 22003 numeric field overflow` ocorria quando `conversion` era calculado como percentual (0..100) e armazenado em coluna `numeric(5,4)` (máximo 9.9999). Valores acima de 9.9999% causavam overflow.

### Decisão
**Armazenar `conversion` como FRAÇÃO (0..1) no banco de dados. Percentual apenas na camada de exibição (UI/API response).**

### Justificativa
- `numeric(5,4)` aceita valores de 0.0000 até 1.0000 (compatível com fração)
- Fração é matematicamente mais consistente (orders/visits)
- Evita overflow mesmo com conversões altas (>10%)
- Percentual pode ser calculado na camada de apresentação quando necessário

### Implementação
- **Cálculo:** `conversion = visits > 0 ? Number((orders / visits).toFixed(4)) : null`
- **Armazenamento:** `listing_metrics_daily.conversion` como `numeric(5,4)`
- **Logs:** Incluem `conversionBefore`, `conversionAfter`, `visits`, `orders`
- **Aplicado em:** `MercadoLivreSyncService.syncOrdersMetricsDaily()` e `syncListingMetricsDaily()`

### Impacto
- **Confiabilidade:** Elimina erro de overflow 22003
- **Consistência:** Dados sempre válidos no banco
- **Observabilidade:** Logs estruturados facilitam debug

### Alternativas consideradas
- Alterar schema para `numeric(6,4)`: Requer migration, não resolve raiz do problema
- Multiplicar por 100 na UI: Mantém inconsistência matemática
- Usar percentual com clamp: Complexidade desnecessária

---

## ADR-006: Separação de Visits e OrdersMetrics

**Data:** 2026-02-11  
**Status:** Implementado

### Contexto
Orders/gmv estavam sendo atualizados dentro do bloco de métricas, causando acoplamento e dificultando manutenção. Dashboard precisava de dados confiáveis e independentes.

### Decisão
**Criar step independente `syncOrdersMetricsDaily()` separado de `syncVisitsByRange()`. Preservar visits quando atualizar orders/gmv.**

### Justificativa
- Separação de responsabilidades facilita manutenção
- Dashboard precisa de dados confiáveis e independentes
- Menor acoplamento entre sync de visits e orders
- Permite execução independente de cada step

### Implementação
- **Step separado:** `syncOrdersMetricsDaily()` em `MercadoLivreSyncService`
- **Preservação:** Upsert preserva `visits`, `impressions`, `clicks`, `ctr` quando atualiza `orders`, `gmv`, `conversion`
- **Logs estruturados:** Incluem `conversionBefore`, `conversionAfter`, `visits`, `orders`
- **Idempotência:** Pode ser executado múltiplas vezes sem efeitos colaterais

### Impacto
- **Confiabilidade:** Dashboard sempre mostra dados corretos
- **Manutenibilidade:** Código mais modular e fácil de entender
- **Escalabilidade:** Steps podem ser executados independentemente

### Alternativas consideradas
- Manter acoplado: Maior complexidade, difícil manutenção
- Sempre sobrescrever: Perde dados de visits quando atualiza orders

---

## ADR-007: Anti-regressão de Promo

**Data:** 2026-02-11  
**Status:** Implementado

### Contexto
Endpoint `/ai/analyze` estava regravando promo incorretamente, causando regressão de dados. Enrichment podia falhar mas ainda assim sobrescrever valores corretos.

### Decisão
**Preservar valores de promo (`original_price`, `price_final`, `has_promotion`, `discount_percent`) caso enrichment não aplique. Usar `forcePromoPrices` conforme flag.**

### Justificativa
- Promo nunca deve regredir
- Enrichment pode falhar (403, rate-limit) mas dados existentes são válidos
- Flag `forcePromoPrices` permite override manual quando necessário
- TTL garante que dados não ficam stale indefinidamente

### Implementação
- **Preservação:** Se enrichment não aplicar (TTL não expirado, flag off, erro), manter valores existentes
- **Flag:** `forcePromoPrices=true` ignora TTL e força refresh
- **Logs:** `enrichment.applied`, `enrichment.reason` indicam por que enrichment foi aplicado ou pulado
- **Aplicado em:** `MercadoLivreSyncService.enrichItemPricing()`

### Impacto
- **Confiabilidade:** Promo nunca regride
- **Observabilidade:** Logs mostram por que enrichment foi aplicado ou pulado
- **Flexibilidade:** Flag permite override manual quando necessário

### Alternativas consideradas
- Sempre sobrescrever: Causa regressão de dados
- Nunca atualizar: Dados ficam stale

---

## ADR-021: AppliedActions — Badges Locais vs Refetch e Regra de Reset no ForceRefresh

**Data:** 2026-02-12  
**Status:** Implementado

### Contexto
Após aplicar uma ação (apply-action retorna 200 OK), o badge "Implementado" não aparecia porque o frontend estava fazendo `forceRefresh=true` automaticamente, o que resetava os badges. Além disso, ao regerar análise, badges de ações aplicadas anteriormente permaneciam visíveis quando deveriam resetar.

### Decisão
**Badges atualizam localmente após apply-action (sem refetch). Reset apenas via regenerate explícito (forceRefresh=true). Backend filtra appliedActions por `applied_at >= analysis.created_at` para análise atual.**

### Justificativa
- Evitar roundtrip custoso após aplicar ação (melhor UX: badge aparece instantaneamente)
- Evitar apagamento por re-análise automática (badge deve persistir até regerar explicitamente)
- Manter consistência: badges resetam apenas quando usuário solicita nova análise
- Backend filtra por análise atual para garantir que badges refletem apenas ações aplicadas após a análise atual

### Implementação
- **Frontend:**
  - Estado local `localAppliedActions` atualizado imediatamente após apply-action
  - `isActionApplied()` usa estado local ao invés de prop
  - Sincronização com prop quando muda (ex: após regerar análise)
  - NÃO chama `onRegenerate()` após aplicar ação
- **Backend:**
  - `AppliedActionService.getAppliedActions()` aceita `analysisCreatedAt` opcional
  - Filtra por `applied_at >= analysis.created_at` quando fornecido
  - Busca `analysis.created_at` do registro atual (nova ou cache) antes de filtrar
  - Aplicado em análise nova e cache response
- **Instrumentação:**
  - Logs estruturados com `analysisCreatedAt`, `countAppliedActionsTotal`, `countAfterFilter`, `min/max appliedAt`
  - Logs apenas em dev ou com header `x-debug: 1`

### Consequências
- **UX:** Badge aparece instantaneamente após aplicar (sem refetch)
- **Consistência:** Badges resetam apenas ao clicar "Regerar análise"
- **Performance:** Evita roundtrip desnecessário após aplicar ação
- **Observabilidade:** Logs permitem validar filtro e debug de problemas

### Alternativas consideradas
- Refetch após aplicar: Roundtrip custoso, pode resetar badges se forceRefresh automático
- Sem filtro por análise: Badges de análises anteriores aparecem incorretamente
- Reset manual de badges: Complexidade desnecessária, melhor resetar ao regerar

---

---

## ADR-022: Unique Partial Index em sync_jobs(lock_key) para Status Queued/Running

**Data:** 2026-02-18  
**Status:** Implementado

### Contexto
Sistema de jobs multi-tenant precisa evitar duplicação de jobs `TENANT_SYNC` mesmo com múltiplas réplicas e race conditions. Dedupe apenas em lógica de aplicação não é suficiente para garantir atomicidade.

### Decisão
**Criar índice único parcial `UNIQUE(lock_key) WHERE status IN ('queued','running')` na tabela `sync_jobs` para garantir dedupe atômico no nível do banco de dados.**

### Justificativa
- Dedupe apenas em lógica de aplicação não garante atomicidade com múltiplas réplicas
- Índice único parcial garante que não pode existir 2 jobs com mesmo `lock_key` em status `queued` ou `running` simultaneamente
- PostgreSQL garante atomicidade no nível do banco (não depende de locks de aplicação)
- Funciona mesmo com race conditions e múltiplas réplicas do JobRunner

### Implementação
- **Migration:** `20260214000000_fix_sync_jobs_timezone_and_dedupe`
- **Índice:** `CREATE UNIQUE INDEX sync_jobs_lock_key_unique ON sync_jobs(lock_key) WHERE status IN ('queued','running')`
- **Lock key format:** `tenant:${tenantId}:TENANT_SYNC` ou `listing:${listingId}:LISTING_SYNC`
- **Aplicado em:** PROD (2026-02-18 21:00:25 UTC)

### Consequências
- **Atomicidade:** Dedupe garantido no nível do banco, não apenas aplicação
- **Escalabilidade:** Funciona com múltiplas réplicas sem coordenação externa
- **Robustez:** Race conditions não causam duplicação
- **Performance:** Índice parcial é mais eficiente que índice completo

### Alternativas consideradas
- Dedupe apenas em lógica de aplicação: Não garante atomicidade com múltiplas réplicas
- Índice único completo: Menos eficiente, não permite múltiplos jobs com mesmo lock_key em status diferentes
- Locks de aplicação (Redis/Distributed Lock): Adiciona dependência externa, complexidade operacional

---

## ADR-023: Single Source of Truth para DATABASE_URL Secret em PROD

**Data:** 2026-02-18  
**Status:** Pendente (housekeeping)

### Contexto
Durante aplicação de migration em PROD, descobriu-se que secret `prod/DB_URL` no Secrets Manager estava com placeholder literal `<DB_ENDPOINT>`. Devin usou `prod/DB_SSELLERIA` com string correta para aplicar migration.

### Decisão
**Padronizar secret `prod/DB_URL` como single source of truth para DATABASE_URL em PROD. Atualizar para endpoint real e remover placeholders.**

### Justificativa
- Placeholders causam confusão e erros operacionais
- Single source of truth facilita manutenção e debug
- Endpoint real deve estar em secret oficial (`prod/DB_URL`)
- Evita necessidade de usar secrets alternativos

### Implementação
- **Ação corretiva:** Atualizar `prod/DB_URL` no Secrets Manager para endpoint real: `superseller-prod-db.ctei6kco4072.us-east-2.rds.amazonaws.com`
- **Validação:** Testar conexão após atualização
- **Documentação:** Registrar endpoint em documentação operacional

### Consequências
- **Clareza:** Secret oficial contém valor correto
- **Manutenibilidade:** Single source of truth facilita atualizações futuras
- **Operacional:** Evita necessidade de usar secrets alternativos

### Alternativas consideradas
- Manter placeholder: Causa confusão e erros operacionais
- Usar sempre secret alternativo: Não é padrão, dificulta manutenção

---

---

## ADR-024: HackEngine v1 — Sistema Determinístico de Hacks Contextualizados

**Data:** 2026-02-19  
**Status:** Implementado

### Contexto
O sistema precisava gerar hacks específicos e acionáveis baseados em dados reais do anúncio, não genéricos. Hacks devem ser determinísticos, auditáveis e respeitar histórico do usuário.

### Decisão
**Implementar HackEngine v1 com 5 hacks específicos do Mercado Livre, confidence scoring determinístico (0-100), e persistência de feedback do usuário.**

### Justificativa
- Hacks genéricos não agregam valor real ao usuário
- Sistema determinístico garante consistência e auditabilidade
- Confidence scoring permite priorização clara
- Feedback do usuário evita sugerir hacks já aplicados ou descartados
- Preparado para futura automação (estrutura permite integração com APIs do ML)

### Implementação
- **SignalsBuilder:** Extrai signals determinísticos de listing, pricing, shipping, metrics, benchmark
- **HackEngine v1:** 5 hacks implementados:
  - `ml_full_shipping`: Ativar frete grátis Full
  - `ml_bundle_kit`: Criar kit/combo
  - `ml_smart_variations`: Adicionar variações
  - `ml_category_adjustment`: Ajustar categoria
  - `ml_psychological_pricing`: Ajustar preço psicológico
- **Confidence scoring:** Bandas fixas (0-39 low, 40-69 medium, 70-100 high)
- **Histórico:** Confirmed nunca sugere; dismissed tem cooldown de 30 dias
- **Persistência:** Model `listing_hacks` com status `confirmed`/`dismissed`
- **UI:** Componente `HacksPanel` com botões de feedback e badges de impact/confidence

### Consequências
- **Valor:** Hacks específicos e acionáveis aumentam taxa de conversão
- **Consistência:** Sistema determinístico garante resultados previsíveis
- **UX:** Feedback do usuário evita sugestões repetitivas
- **Observabilidade:** Meta inclui `rulesEvaluated`, `rulesTriggered`, `skippedBecauseOfHistory`, `skippedBecauseOfRequirements`

### Alternativas consideradas
- Hacks genéricos via LLM: Menos específicos, não auditáveis
- Sem histórico: Sugestões repetitivas prejudicam UX
- Confidence fixa: Não permite priorização baseada em dados

---

⚠️ **Nota:** Esses itens NÃO são falhas. São decisões conscientes e maduras de produto e arquitetura, registradas para evolução futura.
