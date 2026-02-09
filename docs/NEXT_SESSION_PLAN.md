# NEXT SESSION PLAN — Dia 5 (Após Fix Pack Dia 04)

## 🗓️ Próxima Sessão — Dia 05

### Objetivo principal
**Continuar com benchmark e comparação com concorrentes (se necessário) ou avançar para próxima feature prioritária.**

### Status do Dia 04
- ✅ Benchmark nunca retorna null (sempre objeto com confidence="unavailable" se falhar)
- ✅ Logs estruturados quando benchmark falhar
- ✅ Refresh de listing quando forceRefresh=true
- ✅ Cache funcionando corretamente
- ✅ Suporte opcional para header x-debug: 1

### Próximos passos (se necessário)
- [ ] Validar benchmark em produção (verificar se UI renderiza corretamente)
- [ ] Validar refresh de listing (verificar se preço/promo estão atualizados)
- [ ] Validar cache (verificar se cacheHit funciona corretamente)
- [ ] Continuar com benchmark e comparação com concorrentes (se necessário)

---

# NEXT SESSION PLAN — Dia 4 (Benchmark & Comparação com Concorrentes) — HISTÓRICO

## 🗓️ Próxima Sessão — Dia 04

### Objetivo principal
**Implementar benchmark mínimo viável: sensação de "meu anúncio está atrás" sem inventar números. Comparação com concorrentes e baseline por categoria.**

### Entregáveis do Dia 04 (MVP Benchmark)

#### 1. Baseline por categoria
- [ ] Agregar métricas médias por `category_id` (visits, orders, conversionRate, ctr, revenue)
- [ ] Fonte de dados: agregação interna de `listing_metrics_daily` OU endpoints públicos do ML (se disponíveis)
- [ ] Armazenar baseline em tabela dedicada ou calcular on-the-fly com cache

#### 2. Comparação "você perde/ganha"
- [ ] Comparar listing atual vs baseline da categoria
- [ ] Calcular gaps: `visits_gap`, `conversion_gap`, `ctr_gap`, `revenue_gap`
- [ ] Identificar métricas onde listing está abaixo da média da categoria

#### 3. Expected vs Actual
- [ ] Calcular "expected" usando média da categoria
- [ ] Comparar "actual" (dados reais do listing) vs "expected"
- [ ] Mostrar percentual de diferença (ex: "você está 30% abaixo da média em conversão")

#### 4. Thresholds derivados do benchmark
- [ ] Usar baseline para calibrar thresholds do ScoreActionEngine
- [ ] Ajustar priorização de ações baseado em gaps identificados
- [ ] Integrar com regra de "promo agressiva + baixa conversão" existente

#### 5. UI/resultado mostrando comparação
- [ ] Componente visual comparando listing vs categoria
- [ ] Gráficos/indicadores mostrando gaps
- [ ] Ações concretas baseadas em gaps identificados
- [ ] Mensagens claras: "você está X% abaixo da média em Y"

### Dependências

#### Acesso a dados
- **Opção 1:** Agregação interna por `category_id` de `listing_metrics_daily`
  - Prós: dados reais do sistema, sem dependência externa
  - Contras: precisa de volume mínimo de listings por categoria
- **Opção 2:** Endpoints públicos do ML (se disponíveis)
  - Prós: dados mais representativos
  - Contras: pode não estar disponível, rate limits

#### Normalização por categoria
- [ ] Mapear `category_id` do ML para categorias normalizadas
- [ ] Agrupar categorias similares se volume for baixo
- [ ] Tratar edge cases (categorias sem dados suficientes)

### Critério de Dia 04 entregue (DoD)
- [ ] Baseline por categoria calculado e armazenado
- [ ] Comparação "você perde/ganha" funcionando
- [ ] Expected vs Actual calculado e exibido
- [ ] Thresholds derivados do benchmark integrados ao engine
- [ ] UI/resultado mostrando comparação e ações concretas baseadas em gaps
- [ ] Testes unitários cobrindo cálculo de baseline e comparação
- [ ] Validação manual em listing MLB4217107417

