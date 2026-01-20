# NEXT SESSION PLAN — 2026-01-20

## 🎯 Objetivo principal da sessão
Destravar completamente a automação de dados e consolidar a **Onda 3.2.1 como FINALIZADA**, garantindo confiabilidade total do produto.

---

## 🔥 Prioridade Absoluta (ordem exata)
1. Rebuild manual de métricas diárias funcionar via API
2. Terraform apply do Scheduler sem erros
3. Confirmar atualização real do dashboard (7 e 30 dias)

> ⚠️ Nada abaixo pode comprometer ou atrasar esses três pontos.

---

## 🔧 Tarefas técnicas

### 1️⃣ API — Jobs Internos
- Validar valor exato de `INTERNAL_JOBS_KEY`
- Garantir que middleware `internal-auth` compara corretamente o header
- Testar `rebuild-daily-metrics` via curl / PowerShell
- Confirmar registro correto das execuções em `job_logs`

---

### 2️⃣ Infra — EventBridge Scheduler
- Refatorar Terraform para usar **exclusivamente**:
  - `aws_scheduler_connection`
  - `aws_scheduler_api_destination`
- Eliminar qualquer uso de:
  - `aws_cloudwatch_event_api_destination`
- Executar:
terraform apply
-var="enable_scheduler=true"
-var="scheduler_tenant_id=935498cf-062c-41f2-bda1-982f1abd8c61"


---

### 3️⃣ Dados — Validação
- Confirmar `MAX(date)` em `listing_metrics_daily` = data atual
- Conferir impacto real no dashboard overview
- Validar consistência entre visualizações de **7 dias** e **30 dias**

---

## 🔌 4️⃣ Gestão de Custos & Power Management (NOVO BLOCO — suporte à execução)

> Este bloco **não substitui** nem compete com a Onda 3.2.1.  
> Ele existe para **evitar bloqueios operacionais** e **reduzir custo enquanto desenvolvemos**.

### 🎯 Objetivo
Definir um fluxo **simples, confiável e reversível** para ligar/desligar a infra AWS sem depender de `terraform apply` diário frágil.

### Escopo
- Revisar estratégia atual de desligamento:
- App Runner (Lambda) ✅
- NAT Gateway (manual hoje)
- Decidir abordagem oficial:
- NAT fixo (custo previsível, menos dor)
- ou NAT dinâmico fora do Terraform (scripts/Lambda)
- Separar claramente:
- **Infra estrutural** (Terraform)
- **Operação diária** (Lambda / scripts)

### Fora de escopo deste bloco
- Scheduler como dependência de power ON/OFF
- Otimizações avançadas de rede
- Multi-AZ ou HA

📌 Resultado esperado:
- Ritual diário de economia de custos **sem quebrar Terraform**
- Menos fricção no fim/início do dia
- Base sólida para escalar sem sustos de custo

---

## ❌ Fora de escopo (explicitamente mantido)
- Benchmark
- Ads
- Automações avançadas
- IA Propositiva

---

## 📌 DoD da próxima sessão
- Dashboard reflete dados atualizados até hoje
- Rebuild pode ser executado manualmente e automaticamente
- Scheduler criado com sucesso (ou decisão consciente de adiar)
- Fluxo de desligamento da infra documentado e sem improviso
- **Onda 3.2.1 marcada como DONE**
