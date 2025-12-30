# SuperSeller IA — Project Context (Atualizado)

## Visão Geral
O SuperSeller IA é uma plataforma de inteligência artificial voltada para sellers de marketplaces (inicialmente Mercado Livre), com o objetivo de diagnosticar anúncios, gerar um IA Score e recomendar ações práticas para aumentar visibilidade, conversão e vendas.

O projeto combina:
- Coleta de dados via APIs oficiais (Mercado Livre)
- Persistência estruturada (PostgreSQL)
- Análise por IA (score, diagnóstico e recomendações)
- Interface visual orientada à tomada de decisão do seller

---

## Estado Atual do Projeto (Dez/2025)

### 1. Listings (Cadastro)
- ✅ Títulos e descrições estão sendo corretamente ingeridos
- ✅ Campo `description` validado no banco:
  - 100% dos anúncios com descrição válida (>= 120 caracteres)
- ✅ `pictures_count` confiável
- ✅ Cadastro considerado estável para IA Score

---

### 2. Mídia (Vídeo x Clips)

#### Vídeo
- Campo `has_video` baseado **exclusivamente** em evidência real da API (`video_id`, `videos[]`)
- Para o listing MLB4217107417:
  - `video_id = null`
  - `has_video = false`
- A API **não detecta clips como vídeo**

#### Clips
- Mercado Livre possui “Clips”, **mas eles não são detectáveis via Items API**
- Implementação atual:
  - `has_clips = NULL` → status “não detectável via API”
  - `clips_source` e `clips_checked_at` preparados para futuro
- UI e IA foram ajustadas para:
  - ❌ Nunca afirmar ausência de clips quando `has_clips = NULL`
  - ✔️ Orientar seller a validar no painel do ML

---

### 3. Performance (Ponto mais crítico)

#### Orders e GMV
- ❌ NÃO usar mais `sold_quantity` (lifetime)
- ✅ Orders e GMV 30d agora vêm da **Orders API**
- Persistência:
  - 1 linha agregada por período (`period_days = 30`)
  - `source = ml_orders_period`
- Orders e GMV batem com o painel do Mercado Livre

#### Visitas
- API de visitas não retorna dados via Items API
- Situação atual:
  - `visits = NULL` (unknown) para todos os anúncios
- Importante:
  - `NULL` ≠ `0`
  - Zero só deve ser usado quando for **zero real**

---

### 4. IA Score e Diagnóstico

- IA Score funcional e estável
- Breakdown atual:
  - Cadastro: OK
  - Mídia: penaliza ausência de vídeo real
  - Performance: gargalo principal
- Ajustes feitos:
  - IA **não afirma mais “zero visitas” quando visits = NULL**
  - IA distingue claramente:
    - Vídeo
    - Clips
    - Não detectável via API

---

### 5. Frontend (Estado atual)

#### Funcional
- Modal de IA renderiza score, diagnóstico, SEO e descrição
- Copy de mídia corrigida (vídeo x clips)

#### Bugs conhecidos
1. **IA ainda menciona “visitas zeradas” em alguns fluxos**
   - Indício de `null → 0` em frontend ou payload
2. **Modal reaproveita análise anterior**
   - Ao abrir outro anúncio, mostra análise do anterior
   - Necessário F5 para resetar

---

## Referências Oficiais
- Mercado Livre — Visits API  
  https://developers.mercadolivre.com.br/pt_br/recurso-visits

---

## Status Geral
- ✅ Backend: ingestão de cadastro, mídia e orders estável
- ⚠️ Performance: visitas ainda não ingeridas
- ⚠️ Frontend: bugs de state/cache no modal
- 🚧 Próximo foco: visitas + UX do modal
