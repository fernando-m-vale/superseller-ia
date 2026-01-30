# NEXT SESSION PLAN — Dia 3 (Encerramento do Dia 2)

## ⚠️ Status atual (Dia 2 — Tecnicamente funcional, produto ainda não fechado)
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
**Encerrar pendências do Dia 2 e estabilizar completamente a Análise IA Expert.**

## 🔧 Tarefas prioritárias (ORDEM OBRIGATÓRIA)

### PRIORIDADE 1: Corrigir profundidade da descrição (CORE DO PRODUTO)
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

### PRIORIDADE 2: Corrigir promoção (DADO INCOMPLETO)
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

### PRIORIDADE 3: Corrigir lógica de vídeo (REGRESSÃO LÓGICA)
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

### PRIORIDADE 4: Implementar editUrl do Mercado Livre
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

### PRIORIDADE 5: Validar output vs expectativa de especialista
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
