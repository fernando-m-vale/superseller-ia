# DAILY EXECUTION LOG — 2026-01-19

## 🎯 Foco do dia
- Consolidar Onda 3.2.1 (Hotfix Confiança)
- Ativar rebuild manual de métricas diárias
- Avançar na automação via EventBridge Scheduler
- Investigar e ajustar fluxo de desligamento da infra para redução de custos

---

## ✅ Planejado
- [x] Unificar conceito de mídia (clip/vídeo) para Mercado Livre
- [x] Garantir MediaVerdict como fonte única de verdade
- [x] Corrigir URL de edição do anúncio no Mercado Livre
- [x] Criar endpoints internos de jobs (sync + rebuild)
- [x] Criar botão de atualização manual no dashboard
- [ ] Executar rebuild manual com sucesso via API
- [ ] Ativar scheduler via Terraform
- [x] Desligar App Runner ao final do dia
- [x] Desligar NAT Gateway para reduzir custos

---

## 🧠 Descobertas
- Mercado Livre trata apenas **clip** (não existe distinção real de vídeo)
- `has_video` é legado no banco e não deve guiar decisões
- `has_clips` é a única fonte válida para mídia
- MediaVerdict v2 (baseado em clip) elimina contradições em UI, IA e Action Plan
- Endpoints internos de jobs estão corretos, mas autenticação ainda não validada
- Scheduler do EventBridge **não aceita** ARNs de `aws_cloudwatch_event_api_destination`
- Scheduler exige recursos próprios (`aws_scheduler_*`)
- Terraform não é ferramenta adequada para **liga/desliga diário** de NAT
- NAT Gateway é recurso caro e frágil para workflows dinâmicos
- Outputs do Terraform podem bloquear operações mesmo quando o recurso não é o alvo

---

## ⚠️ Bloqueios / problemas encontrados
- Rebuild manual retornando 401 (problema na validação do `X-Internal-Key`)
- `terraform apply` do scheduler falhando por formato inválido de ARN
- Tentativa de desligar NAT via Terraform bloqueada por inconsistência no módulo
- Necessidade de remover/ignorar scheduler temporariamente para operações de custo
- NAT precisou ser excluído manualmente via console AWS para atingir objetivo imediato

---

## 📌 Decisões tomadas
- **Onda 3.2.1 permanece prioritária e válida**
- Clip/vídeo tratado como conceito único definitivamente
- `has_video` mantido apenas como legado (não decisório)
- Jobs internos são base da confiabilidade do dashboard
- **Terraform não será usado para liga/desliga diário de NAT**
- NAT Gateway pode ser gerenciado fora do Terraform quando necessário
- Desligamento manual hoje foi decisão consciente de gestão de custo
- Amanhã será definida estratégia oficial de power management (Opção A vs Opção B)

---

## ➡️ Próximo passo claro (para 2026-01-20)
1. Resolver autenticação dos endpoints internos (`X-Internal-Key`)
2. Executar rebuild manual com sucesso e validar impacto no dashboard
3. Decidir estratégia definitiva de NAT Gateway:
   - **Opção A**: NAT fixo (custo previsível, menor fricção)
   - **Opção B**: NAT dinâmico fora do Terraform (economia máxima)
4. Documentar fluxo oficial de ligar/desligar infra AWS
5. Marcar **Onda 3.2.1 como DONE** após dados estarem 100% confiáveis
