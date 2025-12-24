# IA Score Model — SuperSeller IA (V1)

## Objetivo
Criar um score explicável, baseado em dados reais, que represente a qualidade e o potencial de crescimento de um anúncio no Mercado Livre.

## Dimensões do Score

| Dimensão          | Peso | Pontos Máximos |
|-------------------|------|----------------|
| Cadastro          | 20%  | 20             |
| Mídia             | 20%  | 20             |
| Performance       | 30%  | 30             |
| SEO               | 20%  | 20             |
| Competitividade   | 10%  | 10             |

**Score Final:** Soma das dimensões (0-100)

## Regras de Cálculo

### Cadastro (0-20)
- Título length > 10: 5 pontos
- Descrição length > 200: 5 pontos
- Categoria preenchida: 5 pontos
- Status = active: 5 pontos

### Mídia (0-20)
- pictures_count >= 6: 10 pontos (ideal)
- pictures_count >= 3: 5 pontos (parcial)
- has_video = true: 10 pontos

### Performance (0-30)
- visits > 0: 10 pontos
- orders > 0: 10 pontos
- conversion_rate vs baseline (2%):
  - >= 2%: 10 pontos
  - >= 1%: 5 pontos
  - > 0%: 2 pontos

### SEO (0-20)
- CTR relativo:
  - >= 2%: 10 pontos
  - >= 1%: 5 pontos
  - > 0%: 2 pontos
- semantic_score: 10 pontos (placeholder V1)

### Competitividade (0-10)
- Placeholder V1: 50 pontos fixos (5/10)

## Fontes de Dados
- `listings` (cadastro, mídia)
- `listing_metrics_daily` (janela móvel de 30 dias)

**Campos legacy como `visits_last_7d` e `sales_last_7d` são usados apenas como fallback quando não há métricas diárias.**

## Integração com IA

O IA Score é calculado **ANTES** da análise pela IA. A IA:
- **NÃO calcula** o score
- **Explica** os gaps identificados no breakdown
- **Sugere** ações específicas para melhorar cada dimensão
- **Prioriza** dimensões com menor score

## Potencial de Ganho

O sistema calcula automaticamente o potencial de ganho por dimensão:
- Mídia: +10 a +20 (fotos/vídeo)
- Performance: +5 a +15 (conversão/tráfego)
- Cadastro: +5 a +10 (título/descrição)
- SEO: +5 a +10 (CTR/palavras-chave)

## Princípios
- **Explicável:** Cada dimensão tem regras claras
- **Determinístico:** Mesmos dados = mesmo score
- **Anti-alucinação:** Baseado apenas em dados reais
- **Orientado a impacto:** Foco em ações que aumentam o score

## Endpoints

- `GET /api/v1/ai/score/:listingId` - Calcula e retorna o score breakdown
- `POST /api/v1/ai/analyze/:listingId` - Análise completa (score + IA)

## Roadmap
- V2: Benchmark por categoria
- V3: Concorrentes
- V4: Ads / ROAS
