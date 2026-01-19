# NEXT SESSION PLAN — 2026-01-19 → Próxima sessão

## 🎯 Objetivo da sessão
Ativar operação automática e validar que o produto fica “sempre atualizado” sem intervenção manual.

## ✅ Estado atual (já entregue)
- Mídia unificada para "Clip (vídeo)" (hasClips fonte de verdade).
- Endpoints internos prontos e protegidos:
  - POST /api/v1/jobs/sync-mercadolivre
  - POST /api/v1/jobs/rebuild-daily-metrics
  - X-Internal-Key via INTERNAL_JOBS_KEY
- Frontend com botão "Atualizar dados" no Dashboard Overview.
- PR #82 (Devin) com scheduler EventBridge + Terraform + documentação (OPERATIONS_SCHEDULER.md).

## 🧪 Checklist de execução (ordem exata)
### 1) Configurar segredo e env var
- [ ] Criar secret no AWS Secrets Manager: prod/INTERNAL_JOBS_KEY
- [ ] Adicionar INTERNAL_JOBS_KEY nas env vars do App Runner (service api)
- [ ] Redeploy/refresh do App Runner se necessário

### 2) Testar endpoints internos manualmente
- [ ] Chamar /api/v1/jobs/rebuild-daily-metrics para últimos 30 dias:
  Body: { tenantId, from: "<hoje-30>", to: "<hoje>" }
- [ ] Confirmar resposta do endpoint com MAX(date) atualizado
- [ ] Consultar DB:
  - SELECT MAX(date) FROM listing_metrics_daily;
- [ ] Validar UI:
  - Dashboard 30 dias mostra dados até a data atual
  - Dashboard 7 dias mostra janela correta e dados presentes (quando houver)

### 3) Ativar scheduler (EventBridge)
- [ ] Merge PR #82
- [ ] Aplicar Terraform:
  terraform apply -var="enable_scheduler=true" -var="scheduler_tenant_id=<TENANT_ID>"
- [ ] Validar primeira execução no CloudWatch + job_logs

### 4) Observabilidade / Operação
- [ ] Criar/validar rotina de monitoramento:
  - job_logs: execuções diárias com status SUCCESS
  - App Runner logs: sem erros nas rotas internas
- [ ] Se falhar:
  - rollback do schedule (disable_scheduler=false ou pausar schedule)
  - reexecução manual do rebuild

## ✅ DoD da próxima sessão
- INTERNAL_JOBS_KEY configurado e validado.
- Rebuild manual atualiza listing_metrics_daily até hoje.
- Dashboard 7/30 dias reflete dados atualizados.
- Scheduler ativo e rodando diariamente (com evidência em job_logs).
