# ML DATA AUDIT — Mercado Livre (Contrato de Dados)

**Projeto:** SuperSeller IA  
**Status:** OFICIAL — PRIORIDADE ZERO  
**Última atualização:** 2026-01-08  

Este documento garante a confiabilidade dos dados que alimentam:
- IA Score V2
- Benchmark competitivo
- Ads Intelligence


---

## 0) Regras-mãe (não negociáveis)

### 0.1 Dado ausente ≠ dado ruim
- **NULL** = indisponível / desconhecido / não fornecido pela API
- **0** = valor real zero
- É proibido converter `null → 0` silenciosamente

### 0.2 Proibido estimar métricas
É **expressamente proibido** inventar ou inferir:
- impressions
- clicks
- ctr
- conversion

Se não houver fonte oficial → **NULL**

### 0.3 Fonte de verdade (Source of Truth)
- **Cadastro / Itens:** Items API
- **Vendas / GMV:** Orders API
- **Visitas:** Visits API
- **OAuth / Seller:** Users API

### 0.4 Qualidade de dado explícita
Toda análise deve considerar:
- `dataQuality.sources[]`
- `dataQuality.missing[]`
- `dataQuality.blocked[]`
- `visitsCoverage { filledDays, totalDays }`
- `performanceAvailable` (boolean)

---

## 1) Mapa REAL de Endpoints do Mercado Livre

| Categoria | Endpoint | Status | Observações |
|--------|--------|--------|------------|
| OAuth | /authorization | ✅ | login |
| OAuth | /oauth/token | ✅ | token / refresh |
| User | /users/me | ✅ | sellerId |
| Listings (search) | /sites/MLB/search | ❌ | bloqueado (PolicyAgent) |
| Listings (user items) | /users/{id}/items/search | ❌ | bloqueado |
| Item detail | /items/{id} | ✅ | permitido |
| Item description | /items/{id}/description | ✅ | permitido |
| Orders | /orders/search | ✅ | permitido |
| Order detail | /orders/{id} | ✅ | permitido |
| Visits | /items/{id}/visits/time_window | ⚠️ | intermitente / parcial |

---

## 2) Decisão Oficial — Ingestão de Listings

### Estratégia CANÔNICA (não opcional)

1. Tentar discovery via Search API  
2. Se **403 ou total=0** → **Orders Fallback**
3. Orders tornam-se fonte de descoberta de listings
4. Details sempre via `/items/{id}`

Campos de auditoria obrigatórios em `listings`:
- `source`: discovery | orders_fallback
- `discovery_blocked`: boolean

---

## 3) Mídia (Fotos / Clips)

### Fotos
- `pictures[]` via Items API
- `pictures_count = pictures.length` (confiável)

### Clips (Vídeo)
Campo unificado:
- `has_video = true` → possui clips
- `has_video = false` → confirmado sem clips
- `has_video = null` → **não detectável via API**

⚠️ Nunca afirmar ausência quando `null`.

---

## 4) Performance e Visitas

### Visits
- Única fonte válida: Visits API
- Persistência **diária obrigatória** em `listing_metrics_daily`
- Regra:
  - API retorna valor → gravar número
  - API não retorna → gravar **NULL**
- Nunca gravar `0` como fallback

### Estado derivado
- `visitsCoverage`
- `performanceAvailable = visitsCoverage.filledDays > 0`

---

## 5) Contrato com IA (OBRIGATÓRIO)

A IA:
- ❌ Não penaliza performance quando `performanceAvailable=false`
- ❌ Não afirma “baixo tráfego” sem visitas
- ✅ Usa linguagem condicional quando dados indisponíveis
- ✅ Explica limitações da API ao usuário

---

## 6) Status Final da PRIORIDADE ZERO

- [x] Fallback Orders oficial
- [x] Listings populadas em PROD
- [x] Visits backfill diário (linhas sempre criadas)
- [x] NULL tratado corretamente
- [x] IA alinhada com dados reais
- [x] UX nunca contradiz a realidade

✅ **PRIORIDADE ZERO ENCERRADA**
