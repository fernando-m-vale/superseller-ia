# SuperSeller IA — Project Context (Atualizado em 2025-12-18)

## Visão Geral
SuperSeller IA é uma plataforma SaaS que utiliza dados reais de marketplaces (inicialmente Mercado Livre)
para gerar diagnósticos, recomendações e ações inteligentes que aumentam visibilidade, conversão e vendas
de anúncios e contas de sellers.

O core do produto é a **Inteligência Artificial aplicada a dados reais do seller**, não regras genéricas.

---

## Status Atual do Projeto

### Infra & Segurança (PRIORIDADE 0) — ✅ CONCLUÍDA
- Logging sanitizado (backend + frontend)
- Redaction de secrets, tokens, headers sensíveis
- Stack traces removidos em produção
- Tratamento global de 401 (axios + fetch)
- UX protegida contra crashes (React error #31 eliminado)
- Endpoints de debug protegidos por feature flag
- Páginas instáveis desativadas:
  - `/ai` (mantida apenas versão informativa)
  - `/recommendations` (feature flag off no menu)

---

## Inteligência Artificial — Estado Atual

### Pipeline de Dados
- `listings`: dados básicos do anúncio (título, descrição, mídia, agregados)
- `listing_metrics_daily`: métricas diárias (visits, orders, gmv, impressions, clicks)

### Situação Identificada
- A IA gerava análises incorretas (“sem fotos”, “sem visitas”) porque:
  - `listing_metrics_daily` estava vazia
  - campos agregados (`pictures_count`, `has_video`, `visits_last_7d`, `sales_last_7d`)
    estavam zerados ou sendo sobrescritos com 0
- Sync de métricas foi implementado e executado manualmente:
  - `POST /api/v1/sync/mercadolivre/metrics?days=30`
  - Resultado: `metricsCreated=270`, `listingsProcessed=15`

### Situação Atual (Importante)
- Existem métricas no banco, mas:
  - Nem todos os listings recebem métricas
  - Nenhum listing retorna simultaneamente:
    - `pictures_count > 0`
    - `visits_30d > 0`
- Indício forte de problema no **sync de listings (mídia/performance)** ou sobrescrita indevida
- Decisão tomada: **NÃO criar métricas diárias artificiais**
  - Apenas dados reais ou snapshots honestos
  - IA deve usar fallback + dataQuality quando necessário

---

## Decisão Estratégica
- PRIORIDADE 1 seguirá abordagem **DB-first**:
  - Corrigir ingestão e persistência de dados
  - Só depois evoluir prompt e inteligência da IA
- Análises avançadas (concorrência, ads, score da conta) ficam no backlog

---

## Próximo Foco (amanhã)
- Validar ingestão real de mídia e performance
- Identificar se o problema está:
  - no sync de listings
  - no join/mapeamento
  - ou na origem (API do Mercado Livre)
