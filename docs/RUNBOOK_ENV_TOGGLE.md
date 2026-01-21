# RUNBOOK — Ligar/Desligar Ambiente (Manual)

Objetivo: reduzir custo quando não estiver usando.

## ⚠️ Avisos rápidos
- Desligar RDS derruba API/Web e qualquer job.
- NAT Gateway é caro (se você estiver usando NAT): deletar reduz custo, mas recriar exige cuidado (rotas/ENI).
- App Runner e ALB também cobram, mas geralmente menor que NAT + RDS.
- Antes de desligar, garanta que você não tem processo crítico rodando.

---

# ✅ DESLIGAR (OFF)

## 1) App Runner
Você já tem Lambda para desligar o App Runner.
- Execute a Lambda “stop” do App Runner.
- Valide no console App Runner: service status “Stopped/Paused” (ou equivalente).

## 2) RDS (maior custo provável)
### Se for RDS “DB Instance” (PostgreSQL/MySQL)
Opção recomendada: **Stop** a instância.
- Console AWS → RDS → Databases
- Selecione a instância → Actions → **Stop**
- Observação: a AWS limita “Stop” por período (depois ele pode religar automaticamente). Mesmo assim vale.

Se “Stop” não aparecer (algumas configurações não permitem), alternativas:
- **Scale down** temporário (ex: db.t3.micro) se permitido e sem downtime aceitável? (vai reiniciar)
- **Snapshot + Delete** se você realmente quiser zerar custo (mais agressivo)

### Se for Aurora
- Aurora (Serverless v2) dá para “scale to 0” dependendo config (caso exista).
- Aurora provisionado: não “stop” igual a DB instance; avaliar approach de snapshot/delete ou scale.

## 3) NAT Gateway (se aplicável)
Se você usa NAT Gateway para subnets privadas, ele é um dos maiores custos.
- Console VPC → NAT Gateways → selecionar → **Delete**
- Console VPC → Elastic IPs → (opcional) liberar EIP vinculada ao NAT, se não usar.

⚠️ Atenção: ao deletar NAT, instâncias/serviços em subnets privadas perdem saída para internet (ex: baixar imagens, chamar APIs externas sem VPC endpoints).

## 4) Outros itens para revisar (custos residuais)
- CloudWatch Logs (retenção grande pode acumular)
- ECR (imagens antigas)
- Load Balancer (ALB/NLB), se existir
- Route53 (baixo)
- Secrets Manager (baixo)
- S3 (baixo)

---

# ✅ LIGAR (ON)

## 1) RDS
- RDS → Databases → selecionar → Actions → **Start**
- Aguarde ficar “Available”
- Valide conexão/healthcheck da API depois

## 2) NAT Gateway (se você deletou)
- VPC → Allocate Elastic IP (ou reutilizar)
- VPC → NAT Gateways → Create NAT Gateway
- Associar à subnet pública correta + EIP
- VPC → Route Tables → garantir rota `0.0.0.0/0` para o NAT nas subnets privadas

## 3) App Runner
- Execute a Lambda “start” (ou Start/Resume no console)
- Validar endpoints:
  - /status
  - /api/v1/metrics/overview?days=7

---

# ✅ Checklist rápido pós-ON (DoD)
- API responde /status
- Web carrega /overview
- Refresh funciona sem 401/403
- Query simples no DB retorna (orders/metrics):
  SELECT COUNT(*) FROM listing_metrics_daily WHERE tenant_id='<tenant>';
