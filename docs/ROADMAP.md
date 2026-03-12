# ROADMAP — SuperSeller IA
Atualizado em: 2026-03-11

Este é o roadmap **ativo** do projeto (referência para as próximas sessões).

---

## Estado atual

- **Dias 11, 12 e 13:** ✅ CONCLUÍDOS (validados em produção — 21/21 testes PASS, tenant RB Store)
- **Dia 14 — Refinamento da IA:** 🚀 EM ANDAMENTO / PRÓXIMO FOCO

---

## DIA 10 — UX Premium ✅ CONCLUÍDO

**Objetivo:** Produto parecer profissional em 2 minutos. **Status:** CONCLUÍDO.

---

## DIA 11 — Data Layer + Jobs Automáticos ✅ CONCLUÍDO

**Objetivo:** Persistir o máximo possível de dados da API do Mercado Livre para alimentar a IA.

**Implementado e validado:** sync automático de visitas, pedidos, promoções e preço; dataFreshness no analyze; estruturação de logística real e atributos comerciais; semântica de preço/promo; reputação/prova social; histórico de conteúdo/mídia. Validação: listings sincronizando, métricas persistidas, freshness e snapshots funcionando.

---

## DIA 12 — IA Visual (MVP) ✅ CONCLUÍDO

**Objetivo:** Análise da imagem principal do anúncio.

**Implementado e validado:** pipeline completo (VisualAssetResolver, VisualSignalsBuilder, VisualAnalysisLLMService, Normalizer, Repository, Orchestrator); tabela de análise visual; cache por image_hash + prompt_version; score visual, critérios e melhorias; card no frontend; persistência e cache em produção.

---

## DIA 13 — Ads Intelligence ✅ CONCLUÍDO

**Objetivo:** Analisar campanhas de anúncios patrocinados.

**Implementado e validado:** fundação de Ads Intelligence; Mercado Ads real; advertiser discovery; Product Ads com OAuth; associação item_id/listing_id; ingestão em listing_ads_metrics_daily; bloco adsIntelligence no analyze; card no frontend; status available/partial/unavailable.

---

## DIA 14 — Refinamento da IA 🚀 EM ANDAMENTO

**Objetivo:** Com os novos sinais já disponíveis (imagem, ads, dados comerciais, atributos, reputação), melhorar a inteligência do sistema para:

- Encontrar **causa raiz principal** do problema do anúncio
- Elevar a **qualidade da consultoria**
- **Priorizar ações** com confiança
- **Reduzir recomendações genéricas**

**Foco:** correlação de sinais, root cause engine, confidence score, prioridade principal de ação. Não é sobre novas integrações grandes nem execução automática. Ver `docs/DIA14_REFINEMENT_CONTEXT.md`.

---

## DIA 15 — Onboarding inteligente

**Fluxo ideal:** login → conectar Mercado Livre → escolher anúncio → primeira vitória.

---

## DIA 16 — Landing comercial

**Objetivo:** Página pública com proposta de valor, planos e lista de espera.

---

## DIA 17–19 — Execução real via API

**Objetivo:** Aplicar mudanças no anúncio (título, descrição, preço) via API, com confirmação, log e rollback.
