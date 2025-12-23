# SuperSeller IA — Project Context (Atualizado em 2025-12-18)

## Visão Geral
SuperSeller IA é uma plataforma SaaS que utiliza dados reais de marketplaces (inicialmente Mercado Livre)
para gerar diagnósticos, recomendações e ações inteligentes que aumentam visibilidade, conversão e vendas
de anúncios e contas de sellers.

O core do produto é a **Inteligência Artificial aplicada a dados reais do seller**, não regras genéricas.

---

## Atualização — 2025-12-22 (Estado atual da IA + Sync ML)

### O que já foi resolvido (Priorização 0 → 1)
✅ Higiene/segurança/estabilidade concluídas:
- Redaction + sanitizeError + logs seguros (backend + web)
- 401 global (axios + fetch) + UX sessão expirada
- /ai e /recommendations desativadas no app (rotas instáveis protegidas)

✅ Dados de performance agora existem:
- Rodado manualmente: `POST /api/v1/sync/mercadolivre/metrics?days=30`
- Resultado observado no banco: `listing_metrics_daily` com dados no período ~ 2025-11-22 → 2025-12-17
- Exemplo canário: `listing_id = 92f52f51-9f44-4aed-8674-1942b7871ae0` teve `orders_30d` e `gmv_30d` > 0, mas `visits_30d` ainda aparece 0 em alguns cenários

✅ Sync de listings foi reforçado via re-sync manual:
- Novo endpoint para reidratar cadastro do anúncio (mídia/descrição/etc):
  - `POST /api/v1/sync/mercadolivre/listings?limit=50`
- Após executar, os campos de cadastro passaram a preencher para o canário:
  - `pictures_count` e `description` passaram a ficar corretos
  - `has_video` ainda NÃO está sendo preenchido (pendência)

---

## Situação atual do produto (modal do anúncio)

### Observado no app (canário após re-sync)
- Aba **Inteligência Artificial**:
  - Melhorou bastante (Score e diagnóstico já não “alucinam” tanto)
  - Ainda aponta ausência de vídeo (has_video=false/0)
  - Sugestões de título/descrição e hacks ainda estão “fracos/genéricos”
  - Indício: IA pode não estar recebendo o texto completo da descrição (ou o prompt não orienta bem como usar)

- Aba **Recomendações**:
  - Continua com recomendações antigas/inconsistentes (ex.: “sem fotos/visitas/descrição”)
  - Hoje conflita com a proposta do produto (IA-first)

---

## Decisões e Direção (Roadmap curto)

### Status das prioridades originais
- PASSO 1 (cadastro/mídia): ✅ quase completo (falta has_video)
- PASSO 2 (performance via listing_metrics_daily): ✅ em andamento/validando qualidade (visits zerado ainda suspeito)
- PASSO 3 (reexecutar IA com dados corretos): ✅ parcialmente validado (IA tab melhor)
- PASSO 4 (refinar inteligência): 🔜 próximo (prompt + score model + benchmarks)

### Próximas prioridades (a partir daqui)
**PRIORIDADE 1.2 — Unificar UX (matar “Recomendações”)**
- Remover aba “Recomendações” do modal do anúncio (manter somente IA)
- Backend pode manter tabela `recommendations` só como histórico/telemetria (não UI)

**PRIORIDADE 1.3 — Evoluir prompt e análise avançada (IA)**
- Tornar hacks e sugestões mais específicas por categoria
- Garantir uso real de descrição + mídia + métricas
- (Backlog) concorrentes, Ads/ROAS, score global da conta

**PRIORIDADE 1.4 — IA Score Model (modelo explicável)**
- Definir fórmula clara (cadastro + mídia + performance + pricing/competitividade)
- Criar benchmark por categoria e faixa de preço
- Definir leitura “IA vs Concorrentes”
- Estruturar módulo “IA para Ads (ROAS-driven)”

---

## Pendências técnicas críticas (para corrigir amanhã)
1) `has_video` não está sendo preenchido no `listings`
   - Revisar mapeamento ML → DB e chamadas usadas (`video_id` / `videos` / campos reais da API)
2) Performance: `visits_30d` ainda aparece 0 em alguns casos, enquanto orders/gmv > 0
   - Validar origem e qual endpoint de visitas está sendo usado (ou se não existe e precisa assumir “visits unknown” com dataQuality)
3) Aba “Recomendações” no modal precisa ser removida ou reusada como “Ações da IA” (mesma fonte)
