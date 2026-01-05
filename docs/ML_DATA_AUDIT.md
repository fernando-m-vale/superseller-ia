# ML DATA AUDIT — Mercado Livre (Contrato de Dados)
**Projeto:** SuperSeller IA  
**Status:** OFICIAL (PRIORIDADE ZERO)  
**Última atualização:** 2026-01-05  

---

## 0) Regras-mãe (não negociáveis)

### 0.1 Dado ausente ≠ dado ruim
- **NULL** significa: *“indisponível / desconhecido via API / não coletado ainda”*
- **0** significa: *“valor real zero”*
- Nunca converter `null → 0` silenciosamente.

### 0.2 Proibido estimar métricas
É **proibido** derivar / inventar:
- impressions
- clicks
- ctr
- conversion

Se não houver fonte oficial, devem permanecer **NULL**.

### 0.3 Fonte de verdade (SoT)
- **Cadastro/Itens:** Items API (`/items`, `/items/{id}`, `/items/{id}/description`, `/sites/MLB/search`)
- **Vendas/GMV 30d:** Orders API (`/orders/search`, `/orders/{id}`)
- **Visitas (série temporal):** **Visits API** (`/items/{id}/visits/time_window` e/ou `/items/visits?...`)
- **Vídeo/Clips:** existem limitações. `has_video` pode não refletir **Clips**.

### 0.4 Qualidade de dado deve ser explícita
A aplicação deve carregar/propagar:
- `dataQuality.sources[]`
- `dataQuality.missing[]`
- `dataQuality.confidence` (se aplicável)

---

## 1) Mapa de Endpoints do ML usados pelo sistema

| Categoria | Endpoint | Uso | Observações |
|---|---|---|---|
| OAuth | `/authorization` | login/consentimento | fluxo OAuth |
| OAuth | `/oauth/token` | token/refresh | refresh automático |
| Listings | `/sites/MLB/search` | listar itens do seller | busca por seller/keywords |
| Listings | `/items` | batch item data | quando aplicável |
| Listings | `/items/{id}` | detalhes do item | cadastro/mídia/atributos |
| Listings | `/items/{id}/description` | descrição | descrição completa |
| Orders | `/orders/search` | pedidos período | 30d (janela) |
| Orders | `/orders/{id}` | detalhes do pedido | GMV/itens |
| User | `/users/me` | identificar seller | user id |

> Importante: Visitas **não** vêm da Items API. Elas são obtidas via **Visits API** (ver seção 4).

---

## 2) Contrato de Dados — Listings (Cadastro)

### 2.1 Campos essenciais (cadastro)
| Campo (interno) | Campo (ML) | Endpoint (SoT) | Persistência (DB) | Exposição (API/UI) | Status | Observações |
|---|---|---|---|---|---|---|
| listing_id_ext | id | `/items/{id}` | listings.listing_id_ext | /listings | ✅ | ID MLB... |
| title | title | `/items/{id}` | listings.title | UI | ✅ | |
| description | plain_text / text | `/items/{id}/description` | listings.description | UI | ✅ | sempre usar /description como fonte |
| category_id | category_id | `/items/{id}` | listings.category_id | UI | ✅ | |
| status | status | `/items/{id}` | listings.status | UI | ✅ | active/paused/etc |
| price | price | `/items/{id}` | listings.price | UI | ✅ | |
| available_quantity | available_quantity | `/items/{id}` | listings.stock | UI | ✅ | |
| listing_type_id | listing_type_id | `/items/{id}` | listings.listing_type_id | UI | ✅ | |
| permalink | permalink | `/items/{id}` | listings.permalink | UI | ✅ | |

### 2.2 Atributos e outros (dependente de categoria)
| Campo | SoT | Status | Observações |
|---|---|---|---|
| attributes[] | `/items/{id}` | 🟡 | manter raw/selecionar os relevantes por categoria |
| shipping / free_shipping | `/items/{id}` | 🟡 | importante para benchmark futuro |
| warranty | `/items/{id}` | 🟡 | |

---

## 3) Contrato de Dados — Mídia (Fotos/Vídeo/Clips)

