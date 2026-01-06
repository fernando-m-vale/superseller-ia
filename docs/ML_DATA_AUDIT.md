# ML DATA AUDIT — Mercado Livre (Contrato de Dados)

**Projeto:** SuperSeller IA  
**Status:** OFICIAL — PRIORIDADE ZERO  
**Última atualização:** 2026-01-06  

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
- `dataQuality.confidence` (quando aplicável)

---

## 1) Mapa de Endpoints do Mercado Livre

| Categoria | Endpoint | Status | Observações |
|--------|--------|--------|------------|
| OAuth | /authorization | ✅ | login |
| OAuth | /oauth/token | ✅ | token / refresh |
| User | /users/me | ✅ | sellerId |
| Listings (search) | /sites/MLB/search | ❌ | bloqueado por PolicyAgent |
| Listings (user items) | /users/{id}/items/search | ❌ | bloqueado |
| Item detail | /items/{id} | ✅ | permitido |
| Item description | /items/{id}/description | ✅ | permitido |
| Orders | /orders/search | ✅ | permitido |
| Order detail | /orders/{id} | ✅ | permitido |
| Visits | /items/{id}/visits/time_window | ✅ | permitido |

---

## 2) Problema Real Identificado (Evidência)

Mesmo com:
- OAuth válido
- Seller real com anúncios e vendas
- Ambiente PROD (AWS)
- Token ativo

Os endpoints de **descoberta de anúncios** retornam:

```json
{
  "status": 403,
  "code": "PA_UNAUTHORIZED_RESULT_FROM_POLICIES"
}
```

👉 Isso é uma **restrição do Mercado Livre**, não um bug do sistema.

---

## 3) Decisão Oficial — Ingestão de Listings

### 3.1 Estratégia CANÔNICA (não opcional)

A ingestão de anúncios segue **sempre** esta ordem:

1. Tentar discovery via Search API  
2. Se **403 ou total=0**, acionar **fallback via Orders**
3. Orders tornam-se **fonte de descoberta de listings**
4. Details sempre via `/items/{id}`

> ❗ Essa decisão é **definitiva** na PRIORIDADE ZERO

---

## 4) Fallback via Orders (OFICIAL)

### 4.1 Como funciona
- Buscar orders últimos **60 dias**
- Extrair `order_items[].item.id`
- Deduplicar IDs
- Para cada ID:
  - Buscar `/items/{id}`
  - Upsert em `listings`

### 4.2 Garantias
- Idempotente (constraint única)
- Funciona mesmo com PolicyAgent ativo
- Reflete anúncios **realmente vendidos**

### 4.3 Logs obrigatórios
```
discoveryBlocked=true
ordersFound=XX
uniqueItemIds=YY
itemsProcessed=YY
itemsCreated=AA
itemsUpdated=BB
```

---

## 5) Contrato de Dados — Listings

### 5.1 Campos essenciais

| Campo | SoT | Persistência | Status |
|----|----|----|----|
| listing_id_ext | items.id | listings | ✅ |
| title | items.title | listings | ✅ |
| description | /description | listings | ✅ |
| category_id | items.category_id | listings | ✅ |
| price | items.price | listings | ✅ |
| stock | items.available_quantity | listings | ✅ |
| status | items.status | listings | ✅ |
| permalink | items.permalink | listings | ✅ |

---

## 6) Mídia (Fotos / Vídeo / Clips)

### 6.1 Fotos
- `pictures[]` via `/items/{id}`
- `pictures_count = pictures.length` (confiável)

### 6.2 Vídeo / Clips
- `has_video` → **parcial**
- Clips podem não ser detectáveis
- Regra:
  - Se não detectável → `null`
  - Nunca afirmar ausência sem evidência

---

## 7) Performance

### 7.1 Visits (única fonte válida)
- `/items/{id}/visits/time_window`
- Persistir em `listing_metrics_daily`

### 7.2 Orders / GMV
- Via Orders API
- Janela móvel (30d / 60d)

### 7.3 Métricas proibidas
| Métrica | Regra |
|------|------|
| impressions | NULL |
| clicks | NULL |
| ctr | NULL |
| conversion | só se visits conhecida |

---

## 8) Diagnóstico quando listings = 0

### 8.1 Debug
```
GET /api/v1/debug/mercadolivre/me
GET /api/v1/debug/mercadolivre/my-items
```

### 8.2 Interpretação
- 403 → PolicyAgent
- total=0 + orders>0 → usar fallback
- total=0 + orders=0 → seller sem vendas recentes

---

## 9) Critérios de Aceite (PRIORIDADE ZERO)

- [ ] OAuth conecta corretamente
- [ ] `/debug/mercadolivre/me` retorna seller real
- [ ] FULL sync cria listings via Orders
- [ ] Visits sync processa >0 quando houver listings
- [ ] Nenhuma métrica estimada
- [ ] Dashboard mostra dados reais
- [ ] IA não conclui ausência quando dado é null

---

## 10) Status Final
✅ Contrato definido  
✅ Política de fallback oficial  
✅ Sistema compatível com restrições reais do ML  
