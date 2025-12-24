# IA Score Model — SuperSeller IA (V1)

## Objetivo
Criar um score explicável, baseado em dados reais, que represente a qualidade e o potencial de crescimento de um anúncio no Mercado Livre.

## Dimensões do Score

| Dimensão          | Peso |
|-------------------|------|
| Cadastro          | 20%  |
| Mídia             | 20%  |
| Performance       | 30%  |
| SEO               | 20%  |
| Competitividade   | 10%  |

## Fontes de Dados
- listings
- listing_metrics_daily (janela móvel de 30 dias)

Campos legacy como visits_last_7d e sales_last_7d NÃO são utilizados.

## Score Final
Score final é a soma ponderada das dimensões.

## Princípios
- Explicável
- Determinístico
- Anti-alucinação
- Orientado a impacto financeiro

## Roadmap
- V2: Benchmark por categoria
- V3: Concorrentes
- V4: Ads / ROAS
