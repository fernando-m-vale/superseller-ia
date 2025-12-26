# Next Session Plan — Retomada Guiada (has_video + Modal IA)
Data base: 26/12/2025  
Projeto: SuperSeller IA  
Objetivo da sessão: **Fechar definitivamente o problema do `has_video` e validar o fluxo completo do modal de IA com dados reais.**

---

## 🎯 Objetivos claros da sessão
1. Determinar **com certeza** se a API do Mercado Livre retorna (ou não) evidência de vídeo via OAuth.
2. Resolver definitivamente o campo `has_video`:
   - Corrigir sync **OU**
   - Ajustar modelo/score se o dado não existir na API.
3. Validar o **modal de IA end-to-end**, garantindo:
   - Score correto
   - Diagnóstico coerente
   - Hacks não genéricos
   - UX fluída e clara

---

## ⏱️ Checklist — 30 minutos (diagnóstico rápido)

### ✅ 1. Confirmar token OAuth do Mercado Livre
- [ ] Executar SQL para obter `access_token` do ML (sem logar/expor):
```sql
SELECT access_token
FROM marketplace_connections
WHERE tenant_id = '<TENANT_ID>'
  AND type = 'mercadolivre'
ORDER BY updated_at DESC
LIMIT 1;


✅ 2. Testar item com vídeo via API autenticada

Item conhecido com vídeo na UI:

MLB4217107417

PowerShell:

$mlAccessToken = "<ACCESS_TOKEN_DO_ML>"
$itemId = "MLB4217107417"

Invoke-RestMethod -Method Get `
  -Uri "https://api.mercadolibre.com/items/$itemId" `
  -Headers @{
    Authorization = "Bearer $mlAccessToken"
    "User-Agent"  = "SuperSellerIA/1.0"
  }


✅ 3. Verificar evidência de vídeo no JSON

Procurar:

video_id

videos

keys contendo "video"

attributes ou tags relacionadas a vídeo

Resultado esperado:

 Evidência encontrada
OU

 Nenhuma evidência retornada pela API

➡️ Decisão técnica imediata:

Se não existe no payload, has_video não pode ser tratado como dado confiável.

⏱️ Checklist — 60 minutos (decisão + correção)
🅰️ Cenário A — API retorna evidência de vídeo

Ação:

 Ajustar extractHasVideoFromMlItem() para mapear exatamente o campo correto

 Reexecutar:

 POST /api/v1/sync/mercadolivre/listings?limit=50

Validar no banco:

SELECT COUNT(*) total,
       SUM(CASE WHEN has_video THEN 1 ELSE 0 END) with_video
FROM listings
WHERE tenant_id = '<TENANT_ID>'
  AND marketplace = 'mercadolivre';


Critério de aceite: with_video > 0

🅱️ Cenário B — API NÃO retorna evidência de vídeo

Decisão de produto (recomendada):

 Marcar has_video como unknown / não confiável

 Ajustar IA Score Model:

Remover penalização por vídeo ausente

Não mencionar “sem vídeo” no diagnóstico

 Atualizar documentação:

ML_SYNC_FIELDS.md

IA_SCORE_MODEL.md

📌 Importante:
UI do Mercado Livre ≠ API do Mercado Livre.
Se não vem via API, não pode ser usado como critério automático.

⏱️ Checklist — 120 minutos (validação end-to-end)
✅ 1. Validar banco (pré-UI)

 Listing com:

pictures_count > 0

description não vazia

métricas em listing_metrics_daily

 Score calculando corretamente:

 GET /api/v1/ai/score/:listingId

✅ 2. Validar modal no app (UX real)

Fluxo:

Login

Listagens

Abrir anúncio validado

Aba Inteligência Artificial

Verificar:

 Score total coerente

 Breakdown por dimensão correto

 Gargalo destacado faz sentido

 Diagnóstico NÃO genérico

 IA não diz:

“sem fotos” se pictures_count > 0

“sem vendas” se orders_30d > 0

“sem descrição” se description existe

 Hacks são acionáveis (não óbvios)

 Sugestão de título usa contexto real

 Sugestão de descrição não é só keyword stuffing

✅ 3. Teste de falha controlada

 Remover accessToken do browser

 Abrir anúncio

 Esperado:

Redirect para login

Mensagem clara

Sem crash

🧠 Resultado esperado ao final da sessão

has_video: resolvido ou conscientemente descartado

IA baseada somente em dados confiáveis

Modal validado como:

funcional

coerente

gerador de valor real

Pronto para avançar para:

Benchmark por categoria

IA vs Concorrentes

Ads (ROAS-driven)

🚀 Próximo passo após fechar esta sessão

Escolher o próximo foco:

A) Benchmark por categoria (impacto imediato de valor)

B) IA vs Concorrentes (diferencial forte)

C) IA para Ads (monetização direta)

