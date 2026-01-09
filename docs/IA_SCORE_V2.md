# IA Score V2 — Valor Real, Explicável e Monetizável

## 1. Objetivo

O IA Score V2 é a evolução do modelo inicial de avaliação de anúncios do SuperSeller IA.
Seu objetivo é **entregar valor prático, confiável e acionável**, respeitando as limitações reais de dados das APIs dos marketplaces e preparando o produto para monetização via inteligência avançada.

O score não é apenas uma nota — é um **sistema de decisão orientado a crescimento**.

---

## 2. Princípios Não-Negociáveis

1. **Nunca inferir dados inexistentes**
   - Dados indisponíveis via API devem ser tratados explicitamente como `NULL`.
   - A IA nunca deve afirmar algo que não pode comprovar.

2. **Explicabilidade total**
   - Todo ponto do score deve ser justificável.
   - O usuário entende:
     - por que perdeu pontos
     - como pode recuperar
     - qual impacto esperado

3. **Separação entre avaliação e recomendação**
   - Score mede o estado atual.
   - Recomendações mostram caminhos de melhoria.
   - Automações só ocorrem com autorização explícita.

4. **Preparado para benchmark e automação**
   - O modelo nasce compatível com comparação competitiva e ações automáticas futuras.

---

## 3. Evolução em Relação à V1

### V1 (estado inicial)
- Score baseado em dados absolutos
- Penalizações mesmo com dados ausentes
- IA com linguagem afirmativa mesmo em cenários incompletos

### V2 (estado atual)
- Introdução de `dataQuality` e `performanceAvailable`
- Uso de `visitsCoverage` para medir confiabilidade
- Linguagem condicional quando dados não existem
- Cache de IA por fingerprint (redução de custo e consistência)
- Base sólida para benchmark, Ads e automações

---

## 4. Dimensões do IA Score (Resumo)

| Dimensão          | Peso Máx | Fonte de Dados                    |
|-------------------|----------|-----------------------------------|
| Cadastro          | 20       | Items API                         |
| Mídia             | 20       | Items API (pictures, clips/video) |
| Performance       | 30       | listing_metrics_daily             |
| SEO               | 20       | Conteúdo + heurísticas            |
| Competitividade   | 10       | Categoria / preço / ofertas       |

> Obs: Performance **não é penalizada** quando `performanceAvailable=false`.

---

## 5. Action Engine (Recomendações)

Cada recomendação possui:

- `title`
- `description`
- `priority` (low | medium | high)
- `estimatedImpact`
- `dimensionAffected`
- `requiresUserApproval`

Exemplo:
- “Adicionar vídeo ao anúncio”
- Impacto estimado: +10% conversão
- Dimensão: Mídia
- Aprovação necessária: Sim

---

## 6. Qualidade e Confiança dos Dados

### Estrutura `dataQuality`

- `missing`: métricas ausentes
- `warnings`: limitações conhecidas da API
- `completenessScore`: % de completude
- `visitsCoverage`: dias com dados / total
- `performanceAvailable`: boolean

A UI e a IA **devem refletir exatamente esse estado**.

---

## 7. UX e Comunicação com o Usuário

Regras obrigatórias:
- Mostrar “Indisponível via API” quando aplicável
- Nunca afirmar ausência quando o dado é `NULL`
- Exibir banners de contexto quando dados são parciais
- Mostrar quando a análise veio de cache (com opção de atualizar)

---

## 8. Base para Monetização

O IA Score V2 habilita:

- Limite de análises por período
- Cache como benefício de planos pagos
- Benchmark competitivo como upsell
- Ads Intelligence como add-on
- Automações como plano premium

---

## 9. Próximas Extensões

- Competitive Intelligence
- Ads Intelligence
- AI Automations (ações autônomas)
- IA Score V3 (score relativo ao mercado)

Documentos relacionados:
- `COMPETITIVE_INTELLIGENCE.md`
- `ADS_INTELLIGENCE.md`
- `AI_AUTOMATIONS.md`
