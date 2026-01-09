git add -A
git commit -m "fix(ml-url): ajustar botao Abrir no ML para painel de edicao e adicionar logs debug MediaVerdict

- Atualizado buildMercadoLivreListingUrl para suportar mode='edit'|'view' (default 'edit')
- URL de edicao: https://www.mercadolivre.com.br/anuncios/MLB{ID}/modificar/bomni
- Fallback para view se nao houver ID numerico
- ActionPlan usa mode='edit' para botao 'Abrir no ML'
- ActionModal atualizado para receber listingIdExt e marketplace
- Logs de debug adicionados no /ai/analyze/:listingId antes de gerar MediaVerdict:
  - listingId, listingIdExt, marketplace
  - mediaInfo.hasVideo, mediaInfo.hasClips, mediaInfo.picturesCount
  - mediaVerdict result
- Logs tanto para cache miss quanto cache hit

Arquivos modificados:
- apps/api/src/utils/mercadolivre-url.ts
- apps/api/src/routes/ai-analyze.routes.ts
- apps/web/src/lib/mercadolivre-url.ts
- apps/web/src/components/ai/ActionPlan.tsx
- apps/web/src/components/ai/ActionModal.tsx"

