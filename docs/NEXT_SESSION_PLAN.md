# NEXT SESSION PLAN — 2026-01-20

## 🎯 Objetivo da sessão
Destravar completamente a automação de dados e consolidar a Onda 3.2.1 como FINALIZADA.

## 🔥 Prioridade Absoluta (ordem exata)
1. Rebuild manual de métricas diárias funcionar via API
2. Terraform apply do Scheduler sem erros
3. Confirmar atualização real do dashboard (7 e 30 dias)

## 🔧 Tarefas técnicas
### 1️⃣ API — Jobs Internos
- Validar valor exato de INTERNAL_JOBS_KEY
- Garantir que middleware internal-auth compara corretamente
- Testar rebuild-daily-metrics via curl/PowerShell
- Confirmar registro em job_logs

### 2️⃣ Infra — EventBridge Scheduler
- Refatorar Terraform para usar:
  - aws_scheduler_connection
  - aws_scheduler_api_destination
- Eliminar uso de aws_cloudwatch_event_api_destination no scheduler
- Executar terraform apply com:
  enable_scheduler=true
  scheduler_tenant_id=935498cf-062c-41f2-bda1-982f1abd8c61

### 3️⃣ Dados — Validação
- Confirmar MAX(date) em listing_metrics_daily = data atual
- Conferir impacto no dashboard overview
- Validar consistência entre 7 dias e 30 dias

## ❌ Fora de escopo (explicitamente)
- Benchmark
- Ads
- Automações avançadas
- IA Propositiva

## 📌 DoD da próxima sessão
- Dashboard reflete dados atualizados até hoje
- Rebuild pode ser executado manualmente e automaticamente
- Onda 3.2.1 marcada como DONE