---

## 📌 Backlog gerado (Dia 04)

### Dados / Engenharia
- **Benchmark endpoints:** Agregação interna por `category_id` OU endpoints públicos do ML (se disponíveis)
- **Normalização por categoria:** Mapear `category_id` do ML para categorias normalizadas; agrupar categorias similares se volume baixo
- **Cache de baseline:** Armazenar baseline calculado ou calcular on-the-fly com cache
- **Edge cases:** Tratar categorias sem dados suficientes (fallback para categoria pai ou média geral)

### UI / UX
- **Componente de comparação:** Visual comparando listing vs categoria (gráficos/indicadores)
- **Mensagens claras:** "você está X% abaixo da média em Y"
- **Ações baseadas em gaps:** Integrar gaps identificados com ScoreActionEngine para priorização

### Testes
- **Testes unitários:** Cálculo de baseline, comparação listing vs categoria, expected vs actual
- **Validação manual:** Listing MLB4217107417 com benchmark da categoria

---

## ⚠️ Status atual (Dia 3 — Concluído com sucesso, Dia 4 iniciado)
- **Análise IA Expert (ml-expert-v1):** Backend e frontend integrados
- **V1 descontinuada:** UI V1 removida completamente
- **Cache funcional:** Regeneração automática quando `analysisV21` ausente
- **UX de cache:** Banner e botão "Regerar análise" implementados
- **Normalização implementada:** Frontend recebe dados em camelCase
- **Build passando:** TypeScript errors corrigidos
- **Análises diferem por anúncio:** Bug crítico de listing incorreto resolvido
- **🔴 BLOQUEADORES DO DIA 2:**
  - Descrição rasa (não atende proposta de valor)
  - Promoção chutada (afirma ausência sem dados)
  - Vídeo com lógica incorreta (sugere mesmo com `null`)
  - EditUrl ausente (abre página pública, não edição)

## 🎯 Objetivo da próxima sessão
**Validar ambiente de produção e comparar output da IA com análise humana.**

## 🔧 Tarefas prioritárias (ORDEM OBRIGATÓRIA)

### PRIORIDADE 1: Validar qual serviço está rodando atrás de api.superselleria.com.br
**Status:** 🔴 BLOQUEADOR DE VALIDAÇÃO

**Problema:**
- Endpoints novos retornam 404 em produção
- `/api/v1/meta` não responde
- Suspeita de problema de deploy/gateway/envoy/cache

**Ações:**
1. **Verificar logs de inicialização da API em produção:**
   - Confirmar que rotas foram registradas
   - Verificar se `metaRoutes`, `aiDebugRoutes` foram carregados
   - Checar logs de "Routes registered"

2. **Usar endpoints existentes para diagnóstico:**
   - `GET /api/v1/sync/status` (deve funcionar)
   - Comparar com `GET /api/v1/meta` (deve funcionar mas retorna 404)
   - Identificar mismatch

3. **Validar build e deploy:**
   - Confirmar que build incluiu `meta.routes.ts` e `ai-debug.routes.ts`
   - Verificar se arquivos estão no container/imagem
   - Checar se gateway/envoy está roteando corretamente

### PRIORIDADE 2: Validar promo e debug-payload com ambiente correto
**Status:** 🔴 BLOQUEADOR

**Problema:**
- IA entregando descrições rasas (ex: "Meias 3D Infantis Crazy Socks - Perfeitas para crianças…")
- Não atende proposta de valor do SuperSeller IA

**Expectativa correta:**
- Descrição estruturada
- SEO forte
- Blocos claros (benefícios, tamanhos, confiança, CTA)
- Copy pronta para colar

**Ações:**
1. **Ajustar prompt do Expert:**
   - Adicionar regra de densidade mínima obrigatória
   - Definir estrutura obrigatória (benefícios, tamanhos, confiança, CTA)
   - Reforçar SEO forte
   - Exemplos de descrições profundas no prompt

