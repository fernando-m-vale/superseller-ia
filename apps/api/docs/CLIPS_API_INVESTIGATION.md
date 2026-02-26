# Investigação Oficial — API de Clips do Mercado Livre

**Data:** 2026-02-25  
**Status:** ✅ CONCLUÍDO — Clips não são detectáveis via API pública para MLB

## Contexto

Após ciclo de estabilização (HOTFIX 09.9 → 09.13), identificamos que `has_clips` retornava `false` para listings que deveriam ter clips. Investigação oficial foi realizada para determinar se a API do Mercado Livre expõe informações sobre Clips.

## Endpoints Testados

### 1. `/items/{id}/clips`
- **Resultado:** `404 Not Found`
- **Conclusão:** Endpoint não existe na API pública do ML

### 2. `/marketplace/items/{id}/clips`
- **Resultado:** `403 Forbidden` (PolicyAgent)
- **Conclusão:** Endpoint existe mas requer permissões especiais não disponíveis na API pública

**Nota:** A documentação oficial encontrada (https://global-selling.mercadolibre.com/devsite/working-with-clips) indica que este endpoint é para **itens CBT (Cross-Border Trade)**, não para itens locais (MLB, MLA, MLC, MCO, MLM).

## Decisão Arquitetural

**Clips não são detectáveis via API pública do Mercado Livre para anúncios MLB.**

### Implicações

1. **`has_clips` deve ser `NULL` por padrão** para todos os listings MLB
2. **Não setar `false` automaticamente** se não detectável
3. **Não inferir `has_clips` baseado em `video_id`** (são coisas diferentes)
4. **Override manual** via endpoint `PATCH /api/v1/listings/:id/clips` é necessário

## Separação Semântica

### `has_video` (vídeo tradicional)
- **Fonte:** `video_id` ou `videos[]` do payload `/items/{id}`
- **Detectável:** ✅ Sim, via API pública
- **Uso:** Vídeo tradicional do Mercado Livre

### `has_clips` (Clips ML)
- **Fonte:** Não disponível via API pública
- **Detectável:** ❌ Não, requer override manual
- **Uso:** Clips curtos verticais do Mercado Livre
- **Valor padrão:** `NULL` (não detectável)

## Implementação

### Regra de Persistência

```typescript
// Para MLB, has_clips sempre NULL por padrão
if (existing) {
  // Se já existe e não é override, não atualizar
  listingData.has_clips = undefined;
} else {
  // Criação: sempre NULL
  listingData.has_clips = null;
  listingData.clips_source = 'unknown';
}

// Se tem override manual, não tocar
if (existingClipsSource === 'override') {
  listingData.has_clips = undefined; // Mantém override
}
```

### Override Manual

**Endpoint:** `PATCH /api/v1/listings/:id/clips`

**Body:**
```json
{
  "value": true | false | null
}
```

**Comportamento:**
- `value: true` → `has_clips = true`, `clips_source = "override"`
- `value: false` → `has_clips = false`, `clips_source = "override"`
- `value: null` → `has_clips = null`, `clips_source = "unknown"` (remove override)

### Score e Penalização

- **`has_clips === true`:** Não penaliza, adiciona 10 pontos no score de mídia
- **`has_clips === false`:** Penaliza, mostra ganho potencial de +10 pontos
- **`has_clips === null`:** **NÃO penaliza**, mostra mensagem de limitação da API

### MediaVerdict

Quando `has_clips === null`:
- `canSuggestClip = false` (não sugerir)
- `message = "Clips não são detectáveis via API pública do Mercado Livre. Valide manualmente no painel do ML."`

## Próximos Passos

1. ✅ Implementação concluída
2. ⏳ Validação em PROD
3. 🔮 Considerar endpoint alternativo no futuro (se ML disponibilizar)

## Referências

- `apps/api/src/services/MercadoLivreSyncService.ts` — Lógica de persistência
- `apps/api/src/routes/listings.ts` — Endpoint de override
- `apps/api/src/services/IAScoreService.ts` — Cálculo de score
- `apps/api/src/utils/media-verdict.ts` — Verdict de mídia
