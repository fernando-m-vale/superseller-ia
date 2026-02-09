# Exemplo de Payload de Benchmark — MLB4217107417

## Endpoint
`POST /api/v1/ai/analyze/:listingId`

## Resposta (exemplo)

```json
{
  "message": "Análise concluída com sucesso",
  "data": {
    "listingId": "uuid-do-listing",
    "score": 75,
    "scoreBreakdown": { ... },
    "metrics30d": {
      "visits": 315,
      "orders": 1,
      "conversionRate": 0.00317,
      "revenue": 32,
      "ctr": null
    },
    "benchmark": {
      "benchmarkSummary": {
        "categoryId": "MLB1234",
        "sampleSize": 20,
        "computedAt": "2026-02-09T18:30:00.000Z",
        "confidence": "medium",
        "notes": "Baseline de conversão indisponível (dados insuficientes). Comparação baseada apenas em features estruturais.",
        "stats": {
          "medianPicturesCount": 8,
          "percentageWithVideo": 65.0,
          "medianPrice": 60.0,
          "medianTitleLength": 58,
          "sampleSize": 20
        },
        "baselineConversion": {
          "conversionRate": null,
          "sampleSize": 5,
          "totalVisits": 200,
          "confidence": "unavailable"
        }
      },
      "youWinHere": [
        "Seu preço está 47% abaixo da mediana da categoria",
        "Você tem 5 imagens, próximo da média de 8 da categoria"
      ],
      "youLoseHere": [
        "Você tem 5 imagens, 3 abaixo da média de 8 da categoria",
        "65% dos concorrentes têm vídeo detectável",
        "Promoção forte (47% OFF) mas conversão ainda baixa (0.32%)"
      ],
      "tradeoffs": "Você perde em 3 aspectos principais vs concorrentes, mas tem 2 ponto(s) forte(s). Priorize corrigir os gaps para aumentar competitividade.",
      "recommendations": [
        "Adicionar 3 imagens para alcançar a média da categoria",
        "Verificar se há vídeo no anúncio; se não houver, considere adicionar",
        "Priorizar otimização de título, imagens e descrição (gargalo em CTR/qualificação)"
      ]
    },
    "analysisV21": { ... },
    "actionPlan": [ ... ],
    "scoreExplanation": { ... }
  }
}
```

## Validação Manual

### 1. Via curl (endpoint de análise)
```bash
curl -X POST https://api.superselleria.com.br/api/v1/ai/analyze/{listingId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Verificar no UI
- Abrir página de análise do anúncio
- Verificar seção "Comparação com Concorrentes"
- Deve mostrar:
  - Coluna "Você ganha aqui" com pontos fortes
  - Coluna "Você perde aqui" com gaps identificados
  - Texto "Você perde aqui / ganha ali" (tradeoffs)
  - Lista de recomendações baseadas em gaps

### 3. Validação de dados
- `benchmark.benchmarkSummary.stats` deve ter valores reais (não inventados)
- `benchmark.baselineConversion.conversionRate` pode ser `null` se dados insuficientes
- `benchmark.youWinHere` e `benchmark.youLoseHere` devem ter 2-4 itens cada
- `benchmark.recommendations` deve ter 3-5 ações concretas

## Casos de Teste

### Caso 1: Baseline disponível
- `baselineConversion.confidence = "high" | "medium"`
- `baselineConversion.conversionRate` preenchido
- `youLoseHere` pode incluir "abaixo do esperado em pedidos"

### Caso 2: Baseline indisponível
- `baselineConversion.confidence = "unavailable"`
- `baselineConversion.conversionRate = null`
- `benchmarkSummary.notes` explica que baseline não está disponível
- Comparação baseada apenas em features estruturais (imagens, vídeo, título, preço)

### Caso 3: Sem concorrentes
- `benchmark = null` (não incluído na resposta)
- Endpoint não falha; apenas não retorna benchmark

## Observações
- Benchmark é calculado tanto para análise fresh quanto cached
- Se benchmark falhar, não quebra a análise (apenas loga warning)
- Dados são determinísticos (não inventados)
- Se não houver dado suficiente, declara como "indisponível"
