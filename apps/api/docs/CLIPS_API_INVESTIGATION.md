# Investigacao: Clips API do Mercado Livre para Itens Locais (MLB)

**Data:** 2026-02-25
**Status:** PENDENTE RESULTADOS
**Autor:** Devin (assistido por Fernando)

---

## 1. Contexto

O SuperSeller IA precisa detectar se um anuncio do Mercado Livre possui "Clip" (video curto vertical, estilo Reels/TikTok). Atualmente usamos `GET /items/{id}` e extraimos `video_id` / `videos[]`, mas esses campos referem-se a **videos tradicionais de produto**, nao a Clips.

**Evidencia do problema:**
- `MLB4217107417` TEM clip publicado (confirmado no painel ML), mas API retorna `video_id=null`
- `MLB4167251409` NAO tem clip (confirmado visualmente)

## 2. Descoberta: Clips API (CBT / Global Selling)

Documentacao oficial encontrada: https://global-selling.mercadolibre.com/devsite/working-with-clips

### Endpoint documentado (CBT):
```
GET /marketplace/items/{cbt_item_id}/clips
Authorization: Bearer $ACCESS_TOKEN
```

### Response documentada:
```json
{
  "parent_item_id": "CBT2215534590",
  "parent_user_id": "757729744",
  "clips": [
    {
      "clip_uuid": "46875e1b-4210-4fdc-b189-e9cc144bd211",
      "metadata": [
        {
          "site_id": "MCO",
          "logistic_type": "remote",
          "item_id": "MCO2753472790",
          "user_id": 798579194,
          "moderation_status": "PUBLISHED"
        }
      ]
    }
  ]
}
```

### Status de moderacao possiveis:
- `PUBLISHED` - Clip ativo e visivel
- `UNDER_REVIEW` - Em moderacao (24-48h)
- `REJECTED` - Rejeitado (com motivos)
- `TRANSCODING_REJECTED` - Erro de processamento
- `PAUSED` - Pausado

### Limitacao conhecida:
A documentacao indica que este endpoint e para **itens CBT (Cross-Border Trade)**. Nao ha documentacao oficial para itens locais (MLB, MLA, MLC, MCO, MLM).

## 3. Hipotese

O endpoint `/marketplace/items/{item_id}/clips` **pode** funcionar tambem com item IDs locais (ex: MLB4217107417), mesmo nao estando documentado para esse caso.

Alternativamente, pode existir um endpoint local: `/items/{item_id}/clips`.

## 4. Endpoint de Debug Criado

### Rota:
```
GET /api/v1/debug/ml/clips/:itemId
```

### O que faz:
1. Usa access_token real da conexao ML do usuario logado (do DB)
2. Testa sequencialmente:
   - `GET https://api.mercadolibre.com/marketplace/items/{itemId}/clips`
   - `GET https://api.mercadolibre.com/items/{itemId}/clips`
3. Captura: status HTTP, body, headers relevantes, tempo de resposta
4. Tambem busca contexto do item (video_id, videos, tags)

### NAO faz:
- NAO altera `has_clips`
- NAO altera persistencia/banco
- NAO altera fluxo de sync
- NAO altera extractor de video
- NAO altera score

### Arquivo:
`apps/api/src/routes/clips-debug.routes.ts`

## 5. Como Testar

### Via curl (com auth do frontend):
```bash
# Substituir $JWT_TOKEN pelo token da sessao do frontend
curl -s "https://<api-url>/api/v1/debug/ml/clips/MLB4217107417" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

# Controle negativo (item SEM clip):
curl -s "https://<api-url>/api/v1/debug/ml/clips/MLB4167251409" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .
```

### Response esperada:
```json
{
  "investigation": "clips-api-probe",
  "itemId": "MLB4217107417",
  "testedAt": "2026-02-25T...",
  "results": [
    {
      "endpointTested": "https://api.mercadolibre.com/marketplace/items/MLB4217107417/clips",
      "status": 200,
      "body": { "..." },
      "headers": { "content-type": "...", "x-ratelimit-remaining": "..." },
      "responseTimeMs": 150
    },
    {
      "endpointTested": "https://api.mercadolibre.com/items/MLB4217107417/clips",
      "status": 404,
      "body": { "..." },
      "headers": {},
      "responseTimeMs": 80,
      "error": "..."
    }
  ],
  "itemContext": {
    "video_id": null,
    "videos": [],
    "tags": ["..."],
    "title": "..."
  },
  "summary": {
    "totalEndpointsTested": 2,
    "anySuccess": true,
    "successfulEndpoints": ["https://api.mercadolibre.com/marketplace/items/MLB4217107417/clips"]
  }
}
```

## 6. Resultados

> **PENDENTE** - Executar os curls acima e documentar resultados aqui.

### Cenario A: Endpoint funciona para MLB
- [ ] `/marketplace/items/{MLB_ID}/clips` retorna 200 com dados de clips
- [ ] Implementar `fetchItemClips()` no sync service
- [ ] Mapear `moderation_status` para tri-state `has_clips`

### Cenario B: Endpoint NAO funciona para MLB
- [ ] Ambos endpoints retornam 404/400/403
- [ ] Confirmar limitacao da API publica
- [ ] Manter `has_clips = null` como default
- [ ] Avaliar override manual como alternativa

## 7. Conclusao

> **PENDENTE** - Sera preenchida apos execucao dos testes.
