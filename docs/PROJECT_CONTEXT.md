# PROJECT CONTEXT — SuperSeller IA
Atualizado em: 2026-01-27 (Fim do Dia 2)

## 🧠 Visão do Produto
SuperSeller IA é uma plataforma de inteligência aplicada para sellers de marketplace.
O foco não é "IA bonita", mas decisões confiáveis, acionáveis e escaláveis.

## 🏗️ Arquitetura Consolidada
- Frontend: Next.js (app.superselleria.com.br)
- Backend: Fastify + App Runner (api.superselleria.com.br)
- Banco: PostgreSQL
- Jobs internos protegidos por X-Internal-Key
- Automação: EventBridge Scheduler (aws_scheduler_*)

## 🔐 Segurança
- INTERNAL_JOBS_KEY armazenado no Secrets Manager
- Injetado no App Runner da API
- Middleware internal-auth valida header X-Internal-Key

## 📊 Dados
- Métricas diárias materializadas em listing_metrics_daily
- Rebuild idempotente via endpoint interno
- Cron ainda não ativo (dependente do Scheduler)

## 🧭 Decisões Importantes
- IA não calcula score
- Score vem de regras determinísticas
- IA apenas explica, reescreve e contextualiza
- Clip/vídeo tratado como conceito único
- Nenhuma feature nova antes de confiabilidade total dos dados
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos
- **Descrição é feature central:** Descrição curta = BUG de produto
- **Prompt especialista é o padrão:** V1 oficialmente aposentado
- **Todo output deve ser "pronto para aplicar"**

### Decisões técnicas (visits)
- **Visitas:** `0` apenas quando fetch ok e dia ausente no mapa; erro → `NULL`
- **Parser:** extrai na ordem: `entry.visits` → `entry.total` → soma de `visits_detail[].quantity`
- **Normalização:** datas ISO convertidas para `YYYY-MM-DD` UTC antes de salvar no map

### Decisões técnicas (orders)
- **Limit clamp:** `limit` nunca excede 51 (ML API não aceita > 51)
- **Erro 400:** não interrompe refresh de metrics/visits; apenas 401/403 interrompem com `reauth_required`
- **Fallback:** quando filtro retorna 0, busca últimos pedidos sem filtro e filtra localmente

### Decisões arquiteturais (access control)
- **Separação de responsabilidades:** `status` (active/paused) vs `access_status` (accessible/unauthorized/blocked_by_policy)
- **Não ingerir dados quando `access_status != accessible`:** Visits/metrics não processam listings bloqueados
- **Reconciliação periódica:** Verifica status real via batch API autenticada (`/items?ids=...`)
- **Não alterar `status` quando bloqueado:** Se PolicyAgent bloqueia, `status` permanece desconhecido (não alterar)
- **Limpeza automática:** Quando listing volta a ser acessível, limpa `access_blocked_*` e marca `access_status='accessible'`

### Decisões arquiteturais (Análise IA Expert)
- **Prompt ml-expert-v1 é o padrão:** V1 oficialmente aposentado, sem fallback
- **Cache de análise por listing:** Evita custos desnecessários com OpenAI; regeneração automática quando `analysisV21` ausente
- **Regeração manual sob demanda:** Botão "Regerar análise" permite forçar nova análise quando necessário
- **Controle de custo OpenAI:** Cache é crítico; sistema respeita cache existente e só regenera quando necessário
- **Integração orientada a versionamento de prompt:** `PROMPT_VERSION = 'ml-expert-v1'` para invalidação de cache
- **Normalização snake_case → camelCase:** Frontend usa dados normalizados para facilitar uso
- **Preparação para IA visual futura:** Armazenar `pictures_json`, `pictures_count` sem análise visual por IA neste momento (decisão consciente para evitar complexidade prematura)

## 🧭 Roadmap (alto nível)
- ONDA 1/2: Score V2 + UX (concluído)
- ONDA 3: IA como amplificador (em progresso)
  - ✅ Análise IA Expert (ml-expert-v1) — **TECNICAMENTE FUNCIONAL**
  - ⏳ Estabilização e refinamento de qualidade — **PENDENTE (Dia 2 não encerrado)**
- Operação: jobs internos + scheduler (fase atual, crítico para clientes reais)
- Próxima épica: Benchmark/Ads/Automações (após dados e operação sólidos)

