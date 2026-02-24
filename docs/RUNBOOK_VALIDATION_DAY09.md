# Runbook de Validação — DIA 09 (HackEngine v1 + Feedback + UX 2.0 + Opportunity Score)

**Data de criação:** 2026-02-XX  
**Status:** Aguardando validação em PROD  
**Tempo estimado:** 10-15 minutos

## 🎯 Objetivo

Validar que todas as correções dos HOTFIX 09.5 e 09.6 estão funcionando corretamente em produção antes de declarar DIA 09 oficialmente fechado.

## 📋 Checklist de Validação (10 itens)

### 1. Accordion abre: no máximo 1 GET latest (sem loop)

**Como validar:**
1. Abrir DevTools → Network tab
2. Expandir um accordion de um listing com análise recente (<7 dias)
3. Filtrar por `GET /api/v1/ai/analyze/:listingId/latest`

**PASS:** Exatamente 1 request GET latest aparece  
**FAIL:** Múltiplos requests GET latest (loop)

**Evidence:** Screenshot do Network tab mostrando apenas 1 request

---

### 2. Não existe POST analyze automático ao abrir

**Como validar:**
1. Abrir DevTools → Network tab
2. Expandir um accordion de um listing com análise recente (<7 dias)
3. Filtrar por `POST /api/v1/ai/analyze`

**PASS:** Nenhum POST /analyze aparece ao abrir accordion  
**FAIL:** POST /analyze é disparado automaticamente

**Evidence:** Screenshot do Network tab (sem POST /analyze)

---

### 3. POST analyze só via botão "Regenerar análise"

**Como validar:**
1. Abrir DevTools → Network tab
2. Clicar no botão "Regenerar análise" (se disponível)
3. Filtrar por `POST /api/v1/ai/analyze`

**PASS:** POST /analyze aparece APENAS após clicar no botão  
**FAIL:** POST /analyze não aparece ou aparece sem clicar

**Evidence:** Screenshot do Network tab + payload do request (salvar JSON)

---

### 4. Hacks: botões clicáveis e 1 click = 1 request de feedback

**Como validar:**
1. Abrir DevTools → Network tab
2. Expandir seção "🚀 Hacks Mercado Livre"
3. Clicar em "Confirmar implementação" de um hack
4. Filtrar por `POST /api/v1/listings/:listingId/hacks/:hackId/feedback`

**PASS:** Exatamente 1 request POST feedback aparece com status 200  
**FAIL:** Nenhum request aparece ou múltiplos requests aparecem

**Evidence:** Screenshot do Network tab + payload do request (salvar JSON)

**Repetir para:** Botão "Não se aplica"

---

### 5. Persistência: após reload, status confirmado/dismissed persiste

**Como validar:**
1. Confirmar um hack como "Implementado" (ou "Não se aplica")
2. Verificar que badge "Implementado" (ou "Não se aplica") aparece
3. Recarregar a página (F5)
4. Expandir o accordion novamente

**PASS:** Badge "Implementado" (ou "Não se aplica") continua aparecendo após reload  
**FAIL:** Badge desaparece ou botões reaparecem

**Evidence:** Screenshot antes e depois do reload

---

### 6. ml_smart_variations omitido se variationsCount >= 5

**Como validar:**
1. Identificar um listing com `variations_count >= 5` (ex: 11 variações)
2. Abrir análise do listing
3. Verificar seção "🚀 Hacks Mercado Livre"

**PASS:** Hack "ml_smart_variations" NÃO aparece na lista  
**FAIL:** Hack "ml_smart_variations" aparece mesmo com >=5 variações

**Evidence:** Screenshot da lista de hacks + query SQL confirmando `variations_count`:
```sql
SELECT listing_id_ext, variations_count FROM listings WHERE variations_count >= 5 LIMIT 1;
```

---

### 7. Full omitido quando shippingMode unknown e isFullEligible != true

**Como validar:**
1. Identificar um listing com `shipping_mode = 'unknown'` e `is_full_eligible != true`
2. Abrir análise do listing
3. Verificar seção "🚀 Hacks Mercado Livre"

**PASS:** Hack "ml_full_shipping" NÃO aparece na lista  
**FAIL:** Hack "ml_full_shipping" aparece mesmo com shippingMode unknown

**Evidence:** Screenshot da lista de hacks + query SQL confirmando condições:
```sql
SELECT listing_id_ext, shipping_mode, is_full_eligible FROM listings 
WHERE shipping_mode = 'unknown' AND (is_full_eligible IS NULL OR is_full_eligible = false) 
LIMIT 1;
```

---

### 8. Clip tri-state: se hasClips true, não sugerir clip/vídeo

**Como validar:**
1. Identificar um listing com `has_clips = true`
2. Abrir análise do listing
3. Verificar seção "🚀 Hacks Mercado Livre" e seção de Mídia

**PASS:** Nenhuma sugestão de "adicionar clip" ou "adicionar vídeo" aparece  
**FAIL:** Sugestão de clip/vídeo aparece mesmo com `has_clips = true`

**Evidence:** Screenshot da lista de hacks + seção de mídia + query SQL:
```sql
SELECT listing_id_ext, has_clips FROM listings WHERE has_clips = true LIMIT 1;
```

---

### 9. Categoria: exibe breadcrumb (quando disponível) ou fallback claro

**Como validar:**
1. Abrir análise de um listing com hack "ml_category_adjustment"
2. Verificar evidências do hack

