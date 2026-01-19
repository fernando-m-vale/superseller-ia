# ML DATA AUDIT — Mercado Livre (PRIORIDADE ZERO)

## 🎯 Objetivo
Garantir que os sinais e métricas do Mercado Livre sejam coletados, armazenados e exibidos com confiabilidade, sem contradições e com operação contínua (sempre atualizado).

---

## ✅ Status atual — 2026-01-19

### 1) Operação / Atualização de dados
Infra:
- Backend roda em AWS App Runner (processo não confiável para cron interno).
- Estratégia correta: endpoints internos idempotentes + scheduler externo (EventBridge).

Implementado:
- POST /api/v1/jobs/sync-mercadolivre (listings + orders)
- POST /api/v1/jobs/rebuild-daily-metrics (UPSERT idempotente em listing_metrics_daily)
- Segurança: X-Internal-Key com INTERNAL_JOBS_KEY

Risco atual:
- INTERNAL_JOBS_KEY ainda precisa estar configurado no Secrets Manager e App Runner.
- Scheduler (EventBridge) precisa ser ativado (PR #82).

### 2) Performance (visits, etc.)
Status:
- Visitas seguem como indisponíveis via API no período (dependente de endpoint/escopo e estratégia de ingestão).
- Orders e receita estão funcionando e alimentam gráficos.

Auditoria:
- listing_metrics_daily é a base do dashboard. Se MAX(date) não chega até hoje, dashboard fica “parado”.

### 3) Mídia (CLIP)
Decisão tomada e implementada:
- Mercado Livre (seller) usa CLIP. Produto passa a tratar como “Clip (vídeo)” — conceito único.
- Fonte de verdade: listings.has_clips (boolean | null).
- listings.has_video é LEGACY e não participa da decisão.

Regras de confiabilidade:
- has_clips = true → afirmar presença e nunca sugerir adicionar
- has_clips = false → sugerir adicionar clip
- has_clips = null → linguagem condicional (“não foi possível detectar via API; valide no painel”)

---

## ✅ Matriz de confiabilidade (atual)

| Sinal | Origem | Armazenamento | Status | Observação |
|------|--------|---------------|--------|-----------|
| pictures_count | ML sync | listings.pictures_count | ✅ Confiável | usado para regras de imagens |
| has_clips | ML sync | listings.has_clips | ⚠️ Parcial | pode vir NULL conforme API/sync |
| has_video (legacy) | legado | listings.has_video | ❌ Não usar | não decide nada no produto |
| orders/receita | ML sync | orders / agregações | ✅ Confiável | alimenta dashboard |
| listing_metrics_daily | jobs internos | listing_metrics_daily | ✅ Confiável quando agendado | depende do scheduler rodar |

---

## 🧪 Testes e validações obrigatórias
### A) Saúde do dashboard
- Query: SELECT MAX(date) FROM listing_metrics_daily;
- DoD: MAX(date) deve ser a data atual (ou ontem, dependendo do horário do scheduler).

### B) Execução de jobs
- Validar job_logs diário:
  - status SUCCESS
  - duration e counters coerentes

### C) Mídia (clip)
- Para anúncios conhecidos com clip:
  - garantir que has_clips = true (se API permitir)
  - se vier NULL, UI deve ser condicional e não afirmar ausência

---

## ✅ Melhorias recomendadas (próximas épicas)
1) Persistência de payload bruto mínimo (auditoria)
- Criar tabela de snapshots ou armazenar JSONB em execuções de sync para rastrear variações da API.

2) Estratégia de visitas/analytics
- Revisitar endpoint oficial de visits/metrics e definir pipeline (janela diária, limites, fallback).

3) DataQuality Score
- Expor por dimensão a confiabilidade do dado (confiável / parcial / indisponível).
