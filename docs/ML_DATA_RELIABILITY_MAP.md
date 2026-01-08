# ML_DATA_RELIABILITY_MAP — SuperSeller IA
Versão: 1.0  
Última atualização: 2026-01-07

## 🎯 Objetivo
Definir, de forma explícita e operacional, **quais dados do Mercado Livre são confiáveis, parcialmente disponíveis ou indisponíveis**, como eles são ingeridos, como devem ser exibidos na UI e **como a IA deve se comportar em cada cenário**.

Este documento é um **contrato de verdade** entre:
- Backend (pipeline de dados)
- Frontend (UX)
- IA / Score / Recomendações

> Regra de ouro: **Nunca inferir ou inventar dados ausentes. NULL é um valor semântico.**

---

## 🧱 Princípios Fundamentais

1. **Permissão ≠ Disponibilidade**
   - Ter todos os escopos marcados no Dev Center **não garante retorno da API**.
   - O Mercado Livre pode bloquear endpoints por política interna (PolicyAgent).

2. **NULL ≠ 0**
   - NULL significa “indisponível / não detectável”.
   - 0 significa “detectado e igual a zero”.
   - Converter NULL → 0 é proibido.

3. **IA só conclui quando há evidência**
   - Dados ausentes ⇒ diagnóstico condicional.
   - Dados presentes ⇒ diagnóstico conclusivo.

---

## 🗺️ Mapa de Confiabilidade por Domínio

### 1️⃣ Listings (Anúncios)

| Campo / Métrica | Fonte | Status | Observações |
|----------------|------|--------|-------------|
| listagem básica | Orders API | ✅ Confiável | Fallback canônico |
| discovery/search | /sites/MLB/search | 🚫 Bloqueado | 403 PolicyAgent |
| title | /items/{id} | ✅ Confiável | |
| price | /items/{id} | ✅ Confiável | |
| stock | /items/{id} | ✅ Confiável | |
| category_id | /items/{id} | ✅ Confiável | |
| pictures_count | /items/{id} | ✅ Confiável | |
| has_video / clips | — | ⚠️ Indisponível | API não detecta clips |

**Decisões de Produto**
- Listings são descobertos **via Orders (orders_fallback)**.
- Campo `source` em `listings` indica origem (`orders_fallback`, `discovery`).
- Campo `discovery_blocked=true` quando PolicyAgent ocorre.
- `has_video` é **tri-state**:
  - `true` → confirmado
  - `false` → confirmado
  - `null` → não detectável via API

**UI**
- `has_video=null` → “Não detectável via API”
- Nunca mostrar “Não” quando for `null`.

**IA**
- Se `has_video=null`, recomendações são **condicionais**, nunca afirmativas.

---

### 2️⃣ Orders (Pedidos)

| Campo / Métrica | Fonte | Status | Observações |
|----------------|------|--------|-------------|
| orders | Orders API | ✅ Confiável | |
| GMV | Orders API | ✅ Confiável | |
| revenue | Orders API | ✅ Confiável | |
| ticket médio | Derivado | ✅ Confiável | |

**Decisões**
- Orders são a **base mais confiável** do pipeline.
- Métricas financeiras sempre priorizam Orders.

**IA**
- Pode gerar conclusões firmes sobre vendas e receita.

---

### 3️⃣ Visits (Visitas)

| Campo / Métrica | Fonte | Status | Observações |
|----------------|------|--------|-------------|
| visits | /items/visits | ⚠️ Indisponível (atual) | Retorno vazio para este seller |
| visits_daily | Backfill | ⚠️ NULL explícito | Persistido por dia |
| coverage | Derivado | ⚠️ 0/N dias | filledDays = 0 |

**Decisões**
- Backfill grava **linhas diárias sempre**, mesmo com `visits=NULL`.
- `listing_metrics_daily` é a fonte canônica.
- `source='visits_api'`, `period_days=1`.

**UI**
- Quando `filledDays=0`:
  - Mostrar aviso: “Visitas indisponíveis via API no período”.
  - Gráfico não quebra.

**IA**
- Performance marcada como **Indisponível via API**.
- Não penaliza score.
- Não chama de “gargalo”.
- Hacks de tráfego são **condicionais**.

---

### 4️⃣ Performance (Conversão, CTR, Tráfego)

| Métrica | Fonte | Status |
|-------|------|--------|
| impressions | Ads/Search | 🚫 Não disponível |
| clicks | Ads/Search | 🚫 Não disponível |
| ctr | Derivado | 🚫 Não disponível |
| conversion | visits + orders | 🚫 Não disponível |

**Decisão Global**
- Performance **não entra no score** quando visitas são indisponíveis.
- Dimensão pode ficar:
  - “N/A”
  - ou peso 0 temporário

---

### 5️⃣ SEO & Competitividade

| Dimensão | Fonte | Status |
|--------|------|--------|
| SEO (título, descrição) | Items + heurísticas | ✅ Confiável |
| Competitividade (preço) | Items + categoria | ⚠️ Parcial |
| Ranking orgânico | — | 🚫 Indisponível |

**IA**
- SEO é heurístico, baseado em boas práticas do ML.
- Competitividade deve declarar quando não há benchmark completo.

---

## 🧠 Regras Oficiais da IA (Obrigatórias)

1. **Nunca concluir sobre performance sem dados**
2. **Nunca converter NULL em 0**
3. **Toda recomendação deve citar a base do dado**
4. **Quando dado é indisponível, explicar o porquê**
5. **Preferir linguagem condicional a conclusiva quando faltar evidência**

---

## 📌 Exemplos de Linguagem Correta

❌ Errado  
> “O anúncio tem baixo tráfego e conversão.”

✅ Correto  
> “Os dados de visitas não estão disponíveis via API no período analisado. Caso você queira aumentar tráfego, investir em anúncios patrocinados pode ser uma alternativa.”

---

## 🚦 Status Atual do Projeto (Resumo Executivo)

- Listings: ✅ Estável (fallback orders)
- Orders: ✅ Estável
- Visits: ⚠️ Persistido, mas indisponível via API
- IA: 🔧 Em ajuste (dados ausentes tratados corretamente)
- UX: ✅ Não mente, explica limitações
- Base de dados: ✅ Auditável e confiável

---

## 🔜 Próximos Passos Estruturais

1. Cache de análises IA por fingerprint (em andamento)
2. Unificação Clips/Vídeo na UI
3. Avaliar integração Ads (quando aplicável)
4. Expandir mapa para Shopee / outros marketplaces

---

## 📎 Documento Vivo
Este arquivo deve ser atualizado sempre que:
- Um endpoint mudar de status
- Um fallback novo for criado
- Um dado antes indisponível passar a existir

Ele é o **alicerce da credibilidade do SuperSeller IA**.
