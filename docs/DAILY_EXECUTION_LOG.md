# DAILY EXECUTION LOG — 2026-01-19

## 🎯 Foco do dia
- Tornar o produto operacionalmente confiável (dados atualizando sem intervenção manual)
- Fechar gaps de mídia (clip/vídeo) e preparar operação (scheduler + jobs internos)

## ✅ Planejado
- [x] Unificar "clip (vídeo)" como único conceito de mídia (ML)
- [x] Criar endpoints internos idempotentes para sync + rebuild de métricas diárias
- [x] Proteger jobs com X-Internal-Key (INTERNAL_JOBS_KEY)
- [x] Preparar scheduler externo (EventBridge → App Runner) via documentação e Terraform
- [ ] Configurar Secrets Manager + App Runner env var (INTERNAL_JOBS_KEY)
- [ ] Executar primeiro rebuild manual e validar dashboard 7/30 dias atualizado

## 🧠 Descobertas
- O dashboard estava desatualizado porque a tabela listing_metrics_daily parou em datas antigas, o que é consistente com ausência de agendamento recorrente.
- App Runner não deve depender de cron interno dentro do processo (instâncias podem reiniciar/escala e jobs deixam de rodar).
- Mercado Livre (seller) trata mídia como CLIP; não faz sentido separar "vídeo" e "clip" no produto.

## ✅ Implementações concluídas hoje
### 1) Unificação de mídia (clip/vídeo)
- "Clip (vídeo)" virou conceito único.
- hasClips é fonte de verdade; hasVideo mantido apenas como legado.
- MediaVerdict, ScoreExplanationService, ScoreActionEngine, OpenAIService e UI atualizados.
- Commit: refactor(media): unify clip/video logic - use only hasClips (56bc5c5)

### 2) Jobs internos (sync + rebuild daily metrics) + segurança
Endpoints internos criados:
- POST /api/v1/jobs/sync-mercadolivre
  - Sync completo do ML (listings + orders)
  - Params: tenantId, daysBack (default 30)
  - Registra execução em job_logs (status/duração/registros)
- POST /api/v1/jobs/rebuild-daily-metrics
  - Recalcula e faz UPSERT em listing_metrics_daily (idempotente)
  - Body: { tenantId, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
  - Retorna: dias processados, upserts, tempo total, MAX(date) após rebuild

Segurança:
- Middleware internalAuthGuard valida header X-Internal-Key
- Chave vem de INTERNAL_JOBS_KEY (Secrets Manager / env var no App Runner)
- 401 se key ausente/errada

Frontend:
- Botão "Atualizar dados" no Dashboard Overview
- Chama sync/rebuild para o período selecionado (7 ou 30 dias), com loading e refresh

Commit: feat(jobs): add internal job endpoints for ML sync and daily metrics rebuild (2eb36a3)

### 3) Scheduler externo (EventBridge → App Runner)
- PR #82 (Devin) com:
  - docs/OPERATIONS_SCHEDULER.md
  - infra/terraform/prod/eventbridge-scheduler.tf
  - Schedule diário (03:00 BRT) e opcional ML sync
  - Retry policy e alarm opcional

## ⚠️ Bloqueios / riscos
- INTERNAL_JOBS_KEY ainda precisa ser criado/configurado em:
  - Secrets Manager (secret prod/INTERNAL_JOBS_KEY)
  - App Runner env vars (INTERNAL_JOBS_KEY)
- Sem scheduler habilitado, os dados podem voltar a ficar desatualizados se dependermos de chamadas manuais.

## 📌 Decisões tomadas
- Operação do produto no App Runner será baseada em:
  - endpoints internos idempotentes + scheduler externo (EventBridge)
- Mídia no ML será tratada somente como "Clip (vídeo)".

## ➡️ Próximo passo claro
1) Configurar INTERNAL_JOBS_KEY no Secrets Manager e no App Runner.
2) Rodar manualmente /api/v1/jobs/rebuild-daily-metrics (últimos 30 dias) e confirmar:
   - MAX(date) em listing_metrics_daily = data atual
   - Dashboard 7/30 dias atualizado
3) Merge do PR #82 e aplicar Terraform com enable_scheduler=true.
4) Monitorar execuções em job_logs + CloudWatch (App Runner Logs) por 48h.
