# SuperSeller IA — Project Context (Atualizado em 2025-12-18)

## Visão Geral
SuperSeller IA é uma plataforma SaaS que utiliza dados reais de marketplaces (inicialmente Mercado Livre)
para gerar diagnósticos, recomendações e ações inteligentes que aumentam visibilidade, conversão e vendas
de anúncios e contas de sellers.

O core do produto é a **Inteligência Artificial aplicada a dados reais do seller**, não regras genéricas.

---

# SuperSeller IA — Project Context

## Fase Atual
FASE 2 — Inteligência de Produto

As fases de correção de dados e sincronização foram concluídas.

## Status Atual (última atualização: 26/12/2025)

### O que já foi concluído (Fase 1 – Dados/Confiabilidade)
- ✅ Sync Mercado Livre (cadastro do listing) corrigido:
  - `pictures_count` preenchendo corretamente
  - `description` preenchendo corretamente (validação: 46/46 ok_desc, sem null/empty)
  - `thumbnail_url` ok
- ✅ `listing_metrics_daily` existe e está populado (últimos 30 dias) após execução do sync de métricas:
  - endpoint utilizado: `POST /api/v1/sync/mercadolivre/metrics?days=30`
- ✅ IA Payload evoluído para usar métricas agregadas 30d preferencialmente via `listing_metrics_daily` + `dataQuality.sources.performance`
- ✅ UX unificada: aba “Recomendações” removida no modal; mantida apenas “Inteligência Artificial”
- ✅ IA Score Model V1 implementado (determinístico, por dimensões):
  - Cadastro 20%, Mídia 20%, Performance 30%, SEO 20%, Competitividade 10%
  - Com clamps por dimensão e clamp final 0–100
  - Endpoint de score: `GET /api/v1/ai/score/:listingId`
- ✅ Retorno do endpoint de score validado manualmente (exemplo):
  - `final: 55`, breakdown consistente
  - `metrics_30d` retornando (visits/orders/revenue; ctr/conversion podem ser null se não houver base)

### Pendência crítica (Fase 1.1 – Vídeo)
- ❌ `has_video` continua 0 em produção (SQL `with_video = 0`), mesmo após re-sync.
- Foram implementadas duas tentativas:
  1) Hotfix 1.1: mapeamento `video_id`/`videos` com regras seguras (não sobrescrever undefined; tratar vazio como false)
  2) Fix “definitivo”: helper `extractHasVideoFromMlItem()` buscando evidências em múltiplos campos (video_id, videos[], keys com "video", attributes, tags) e endpoint de debug (apenas dev) para inspecionar payload whitelisted do ML.
- Suspeita atual: o Mercado Livre pode não expor informação de vídeo via API em alguns itens ou exige chamada autenticada; chamadas diretas sem token retornam:
  - 403 `PolicyAgent / PA_UNAUTHORIZED_RESULT_FROM_POLICIES` em `/items/{id}` (PowerShell sem OAuth)
  - “resource not found” em alguns testes anteriores (provável URL/rota/ID inválido em tentativa)

### Decisão de diagnóstico para próxima sessão (Amanhã)
Objetivo: confirmar se o ML retorna evidência de vídeo quando chamado com OAuth do seller/app.
1) Buscar `access_token` do Mercado Livre no banco (`marketplace_connections` / conexão do tenant)
2) Executar `/items/{MLB...}` com header `Authorization: Bearer <access_token>`
3) Verificar no JSON se existe `video_id`, `videos`, ou qualquer campo relacionado a vídeo
4) Concluir:
   - (A) Se o payload tem evidência -> bug no sync/mapeamento (corrigir gravação em `has_video`)
   - (B) Se o payload não tem evidência -> decisão de produto: `has_video` deve virar tri-state/unknown ou sair do score/peso (não confiar em “UI do ML”)

### Próximos passos planejados (Fase 2 – Inteligência)
- Prioridade 1.2: consolidada (UX unificada no modal)
- Prioridade 1.3: prompt avançado da IA (Cursor) – em andamento/iterativo
- Próximo Sprint: Benchmark por categoria + IA vs Concorrentes + IA para Ads (ROAS-driven) (após fechar `has_video`)
