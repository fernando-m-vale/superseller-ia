# DAILY EXECUTION LOG — 2026-01-19

## 🎯 Foco do dia
- Finalizar Onda 3.2.1 (Hotfix Confiança)
- Ativar rebuild manual de métricas diárias
- Preparar automação via EventBridge Scheduler
- Eliminar contradições de mídia (clip/vídeo)

## ✅ Planejado
- [x] Unificar conceito de vídeo/clip para Mercado Livre
- [x] Ajustar MediaVerdict como fonte única de verdade
- [x] Corrigir URL de edição do anúncio no Mercado Livre
- [x] Criar endpoints internos de jobs (sync + rebuild)
- [x] Criar botão de atualização manual no dashboard
- [ ] Executar rebuild manual via API
- [ ] Ativar scheduler via Terraform

## 🧠 Descobertas
- Mercado Livre trata apenas “clip” (não existe vídeo separado)
- has_video no banco é legado e não confiável
- has_clips é a única fonte válida para mídia
- MediaVerdict v2 (clip-based) elimina contradições
- Scheduler do EventBridge NÃO aceita ARN de aws_cloudwatch_event_api_destination
- Scheduler exige aws_scheduler_api_destination (recursos próprios)
- Erros de 401 ocorreram por chamadas feitas no domínio do frontend (app.*) em vez da API (api.*)

## ⚠️ Bloqueios / problemas encontrados
- Rebuild manual retornando 401 (header X-Internal-Key)
- Terraform apply falhando no CreateSchedule por ARN inválido
- Confusão entre EventBridge API Destination vs Scheduler API Destination
- Secrets corretos no App Runner, mas validação ainda falhando (possível mismatch de valor)

## 📌 Decisões tomadas
- Onda 3.2.1 continua válida e essencial
- Clip/vídeo será tratado como conceito único (clip)
- has_video permanece apenas como legado no DB
- Jobs internos são a base da confiabilidade do dashboard
- Scheduler será implementado somente com aws_scheduler_*
- Nada de avançar para novas features antes da automação estar estável

## ➡️ Próximo passo claro
- Resolver definitivamente:
  1. Autenticação do endpoint interno (X-Internal-Key)
  2. Terraform Scheduler com aws_scheduler_api_destination
- Executar rebuild manual com sucesso
- Validar atualização real do dashboard (30 dias)