**PASS:** 
- Se breadcrumb disponível: exibe "Categoria atual: Moda > Infantil > Meias" (texto legível)
- Se breadcrumb não disponível: exibe "Categoria atual: MLB1234" ou mensagem clara
- NÃO afirma "categoria incorreta" sem benchmark de conversão

**FAIL:** 
- Exibe apenas código MLBxxxx sem breadcrumb quando API ML está disponível
- Afirma "categoria incorreta" sem evidência de benchmark

**Evidence:** Screenshot do hack de categoria com evidências

**Nota:** Breadcrumb depende de cache da API ML (24h TTL). Se API ML falhar/timeout, sistema deve degradar graciosamente (sem bloquear análise).

---

### 10. Opportunity Score: aparece, ordena, e Top 3 exibido

**Como validar:**
1. Abrir análise de um listing com múltiplos hacks (>=3)
2. Verificar seção "🚀 Hacks Mercado Livre"

**PASS:** 
- Cada hack exibe badge "Opportunity X/100" (ou label equivalente)
- Hacks estão ordenados por Opportunity Score (maior primeiro)
- Seção "🔥 Prioridades (Top 3)" aparece com até 3 hacks
- Badge de prioridade "#N" aparece no header de cada card

**FAIL:** 
- Opportunity Score não aparece
- Ordenação incorreta (não por score desc)
- Top 3 não destacado ou seção não aparece

**Evidence:** Screenshot da lista completa de hacks mostrando ordenação e Top 3

---

## 📸 Evidence Capture

**O que coletar:**

1. **Network tab (DevTools):**
   - Screenshot mostrando 1 GET latest (sem loop)
   - Screenshot mostrando POST /analyze apenas via botão
   - Screenshot mostrando POST feedback (1 request por clique)

2. **Payloads (salvar JSON):**
   - 1 payload de GET /api/v1/ai/analyze/:listingId/latest (response completo)
   - 1 payload de POST /api/v1/ai/analyze/:listingId (response completo, via botão)
   - 1 payload de POST /api/v1/listings/:listingId/hacks/:hackId/feedback (request + response)

3. **UI Screenshots:**
   - Lista de hacks mostrando ordenação e Top 3
   - Hack de categoria com breadcrumb (ou fallback)
   - Badge "Implementado" após confirmar hack
   - Badge "Implementado" após reload da página

4. **SQL Queries (resultados):**
   - Listing com variations_count >= 5
   - Listing com shipping_mode unknown e is_full_eligible != true
   - Listing com has_clips = true

---

## ⚠️ Risks / Watchlist

**Pontos que historicamente deram problema:**

1. **Loop de requests GET latest**
   - Sintoma: Múltiplos requests GET latest sem parar
   - Causa raiz: Guard condition incorreto ou anti-loop latch não funcionando
   - Fix aplicado: HOTFIX 09.4 (anti-loop latch por listingId)

2. **Analyze duplo (POST automático)**
   - Sintoma: POST /analyze dispara ao abrir accordion
   - Causa raiz: fetchExisting sem memoização ou fallback automático
   - Fix aplicado: HOTFIX 09.5 (fetchExisting memoizado, sem fallback automático)

3. **Botões não clicáveis**
   - Sintoma: Clique não dispara request
   - Causa raiz: Event capturado pelo accordion ou disabled por undefined
   - Fix aplicado: HOTFIX 09.5 (stopPropagation + preventDefault + z-index)

4. **Variações >=5 ainda sugere hack**
   - Sintoma: ml_smart_variations aparece mesmo com muitas variações
   - Causa raiz: variationsCount não persistido ou extraído incorretamente
   - Fix aplicado: HOTFIX 09.2 (variations_count persistido no DB)

5. **Clip/vídeo tri-state não respeitado**
   - Sintoma: Sugestão de clip aparece mesmo com hasClips=true
   - Causa raiz: Tri-state não preservado em signals
   - Fix aplicado: HOTFIX 09.5 (hasClips preservado como boolean | null)

6. **Categoria breadcrumb não aparece**
   - Sintoma: Apenas código MLBxxxx exibido
   - Causa raiz: CategoryBreadcrumbService não integrado ou API ML falhou
   - Fix aplicado: HOTFIX 09.5 (CategoryBreadcrumbService com cache 24h)
   - Degradação: Se API ML falhar, sistema deve continuar sem breadcrumb (não bloquear)

7. **ML 403 benchmark**
   - Sintoma: Benchmark não disponível por erro 403 da API ML
   - Causa raiz: Rate limit ou token expirado
   - Status: Fallback controlado implementado (benchmark opcional)

---

## ✅ Critério de PASS

**Todos os 10 itens devem passar.** Se algum item falhar:

1. Documentar o item que falhou
2. Capturar evidence (screenshots, payloads, logs)
3. Investigar causa raiz
4. Corrigir e re-validar
5. Atualizar este runbook com a correção

**Se PASS → Declarar DIA 09 oficialmente fechado e prosseguir para DIA 10.**

---

## 📝 Notas Operacionais

- **Cache de breadcrumb:** TTL de 24h. Se API ML falhar/timeout, sistema continua sem breadcrumb (não bloqueia análise).
- **Validação rápida:** Este checklist pode ser executado em 10-15 minutos se todos os itens passarem.
- **Ambiente:** Validar em PROD ou staging que espelha PROD (mesma infraestrutura).