## 🧠 Estado atual do produto (2026-01-27 — Fim do Dia 2)
- **SuperSeller IA opera com Prompt Especialista (ml-expert-v1) como padrão:** V1 foi oficialmente aposentado
- **Pipeline de análise IA está operacional:** Prompt ml-expert-v1 ativo em produção
- **Cache com forceRefresh funcionando:** Problema de listing incorreto resolvido
- **Normalização snake_case → camelCase implementada:** Modal renderiza dados reais do Expert
- **Front não depende mais de savedRecommendations:** Análises agora diferem por anúncio (bug crítico resolvido)
- **Sistema está preparado para escalar IA, dados e UX:** Fundação sólida para evolução futura
- **Backfill manual por decisão consciente:** Automação futura planejada
- **Preparação para IA visual futura:** Dados de imagens armazenados (`pictures_json`, `pictures_count`) sem análise visual ativa

## ⚠️ PROBLEMAS ABERTOS (NÃO RESOLVIDOS — BLOQUEADORES DE FECHAMENTO DO DIA 2)

### 1️⃣ Profundidade da descrição (CORE DO PRODUTO)
**Status:** 🔴 BLOQUEADOR

A IA ainda está entregando descrições rasas.

**Exemplo atual em tela:**
> "Meias 3D Infantis Crazy Socks - Perfeitas para crianças…"

Isso não atende a proposta de valor do SuperSeller IA.

**🔴 EXPECTATIVA CORRETA:**
- Descrição estruturada
- SEO forte
- Blocos claros (benefícios, tamanhos, confiança, CTA)
- Copy pronta para colar

**Causa raiz:**
- Problema de prompt + regras de densidade mínima
- Precisa virar decisão explícita de produto

### 2️⃣ Promoção (DADO INCOMPLETO)
**Status:** 🔴 BLOQUEADOR

A IA afirma "não há promoção" mesmo quando existe.

**Causa raiz:**
- Backend não envia `has_promotion`, `promotion_price`, `original_price`
- A IA está chutando

**Decisão necessária:**
- Promoção deve ser determinística
- Se dado não existir → IA deve dizer "não foi possível confirmar"
- Não pode afirmar ausência sem certeza

### 3️⃣ Vídeo / Clip (REGRESSÃO LÓGICA)
**Status:** 🔴 BLOQUEADOR

Mesmo com `hasClipDetected = null`, IA sugere "Adicionar vídeo".

**Correto seria:**
- `true` → não sugerir
- `false` → sugerir
- `null` → sugestão condicional ("se não houver vídeo…")

### 4️⃣ Deeplink do Mercado Livre (edição)
**Status:** 🟡 MELHORIA

Botão "Abrir no Mercado Livre" abre página pública.

**Antes funcionava no modo edição.**

**Link correto de edição identificado como padrão:**
```
https://www.mercadolivre.com.br/anuncios/{ITEM_ID}/modificar/bomni?callback_url=...
```

**Ação necessária:**
- Backend deve fornecer `editUrl`
- Front deve priorizar `editUrl` sobre `publicUrl`

### 5️⃣ UX / UI do Modal (NÃO BLOQUEANTE, MAS REGISTRAR)
**Status:** 🟡 MELHORIA

Layout atual funciona, mas está visualmente confuso.

**Precisa de hierarquia melhor:**
- Diagnóstico compacto
- Ações claras
- Detalhes colapsáveis (descrição, imagens, hacks)

## ✅ Estado atual (2026-01-27)
### Produção
- Deploy está verde.
- Dashboard Overview está funcionando para:
  - totalListings, activeListings, stock, pedidos e receita
  - série diária contínua (periodDays dias) em UTC
  - **Visitas exibidas no gráfico com valores > 0** ✅
- Conexão Mercado Livre:
  - tratada com `reauth_required`
  - callback com diagnóstico + códigos de erro
  - migrations aplicadas em PROD
  - **Múltiplas conexões no banco:** sistema usa sempre a conexão `active` mais recente
  - **Atenção:** divergências de `sellerId` entre conexões podem explicar diferenças em orders

