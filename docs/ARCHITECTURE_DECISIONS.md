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

## Registro de Decisões Futuras

### Pendentes de ADR formal
- Reconciliação completa de status (job dedicado)
- Orders x seller_id ao trocar conexão
- Limpeza de dados históricos (soft delete / reprocess)
- Inserção manual de anúncio (MLB…)
- Diferenciação clara de status (`paused`, `blocked_by_policy`, `unauthorized`) na UX
- UX do modal de análise (layout e hierarquia)

⚠️ **Nota:** Esses itens NÃO são falhas. São decisões conscientes e maduras de produto e arquitetura, registradas para evolução futura.
