# NEXT SESSION PLAN — Retomada (Validação BD/Logs + Fix Final)

## 🎯 Objetivo da sessão
Fechar definitivamente o bug de “vídeo ausente” (afirmações incorretas) e confirmar o link editável do Mercado Livre.

## ✅ Estado atual (o que já está pronto)
- ONDA 3.2.1 (Hotfix Confiança) implementada:
  - MediaVerdict como fonte única de verdade (backend)
  - ScoreExplanationService / ScoreActionEngine / OpenAIService usando MediaVerdict
  - Frontend renderiza mensagens do verdict sem lógica própria
  - Testes unitários do media-verdict criados
- URL Mercado Livre:
  - buildMercadoLivreListingUrl (backend/frontend) com mode='edit'|'view' (default edit)
  - Botões ActionPlan/ActionModal atualizados
  - Logs de debug adicionados no /ai/analyze/:listingId
- SEO Rule Engine v1 implementada (determinística)
- Documento AI_EVOLUTION_ROADMAP.md criado

## 🧪 Sessão — Checklist de validação (ordem exata)
### 1) Validar banco (Postgres)
- Rodar query no listing do anúncio MLB3923303743:
  - Confirmar has_video (NULL/false/true)
  - Confirmar has_clips
  - Confirmar pictures_count
- Registrar resultado no ML_DATA_AUDIT.md e no DAILY_EXECUTION_LOG.

### 2) Validar logs do endpoint /ai/analyze/:listingId
- Executar análise IA pelo app e capturar 1 execução completa dos logs (cache hit/miss ok):
  - mediaInfo.hasVideo
  - mediaInfo.hasClips
  - mediaInfo.picturesCount
  - mediaVerdict final
- Decidir causa raiz:
  A) DB NULL virou false no mapper
  B) DB false por sync incompleto
  C) API ML não expõe vídeo/clips no endpoint atual

### 3) Aplicar fix final provável (dependendo da causa)
- Se NULL → false:
  - localizar e remover conversões tipo Boolean(x) / !!x
  - preservar boolean | null até MediaVerdict
- Se DB false por sync:
  - revisar onde preenche has_video/has_clips
  - definir linguagem: “não detectável via API; validar no painel”
  - (opcional) adicionar captura de payload bruto para auditoria (mínimo viável)

### 4) Confirmar URL editável do ML no frontend
- Garantir que botões estão gerando:
  https://www.mercadolivre.com.br/anuncios/MLB{NUM}/modificar/bomni
- Confirmar normalização:
  - listingIdExt pode vir como "MLB392..." → extrair NUM
- Fazer grep no web para remover qualquer uso restante de URL view:
  - produto.mercadolivre.com.br

## ✅ DoD da próxima sessão
- Nenhuma tela afirma “não tem vídeo” se o dado for true ou null.
- Se o dado for null, linguagem sempre condicional.
- Botão padrão abre o anúncio EDITÁVEL no painel do vendedor (mode=edit).
- Causa raiz documentada no ML_DATA_AUDIT e fix aplicado com commit.