2. **Validar output:**
   - Testar com múltiplos anúncios
   - Confirmar que descrições são estruturadas e profundas
   - Verificar que copy está pronta para colar

### PRIORIDADE 3: Comparar output da IA com análise humana (MLB4217107417)
**Status:** 🔴 BLOQUEADOR

**Problema:**
- IA afirma "não há promoção" mesmo quando existe
- Backend não envia `has_promotion`, `promotion_price`, `original_price`
- IA está chutando

**Ações:**
1. **Backend:**
   - Garantir que `has_promotion`, `promotion_price`, `original_price` são enviados no input da IA
   - Validar que dados de promoção são corretos (verificar `deals`, `sale_price`, `base_price`)

2. **Prompt:**
   - Adicionar regra: "Se `has_promotion` não for fornecido ou for `null`, diga 'não foi possível confirmar se há promoção'"
   - Não pode afirmar ausência sem certeza
   - Se `has_promotion = true`, usar `promotion_price` e `original_price` na análise

3. **Validar output:**
   - Testar com anúncio com promoção
   - Testar com anúncio sem promoção
   - Confirmar que IA não chuta ausência

### PRIORIDADE 4: (Reservado para próximas tarefas conforme necessário)
**Status:** 🔴 BLOQUEADOR

**Problema:**
- Mesmo com `hasClipDetected = null`, IA sugere "Adicionar vídeo"
- Lógica incorreta

**Ações:**
1. **Prompt:**
   - Adicionar regra explícita:
     - `hasClipDetected = true` → não sugerir adicionar vídeo
     - `hasClipDetected = false` → sugerir adicionar vídeo
     - `hasClipDetected = null` → sugestão condicional ("se não houver vídeo, considere adicionar…")

2. **Validar output:**
   - Testar com `hasClipDetected = true`
   - Testar com `hasClipDetected = false`
   - Testar com `hasClipDetected = null`
   - Confirmar que lógica está correta

### PRIORIDADE 5: (Reservado para próximas tarefas conforme necessário)
**Status:** 🟡 MELHORIA

**Problema:**
- Botão "Abrir no Mercado Livre" abre página pública
- Antes funcionava no modo edição

**Link correto de edição:**
```
https://www.mercadolivre.com.br/anuncios/{ITEM_ID}/modificar/bomni?callback_url=...
```

**Ações:**
1. **Backend:**
   - Adicionar `editUrl` no response do `POST /api/v1/ai/analyze/:listingId`
   - Construir URL de edição: `https://www.mercadolivre.com.br/anuncios/{listingIdExt}/modificar/bomni?callback_url=...`

2. **Frontend:**
   - Priorizar `editUrl` sobre `publicUrl` no botão "Abrir no Mercado Livre"
   - Se `editUrl` não existir, usar `publicUrl` como fallback

3. **Validar:**
   - Testar que botão abre página de edição
   - Confirmar que URL está correta

### PRIORIDADE 6: Validar output vs expectativa de especialista
**Status:** ✅ VALIDAÇÃO FINAL

**Ações:**
1. **Testar com múltiplos anúncios:**
   - Anúncio com promoção
   - Anúncio sem promoção
   - Anúncio com vídeo
   - Anúncio sem vídeo
   - Anúncio com dados completos
   - Anúncio com dados incompletos

2. **Validar cada campo:**
   - ✅ Descrição estruturada e profunda
   - ✅ Promoção determinística (não chuta)
   - ✅ Vídeo com lógica correta
   - ✅ Links de edição funcionando
   - ✅ Título sugerido relevante
   - ✅ Ações ordenadas por prioridade
   - ✅ Hacks algorítmicos acionáveis

3. **Confirmar que output está "pronto para aplicar":**
   - Copy pode ser colada diretamente
   - Ações são claras e acionáveis
   - Não há sugestões vagas ou genéricas

## 🧪 Validações obrigatórias