### Data pipeline
- `orders` + `order_items`: OK
- `listing_metrics_daily.orders/gmv`: OK
- `listing_metrics_daily.visits`: ✅ **RESOLVIDO** — valores > 0 no DB e UI
- **Access Control:** Listings bloqueados por PolicyAgent marcados corretamente (`access_status='blocked_by_policy'`)
- **Reconciliação:** Status de listings (`active`/`paused`) sincronizado com ML via batch API autenticada

### Análise IA
- **Prompt ml-expert-v1 ativo:** Sistema usa exclusivamente prompt especialista
- **Cache funcional:** Regeneração automática quando `analysisV21` ausente
- **Normalização implementada:** Frontend recebe dados em camelCase
- **Modal renderiza dados reais:** verdict, titleFix, descriptionFix, imagePlan, priceFix, algorithmHacks, finalActionPlan
- **Análises diferem por anúncio:** Bug crítico de listing incorreto resolvido

## 🔥 Prioridade Zero (base do produto)
**ML Data Audit (confiabilidade dos dados) — CONCLUÍDO** ✅

Status: 
- ✅ **Visits funcionando** — dados confiáveis, 0 NULL quando fetch ok
- ✅ **Sistema resiliente a bloqueios da API ML** — PolicyAgent tratado corretamente
- ✅ **Reconciliação de status** — paused vs active sincronizado
- ✅ **Análise IA operacional** — Prompt Expert ativo, cache funcional, normalização implementada

Próximo foco: **Encerrar Dia 2** — corrigir profundidade de descrição, promoção, vídeo e editUrl.

## 📌 Decisões importantes já tomadas
- Score e ações determinísticas (regras) vêm antes de LLM.
- Não automatizar liga/desliga do ambiente agora; criar runbook manual para reduzir custo.
- **Não ingerir dados quando `access_status != accessible`:** Garante que apenas dados acessíveis são processados
- **Backfill manual por enquanto:** Automação de backfill de visits/metrics será implementada futuramente
- **Multi-conexões:** Sistema usa sempre a conexão `active` mais recente; suporte a múltiplas conexões simultâneas será implementado no futuro
- **IA NÃO DEVE CHUTAR DADOS:** Promoção e vídeo só podem ser afirmados com dados explícitos; caso contrário → resposta condicional
- **Descrição é feature central:** Descrição curta = BUG de produto; densidade mínima obrigatória definida no prompt
- **Prompt especialista é o padrão:** V1 oficialmente aposentado; todo output deve ser "pronto para aplicar"

## 🆔 Padronização de tenant_id
- **Situação atual:** Inconsistência (TEXT x UUID)
- **Curto prazo:** Cast explícito para compatibilidade
- **Decisão registrada:** Padronizar UUID no domínio
- **Mudança planejada, não urgente:** Não é bloqueador atual

## 🚧 Riscos conhecidos (backlog)
- **Multi-conexões:** Sistema não suporta múltiplas conexões ativas simultaneamente (usa sempre a mais recente)
- **Inserção manual de anúncios:** Não implementado; sistema depende de sync do Mercado Livre
- **Backfill automático:** Por enquanto, backfill de visits/metrics é manual; automação futura
- **UX com termos técnicos:** "V2.1", "indisponível" precisam refinamento para linguagem de usuário final
- **Qualidade do output da IA:** Descrições rasas, promoção chutada, vídeo com lógica incorreta — **BLOQUEADORES DO DIA 2**

## 🧭 Próxima entrega crítica
✅ **VISITS reais no banco (valores > 0) e exibidos no overview** — CONCLUÍDO
✅ **Análise IA Expert integrada (backend + frontend)** — TECNICAMENTE FUNCIONAL
⏳ **Encerrar Dia 2:** Corrigir profundidade de descrição, promoção, vídeo e editUrl

## 🚀 Plano épico aprovado (próxima fase)
### ONDA 1 — IA SCORE V2 (AÇÃO + EXPLICABILIDADE)
- Backend Action Engine (ScoreActionEngine.ts)
- explainScore()
- Payload enriquecido no /ai/analyze/:listingId com actionPlan e scoreExplanation
- Testes obrigatórios

### ONDA 2 — UX do Score
- Breakdown interativo com tooltips
- Action Plan com priorização, CTA

### ONDA 3 — IA como amplificador (Devin)
- IA explica plano (sem contradizer regras)
- IA reescreve SEO com base nas regras
