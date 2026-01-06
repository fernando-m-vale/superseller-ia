# SuperSeller IA — Project Context (Atualizado)

## Visão Geral
O SuperSeller IA é uma plataforma de inteligência artificial para sellers de marketplaces (inicialmente Mercado Livre), focada em diagnóstico de anúncios, score de qualidade e recomendações acionáveis para aumento de vendas.

O projeto foi desenhado para operar **com dados reais**, respeitando **as limitações efetivas das APIs oficiais**.

---

## Estado Atual do Projeto (Jan/2026)

### 1. Conexão com Mercado Livre
- OAuth funcional
- Tokens válidos e renovados automaticamente
- Seller real validado via `/users/me`
- Ambiente único (PROD) usado como DEV/HOMOL/PROD

---

### 2. Ingestão de Listings (Decisão Estrutural)

#### Situação real
- APIs de discovery (`search`, `user items`) retornam 403 (PolicyAgent)
- Bloqueio ocorre mesmo em produção, com seller real

#### Decisão oficial
- **Orders API é a fonte de descoberta de listings**
- Listings são inferidos a partir de vendas reais
- Details sempre via `/items/{id}`

Essa decisão é **canônica** e documentada no `ML_DATA_AUDIT.md`.

---

### 3. Mídia (Fotos, Vídeo, Clips)

- Fotos: confiáveis via Items API
- Vídeo: detectável apenas quando `video_id` existe
- Clips:
  - Não detectáveis via API
  - Representados como `NULL`
  - UI e IA nunca afirmam ausência sem evidência

---

### 4. Performance

#### Orders / GMV
- Derivados exclusivamente da Orders API
- Janela móvel (30d / 60d)
- Dados confiáveis e auditáveis

#### Visits
- Única fonte válida: Visits API
- Persistidas em `listing_metrics_daily`
- `NULL` preservado quando indisponível

---

### 5. IA Score

- Baseado apenas em dados reais
- Penalizações ocorrem somente quando há evidência
- IA distingue claramente:
  - Dado ausente
  - Dado zero
  - Dado bloqueado por API

---

### 6. Frontend

- Dashboard orientado a decisão
- Estados explícitos:
  - Carregando dados
  - Dados parciais
  - Dados completos
- Bugs conhecidos:
  - Reset de state no modal (em correção)

---

## Prioridade Atual
**PRIORIDADE ZERO — ML Data Audit**

Nada avança para monetização, benchmark ou UX avançado até:
- Pipeline de dados estar sólido
- Ingestão real funcionando em PROD
- Sistema resiliente às limitações do ML

---

## Status Geral
- Backend: sólido e alinhado à realidade
- Integrações ML: funcionais com fallback
- Produto: pronto para fechar a base de dados
