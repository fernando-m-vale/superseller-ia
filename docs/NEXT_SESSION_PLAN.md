# NEXT SESSION PLAN — Dia 3

## ✅ Status atual (Dia 2 em finalização)
- **Análise IA V2.1:** Backend e frontend integrados
- **V1 descontinuada:** UI V1 removida completamente
- **Cache funcional:** Regeneração automática quando `analysisV21` ausente
- **UX de cache:** Banner e botão "Regerar análise" implementados
- **Build passando:** TypeScript errors corrigidos

## 🎯 Objetivo da próxima sessão
**Encerrar pendências do Dia 2 e estabilizar completamente a Análise IA V2.1.**

## 🔧 Tarefas prioritárias

### PRIORIDADE 1: Finalizar integração V2.1
1. **Corrigir binding completo do `analysisV21` no frontend**
   - Validar que todos os campos do schema real estão sendo renderizados
   - Garantir que não há placeholders ou mensagens "indisponível" quando dados existem
   - Verificar que campos opcionais são tratados corretamente (null/undefined)

2. **Garantir renderização correta de:**
   - ✅ `diagnostic.overall_health`, `main_bottleneck`, `quick_wins`, `long_term`
   - ✅ `actions[]` ordenadas por prioridade (critical > high > medium > low)
   - ✅ `title_analysis.suggestions[0].text` com botão copiar
   - ✅ `description_analysis.suggested_structure` montada como texto completo
   - ✅ `price_analysis` (price_base, price_final, has_promotion, discount_percent)
   - ✅ `media_analysis` (photos.count, photos.score, video.status_message)

3. **Corrigir exibição de preço base vs preço promocional**
   - Validar que `price_base` e `price_final` são exibidos corretamente
   - Garantir que `has_promotion` e `discount_percent` são refletidos na UI
   - Verificar se há discrepâncias entre dados do DB e exibição

4. **Ajustar copy do modal para linguagem de usuário final**
   - Remover termos técnicos ("V2.1", "indisponível")
   - Usar linguagem clara e orientada ao usuário
   - Melhorar mensagens de erro e estados vazios

### PRIORIDADE 2: Validação e testes
1. **Abrir múltiplos anúncios**
   - Validar que cada anúncio carrega sua análise corretamente
   - Verificar que não há mistura de dados entre anúncios
   - Confirmar que cache funciona por listing

2. **Validar cache (não gerar nova análise sem necessidade)**
   - Abrir anúncio com análise existente → não deve chamar OpenAI
   - Verificar banner de cache quando `cacheHit=true`
   - Testar botão "Regerar análise" → deve forçar nova análise

3. **Confirmar que não há chamadas redundantes à OpenAI**
   - Monitorar logs da API durante uso normal
   - Verificar que cache está sendo respeitado
   - Validar que `forceRefresh=true` realmente bypassa cache

4. **Validar comportamento com e sem análise existente**
   - Anúncio sem análise → mostrar estado vazio + botão "Gerar análise"
   - Anúncio com análise → mostrar painel V2.1 completo
   - Anúncio com análise antiga (sem `analysisV21`) → regenerar automaticamente

## 🧪 Validações obrigatórias

### Funcionalidade
- [ ] Modal abre e mostra conteúdo V2.1 (sem abas)
- [ ] Clicar para gerar análise funciona e, ao concluir, painel V2.1 renderiza
- [ ] Não ocorre "Application error" ao interagir com o modal
- [ ] Painel V2.1 não quebra mesmo quando ações/imagens/promo vierem ausentes
- [ ] Cache é respeitado (não gera nova análise sem necessidade)
- [ ] Botão "Regerar análise" força nova análise corretamente

### Dados
- [ ] Todos os campos do `analysisV21` são renderizados quando presentes
- [ ] Preço base vs promocional exibido corretamente
- [ ] Ações ordenadas por prioridade (critical > high > medium > low)
- [ ] Título e descrição sugeridos podem ser copiados
- [ ] Links "Abrir no Mercado Livre" funcionam quando `ml_deeplink` existe

### UX
- [ ] Copy do modal é clara e orientada ao usuário final
- [ ] Banner de cache é discreto e informativo
- [ ] Estados vazios são amigáveis
- [ ] Mensagens de erro são claras

## 🚀 Critério de conclusão do Dia 2

### Obrigatório
- [x] Modal 100% funcional
- [ ] Nenhum placeholder estranho
- [ ] UX clara (sem termos técnicos)
- [ ] Cache ativo e visível para o usuário
- [ ] Build passando sem erros TypeScript
- [ ] CI/CD verde

### Desejável
- [ ] Validação visual de preço promocional
- [ ] Testes automatizados para componente V2.1
- [ ] Documentação de uso do cache

## 🧯 Notas importantes
- **Não reativar V1:** V1 foi descontinuada; focar apenas em V2.1
- **Cache é crítico:** Respeitar cache evita custos desnecessários com OpenAI
- **UX primeiro:** Copy e mensagens devem ser orientadas ao usuário final, não técnico

## 🟢 Após estabilizar V2.1 (próxima fase)
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

### Dados / Engenharia
- Reconciliação completa de status (job dedicado)
- Backfill automático (cron / scheduler)
- Orders x seller_id ao trocar conexão
- Limpeza de dados históricos (soft delete / reprocess)

⚠️ **Registrado explicitamente:** Esses itens NÃO são falhas. São decisões conscientes e maduras de produto e arquitetura.
