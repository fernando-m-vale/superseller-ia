# DAILY EXECUTION LOG — 2026-01-09

## 🎯 Foco do dia
- Consolidar confiabilidade da dimensão Mídia (Hotfix Confiança 3.2.1)
- Implementar base de SEO determinístico (SEO Rule Engine v1)
- Ajustar link do Mercado Livre para abrir edição no painel do vendedor

## ✅ Planejado
- [x] ONDA 3.2.1 — Hotfix Confiança: Fonte única de verdade para vídeo/clips
- [x] Adicionar logs de debug em /ai/analyze/:listingId para validar origem do hasVideo
- [x] Ajustar buildMercadoLivreListingUrl para suportar modo edit/view
- [x] Implementar SEO Rule Engine v1 (determinístico, sem LLM)
- [x] Criar documento AI Evolution Roadmap (3 fases)

## 🧠 Descobertas
- Build ficou verde, porém em testes manuais ainda há textos afirmando “não tem vídeo” em pontos diversos.
- Suspeita principal: dado incorreto na origem (DB/sync/mapper) ou conversão indevida de NULL → false antes do MediaVerdict.
- No banco (tabela listings), existem colunas: has_video (boolean), has_clips (boolean), pictures_count (int), etc.
- Para o anúncio MLB3923303743:
  - listing_id_ext armazenado como "MLB3923303743"
  - pictures_count = 20 (ok)
  - has_clips = NULL
  - has_video aparece “vazio” na UI do client SQL (provável NULL)
- Não existe tabela listing_snapshots no schema atual; não há snapshot/payload bruto para auditoria.

## ⚠️ Bloqueios / riscos
- Sem validar logs do /ai/analyze, não dá para afirmar se o problema é:
  1) DB tem has_video NULL e algum mapper converte para false
  2) DB tem has_video false por falha de sync (API não retorna vídeo/clips)
- Falta confirmação se o botão "Abrir no ML" está abrindo o modo editável de fato:
  - risco: fallback para view caso listingIdExt não seja numérico (ex.: "MLB392..." precisa normalizar)

## 📌 Decisões tomadas
- “Mídia” deve ter fonte única de verdade: MediaVerdict (backend), e frontend apenas renderiza.
- Link padrão do ML deve ser EDIT (painel do vendedor), com fallback VIEW apenas quando ID inválido.
- Próximo passo obrigatório: validar BD e logs para fechar fix final sem chute.

## ➡️ Próximo passo claro
1) Rodar query no Postgres para confirmar valor real de has_video (NULL/false/true) do listing.
2) Capturar logs do endpoint /ai/analyze/:listingId com:
   - mediaInfo.hasVideo, mediaInfo.hasClips, mediaInfo.picturesCount
   - mediaVerdict result
3) Aplicar fix final provável:
   - Se NULL → false: corrigir mapper/conversão
   - Se DB false: corrigir sync/detecção de vídeo/clips ou ajustar linguagem para “não detectável via API”
4) Confirmar link EDIT do ML:
   - Normalizar listingIdExt "MLB..." → extrair números para construir URL editável
