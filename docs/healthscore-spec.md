# healthScore Function — Core Package

## Overview
A função `healthScore()` calcula um score 0–100 baseado em métricas diárias de anúncios.

### Algoritmo
- Normalização min–max:
  ```ts
  norm(x) = (x - minX) / (maxX - minX)
  if (maxX === minX) norm = 0.5
  ```
- Pesos:
  - CTR: 30%
  - CVR: 30%
  - Revenue: 25%
  - Orders: 15%
- Filtros:
  - Últimos `windowDays` (por data ISO ascendente)
  - Mínimo `minDays` (padrão 3)
  - Ignorar valores negativos/NaN
- Retorna `null` se dados insuficientes

### Cálculo
- CTR = visits/impressions (0 se impressions=0)
- CVR = orders/visits (0 se visits=0)
- Score = média ponderada × 100
- Resultado arredondado: `Math.round(score * 10000) / 100`

### Referência
Testes: `packages/core/__tests__/healthScore.test.ts`