### Funcionalidade
- [x] Modal abre e mostra conteúdo Expert (sem abas)
- [x] Clicar para gerar análise funciona e, ao concluir, painel Expert renderiza
- [x] Não ocorre "Application error" ao interagir com o modal
- [x] Painel Expert não quebra mesmo quando ações/imagens/promo vierem ausentes
- [x] Cache é respeitado (não gera nova análise sem necessidade)
- [x] Botão "Regerar análise" força nova análise corretamente
- [ ] **Descrição é estruturada e profunda (não rasa)**
- [ ] **Promoção não é chutada (usa dados explícitos ou diz "não foi possível confirmar")**
- [ ] **Vídeo tem lógica correta (true → não sugerir, false → sugerir, null → condicional)**
- [ ] **Links de edição funcionam (abrem página de edição, não pública)**

### Dados
- [x] Todos os campos do `analysisV21` são renderizados quando presentes
- [x] Ações ordenadas por prioridade (critical > high > medium > low)
- [x] Título e descrição sugeridos podem ser copiados
- [ ] **Descrição tem densidade mínima obrigatória**
- [ ] **Promoção usa dados explícitos do backend**
- [ ] **Vídeo usa lógica condicional correta**

### UX
- [x] Copy do modal é clara e orientada ao usuário final
- [x] Banner de cache é discreto e informativo
- [x] Estados vazios são amigáveis
- [x] Mensagens de erro são claras
- [ ] **Descrição está pronta para colar (copy completa)**
- [ ] **Links de edição funcionam corretamente**

## 🚀 Critério de conclusão do Dia 2

### Obrigatório (BLOQUEADORES)
- [x] Modal 100% funcional
- [x] Nenhum placeholder estranho
- [x] UX clara (sem termos técnicos)
- [x] Cache ativo e visível para o usuário
- [x] Build passando sem erros TypeScript
- [x] CI/CD verde
- [ ] **Descrição estruturada e profunda (não rasa)**
- [ ] **Promoção determinística (não chuta)**
- [ ] **Vídeo com lógica correta**
- [ ] **Links de edição funcionando**

### Desejável (MELHORIAS)
- [ ] UX do modal com hierarquia melhor (diagnóstico compacto, ações claras, detalhes colapsáveis)
- [ ] Testes automatizados para componente Expert
- [ ] Documentação de uso do cache

## 🧯 Notas importantes
- **Não reativar V1:** V1 foi descontinuada; focar apenas em Expert
- **Cache é crítico:** Respeitar cache evita custos desnecessários com OpenAI
- **UX primeiro:** Copy e mensagens devem ser orientadas ao usuário final, não técnico
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos
- **Descrição é feature central:** Descrição curta = BUG de produto
- **Prompt especialista é o padrão:** Todo output deve ser "pronto para aplicar"

## 🟢 Após encerrar Dia 2 (próxima fase)
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

## 📌 Backlog / Débitos Técnicos (registrado)
### Produto / UX
- Multi-conexões por marketplace
- Filtro por conta no dashboard
- Dashboard consolidado vs por conta
- Identidade visual da conta conectada
- Diferenciação clara de status:
  - `paused`
  - `blocked_by_policy`
  - `unauthorized`
- Inserção manual de anúncio (MLB…)
- **UX do modal de análise (layout e hierarquia)** — Melhoria registrada

### Dados / Engenharia
- **Promoção: enviar `has_promotion`, `promotion_price`, `original_price`** — BLOQUEADOR DO DIA 2
- **Vídeo: lógica correta para `true | false | null`** — BLOQUEADOR DO DIA 2
- Reconciliação completa de status (job dedicado)
- Backfill automático (cron / scheduler)
- Orders x seller_id ao trocar conexão
- Limpeza de dados históricos (soft delete / reprocess)

⚠️ **Registrado explicitamente:** Esses itens NÃO são falhas. São decisões conscientes e maduras de produto e arquitetura, registradas para evolução futura.