### 3.1 Fotos
| Campo (interno) | Campo (ML) | SoT | Persistência | Status | Observações |
|---|---|---|---|---|---|
| pictures[] | pictures | `/items/{id}` | listings.pictures_json (ou equivalente) | ✅ | manter ids/urls |
| pictures_count | pictures.length | `/items/{id}` | listings.pictures_count | ✅ | derivado do array, confiável |

### 3.2 Vídeo x Clips (atenção)
| Campo | SoT | Status | Observações |
|---|---|---|---|
| has_video | detectável via `/items/{id}` | ⚠️ parcial | pode detectar “vídeo tradicional”, mas **pode não detectar Clips** |
| has_clips | (pode não existir em Items API) | ❓ | se ML não expõe no item, tratar como “indisponível” (null/unknown) |

**Regra:** nunca afirmar “não tem vídeo” se o dado for **indisponível**.  
Exibir:
- `has_video = true/false` se detectável
- caso contrário: `has_video = null` e mensagem “indisponível via API”.

---

## 4) Contrato de Dados — Performance (Visitas, Pedidos, GMV, Conversão)

### 4.1 Visitas (VISITS API) — Fonte oficial
**SoT obrigatório:** Visits API

- Primário (série temporal):  
  `GET /items/{id}/visits/time_window?last=N&unit=day`
- Alternativo (agregado período):  
  `GET /items/visits?ids=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`

**Regras:**
- Se não houver visits coletadas: `visits = null`
- Proibido usar `item.visits` de `/items/{id}` como performance (tende a vir null).
- Visitas devem entrar em `listing_metrics_daily` (1 linha por dia, por listing).

### 4.2 Orders e GMV 30d — Fonte oficial
**SoT obrigatório:** Orders API

- `GET /orders/search` (janela 30d)
- `GET /orders/{id}` (detalhes)

**Regras:**
- `orders_30d` e `gmv_30d` são derivados do período.
- Não usar `sold_quantity` (lifetime) como 30d.

### 4.3 Métricas proibidas (até termos fonte real)
| Métrica | Status | Regra |
|---|---|---|
| impressions | 🚫 | **NULL** sem fonte oficial |
| clicks | 🚫 | **NULL** sem fonte oficial |
| ctr | 🚫 | **NULL** sem fonte oficial |
| conversion_rate | 🟡 | só calcular se `visits` conhecida e >0 |

> Observação: o PR “ML Data Audit Cleanup” já removeu estimativas e tornou impressions/clicks/ctr nullable. ✅

---

## 5) Persistência — `listing_metrics_daily` (série temporal)

### 5.1 Convenção de origem (source)
| source | Quando usar |
|---|---|
| `ml_visits_api_daily` | visitas diárias via time_window |
| `ml_visits_api_period` | visitas agregadas por período |
| `ml_orders_period` | orders/GMV via Orders API no período |
| `ml_items` | dados do cadastro via Items API |
| `unknown` | sem dados disponíveis |

### 5.2 Política de upsert
- Não sobrescrever `visits` conhecida com `null`.
- Sempre normalizar `date` para 00:00:00 (timezone consistente).
- Manter integridade do `@@unique([tenant_id, listing_id, date])`.

---

## 6) Contrato de Exposição (API → UI → IA)

### 6.1 API
- Deve retornar `null` quando indisponível.
- Nunca converter `null` em 0.

### 6.2 UI
- Se `visits === null`: mostrar “Indisponível via API (ainda não coletado)”
- Se `visits === 0`: mostrar “0” (zero real)
- Se `impressions/clicks/ctr === null`: ocultar ou mostrar “—”

### 6.3 IA (buildAIAnalyzeInput)
- Se `visits === null`: **não** acusar “poucas visitas/zero visitas”
- Se `visits === null`: **não** calcular conversão
- Sempre listar `dataQuality.missing` no prompt e instruir a IA:
  “não concluir ausência quando o dado é unknown”.

---

## 7) Checklist de Auditoria (execução)

### 7.1 Checklist BD
- [ ] `listings.description` populado via `/items/{id}/description`
- [ ] `pictures_count` consistente com `pictures.length`
- [ ] `has_video` não “mente” quando `null`
- [ ] `lis
