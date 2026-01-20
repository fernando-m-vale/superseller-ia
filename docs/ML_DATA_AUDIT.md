# ML DATA AUDIT
Atualizado em: 2026-01-19

## 📥 Fontes de Dados
- Listings (Mercado Livre)
- Orders
- Métricas diárias agregadas

## ⚠️ Estado Atual
- listing_metrics_daily existe e contém dados
- MAX(date) está defasado (último dia: 2026-01-08)
- Rebuild manual ainda não executado com sucesso
- Cron automático ainda não ativo

## 🎥 Mídia
- has_clips é a fonte de verdade
- has_video é legado e não usado em decisões
- Mercado Livre não diferencia vídeo de clip

## 🧪 Gaps Identificados
- Falta automação diária confiável
- Dependência de rebuild manual
- Dashboard pode exibir dados desatualizados

## 🎯 Ação Prioritária
- Ativar rebuild manual
- Ativar scheduler
- Validar atualização contínua
