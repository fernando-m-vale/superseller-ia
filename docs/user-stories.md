# Super Seller IA — User Stories, RICE & Sprints (MVP)

> Escopo detalhado para execução: user stories com critérios de aceite, priorização RICE, plano de sprints 1–3, jornada do usuário, wireframes conceituais e padrões de repositório no GitHub.

---

## 1) Épicos do MVP
1. **Auth & Onboarding** (signup, login, conectores, checklist)
2. **Conectores** (Shopee, Mercado Livre)
3. **Ingestão & Modelo de Dados** (ETL/ELT, jobs, storage)
4. **Health Score** (cálculo e exibição)
5. **Action Engine** (diagnóstico → recomendações)
6. **Execução assistida** (aprovar/aplicar/registrar impacto)
7. **Relatórios & Alertas** (diário, alertas críticos)
8. **Observabilidade & Telemetria** (eventos, métricas de produto)
9. **UX/Dashboard** (navegação, tabelas, filtros, histórico)

---

## 2) User Stories (com critérios de aceite)
> Formato: *Como [tipo de usuário], quero [objetivo] para [benefício]*.
> Critérios em Gherkin para facilitar QA.

### 2.1 Auth & Onboarding
**US-001 — Signup/Login**  
Como visitante, quero criar conta e logar para acessar o produto.
- **AC**
  - Dado que estou na tela de signup, quando informo e-mail válido e senha forte, então a conta é criada e recebo e-mail de verificação.
  - Dado que validei e-mail, quando faço login, então sou direcionado ao onboarding.
  - Dado erro de credenciais, então recebo mensagem segura (sem revelar qual campo está incorreto).
  - **DoD**: testes unitários; taxa de falha < 0,5%; logs no CloudWatch; fluxo CSRF/OWASP ok.

**US-002 — Conectar marketplace (Wizard)**  
Como seller, quero conectar Shopee/ML via wizard para iniciar coleta de dados.
- **AC**
  - Dado que iniciei o wizard, quando escolho Shopee, então sou redirecionado ao OAuth e voltado com token válido.
  - Dado que conectei, então vejo status "Conectado" e o job de ingestão inicia em até 5 min.
  - Dado token expirado, então recebo aviso e opção de reconectar.
  - **DoD**: tokens criptografados, refresh implementado, auditoria de consentimento.

**US-003 — Checklist de ativação**  
Como seller, quero um checklist para saber o que fazer até a 1ª ação aprovada.
- **AC**
  - Dado que conectei um marketplace, então a etapa é marcada como concluída.
  - Dado que aprovei minha 1ª ação, então ganho selo "Ativado".
  - **DoD**: eventos de telemetria para cada item do checklist.

### 2.2 Conectores
**US-010 — Shopee OAuth + Coleta**  
Como sistema, quero obter anúncios, métricas e estoque da Shopee diariamente.
- **AC**
  - Dado credenciais válidas, quando o job roda, então coleta últimos 30 dias de métricas (impressões, cliques, visitas, conversão, pedidos, preço, estoque, status).
  - Dado erro de API rate limit, então job reprograma com backoff e alerta silencioso.
  - **DoD**: mapeamento de campos documentado, reprocess idempotente.

**US-011 — Mercado Livre OAuth + Coleta**  
Como sistema, quero obter anúncios e métricas do ML diariamente.
- **AC**
  - Idêntico ao acima, adaptado ao ML (incluindo atributos obrigatórios e reputação do seller quando disponível).
  - **DoD**: testes com sandbox ML; contrato de schema versionado.

### 2.3 Ingestão & Modelo de Dados
**US-020 — Data Lake + Jobs**  
Como time, quero armazenar dados brutos em S3 e normalizar em Postgres.
- **AC**
  - Dado que recebo payloads, então são salvos em S3 por cliente/marketplace/dia.
  - Dado job ETL, então as tabelas normalizadas são atualizadas com deduplicação por chave natural.
  - **DoD**: catálogo de dados; partições por data; custo monitorado.

**US-021 — Schema Operacional**  
Como sistema, quero um schema relacional para anúncios, métricas diárias, ações e resultados.
- **AC**
  - Dado consultas no dashboard, então respondem < 300ms p/ filtros padrão.
  - **DoD**: índices críticos; migrations versionadas.

### 2.4 Health Score
**US-030 — Cálculo v1**  
Como seller, quero ver um score 0–100 por anúncio e loja.
- **AC**
  - Dado métricas disponíveis, então score é calculado ponderando CTR, conversão, preço competitivo, atributos, imagem de capa, estoque, reputação (quando disponível).
  - Dado score < 40, então anúncio aparece em "Críticos".
  - **DoD**: fórmula e pesos documentados; recomput diário; testes.

**US-031 — Exibição de Scores**  
Como seller, quero ver scores com cores e ordenação.
- **AC**
  - Verde ≥ 80, Laranja 40–79, Vermelho < 40.
  - Ordenar por score asc/desc, por impacto potencial.
  - **DoD**: paginação e filtros; acessibilidade.

### 2.5 Action Engine
**US-040 — Recomendações (título)**  
Como seller, quero sugestões de melhoria de título com termos obrigatórios e limites por canal.
- **AC**
  - Dado anúncio com CTR baixo, então são sugeridas 2–3 alternativas de título justificadas.
  - Respeita limites de caracteres por marketplace.
  - **DoD**: testes de regra; logging de decisão.

**US-041 — Recomendações (imagem de capa)**  
Como seller, quero auditoria da capa e checklist para adequar às diretrizes.
- **AC**
  - Dado capa não conforme (fundo, texto, contraste), então recebo alertas específicos e mock de composição sugerida.
  - **DoD**: checklist por marketplace documentado.

**US-042 — Recomendações (atributos)**  
Como seller, quero saber atributos faltantes/errados.
- **AC**
  - Lista campos críticos com exemplos de preenchimento.
  - **DoD**: mapeamento por categoria.

**US-043 — Recomendações (preço simples)**  
Como seller, quero recomendação de faixa competitiva baseada em histórico + margem alvo.
- **AC**
  - Dado preço fora da faixa, sistema sugere ajuste percentual.
  - **DoD**: não altera preço sem aprovação.

**US-044 — Alertas de estoque**  
Como seller, quero alerta de ruptura iminente.
- **AC**
  - Dado média de giro e estoque atual, então avisa antes da ruptura.
  - **DoD**: cálculo simples (dias de cobertura).

### 2.6 Execução assistida
**US-050 — Aprovação e Aplicação**  
Como seller, quero aprovar e aplicar ações com 1 clique.
- **AC**
  - Dado ação aprovada, então o sistema aplica via API (quando possível) e registra status.
  - Dado API sem permissão, então exibe "copiar" e tutorial rápido.
  - **DoD**: histórico imutável de ações.

**US-051 — Medir impacto (uplift)**  
Como seller, quero ver o efeito pós-ação em CTR/Conversão.
- **AC**
  - Dado janela de 7–14 dias, mostra variação pré vs pós, com anotação por ação.
  - **DoD**: guardar timestamps e baseline.

### 2.7 Relatórios & Alertas
**US-060 — Relatório diário/weekly**  
Como seller, quero receber um resumo com top ganhos e pendências.
- **AC**
  - Email diário opcional e semanal automático.
  - **DoD**: opt-in/out; throttle para não spam.

**US-061 — Alertas críticos**  
Como seller, quero alertas de queda abrupta de CTR/Conversão.
- **AC**
  - Detecta variação acima de limiar e notifica.
  - **DoD**: limites configuráveis (global).

### 2.8 Observabilidade & Telemetria
**US-070 — Eventos de produto**  
Como time, quero eventos (conectar, executar, aprovar, etc.) para métricas.
- **AC**
  - Exporta para um data store de analytics.
  - **DoD**: dicionário de eventos.

### 2.9 UX/Dashboard
**US-080 — Dashboard geral**  
Como seller, quero visão geral com saúde da loja, KPIs e fila de ações.
- **AC**
  - Renderiza em < 1s para base de até 2k SKUs.
  - **DoD**: responsivo; empty states.

**US-081 — Lista de anúncios**  
Como seller, quero tabela com filtros, ordenação e paginação.
- **AC**
  - Pesquisar por título/ID/marketplace.
  - **DoD**: export CSV básico.

---

## 3) Prioridade com RICE (v1)
> Escala: **Reach** (usuários/mês), **Impact** (3 alto / 2 médio / 1 baixo / 0.5 mínimo), **Confidence** (%), **Effort** (pontos ou pessoas-semana).  
> **Score = (R × I × C) / E**.

| ID | Feature | R | I | C | E | Score | Ordem |
|---|---|---:|---:|---:|---:|---:|---:|
| US-010 | Shopee OAuth + Coleta | 100 | 3 | 0.8 | 4 | 60.0 | 1 |
| US-020 | Data Lake + Jobs | 100 | 2 | 0.8 | 3 | 53.3 | 2 |
| US-021 | Schema Operacional | 100 | 2 | 0.9 | 3 | 60.0 | 1–2 |
| US-030 | Health Score v1 | 100 | 2 | 0.7 | 3 | 46.7 | 3 |
| US-040 | Recs Título | 100 | 2 | 0.7 | 4 | 35.0 | 4 |
| US-050 | Aprovar/Aplicar | 100 | 2 | 0.7 | 4 | 35.0 | 4–5 |
| US-060 | Relatório diário | 100 | 1.5 | 0.8 | 3 | 40.0 | 3–4 |
| US-011 | ML OAuth + Coleta | 70 | 2 | 0.7 | 5 | 19.6 | 6 |
| US-041 | Recs Imagem Capa | 80 | 1.5 | 0.6 | 4 | 18.0 | 6–7 |
| US-042 | Recs Atributos | 80 | 1.5 | 0.7 | 3 | 28.0 | 5 |
| US-043 | Recs Preço simples | 80 | 1.5 | 0.6 | 3 | 24.0 | 5–6 |
| US-044 | Alerta Estoque | 60 | 1.5 | 0.8 | 2 | 36.0 | 4–5 |
| US-051 | Medir impacto | 100 | 1.5 | 0.6 | 3 | 30.0 | 5 |
| US-002 | Wizard Conexão | 100 | 1.5 | 0.8 | 2 | 60.0 | 1 |
| US-003 | Checklist Ativação | 100 | 1.2 | 0.8 | 2 | 48.0 | 3 |
| US-070 | Telemetria Produto | 100 | 1.2 | 0.8 | 2 | 48.0 | 3 |
| US-080 | Dashboard | 100 | 1.5 | 0.8 | 3 | 40.0 | 3–4 |
| US-081 | Lista de anúncios | 100 | 1.2 | 0.9 | 2 | 54.0 | 2–3 |

> Observação: RICE ajustado para **primeiro valor em 2–4 semanas** e viabilizar **Ação executada** ainda no MVP.

---

## 4) Sprints (duas semanas cada)
**Capacidade base:** 20–24 pts/sprint (time enxuto)  
**Critério de pronto:** DoD + revisão + deploy + documentação mínima.

### Sprint 1 — Fundacional (Semana 1–2)
**Objetivo:** dados chegando + UI básica + caminho para 1º score.
- US-001 Signup/Login
- US-002 Wizard conexão
- US-010 Shopee OAuth + Coleta
- US-020 Data Lake + Jobs
- US-021 Schema Operacional
- US-081 Lista de anúncios (tabela simples)
- Telemetria inicial (US-070 parcial)
**Risco:** quotas de API; **Mitigação:** sandbox + backoff.
**Saída:** dados dos últimos 30 dias carregados; lista de anúncios visível.

### Sprint 2 — Score & Recomendações (Semana 3–4)
**Objetivo:** gerar score e primeiras ações úteis.
- US-030 Health Score v1
- US-040 Recs Título
- US-042 Recs Atributos
- US-060 Relatório diário (mínimo viável)
- US-080 Dashboard (cards principais)
**Saída:** primeiros scores e fila de ações priorizadas.

### Sprint 3 — Execução & Impacto (Semana 5–6)
**Objetivo:** aprovar/aplicar e medir impacto.
- US-050 Aprovação e aplicação
- US-051 Medir impacto (uplift)
- US-044 Alerta de estoque
- US-043 Recs Preço simples
- US-003 Checklist de ativação
**Saída:** 1ª ação aplicada fim-a-fim + registro de uplift.

> Pós-MVP (Sprint 4+): Mercado Livre (US-011), Recs Imagem (US-041), melhorias de UX, alertas críticos (US-061).

---

## 5) Jornada do usuário (Primeira semana)
1. **Landing → Signup**
2. **Login → Wizard** (conectar Shopee)
3. **Checklist** (aguarda ingestão ~5 min)
4. **Dashboard** (scores iniciais)
5. **Action Queue** (títulos/atributos top 5)
6. **Aprovar & Aplicar** (1 clique)
7. **Relatório diário** (resultado + pendências)
8. **Badge Ativado** (gamificação)

*Métricas de sucesso*: tempo até 1ª ação, nº de ações aprovadas em 7 dias, ΔCTR em 14 dias.

---

## 6) Wireframes conceituais (ASCII)
**6.1 Dashboard**
```
+--------------------------------------------------------------+
|  Saúde da Loja: 72/100  |  Anúncios: 1.243  |  Marketplace: Shopee |
+-------------------+-----------------+---------------------------+
|  KPIs             |  Top Ações      |  Alertas                 |
|  CTR: 1,8% (↑0,2) |  [Ajustar título - 12 SKUs]  Impacto: Alto   |
|  CVR: 1,4% (↔)    |  [Completar atributos - 9]   Impacto: Médio  |
|  GMV: R$ 87k      |  [Faixa de preço - 6]        Impacto: Médio  |
+-------------------+---------------------------------------------+
```

**6.2 Lista de Anúncios**
```
[ Filtros ]  Marketplace [Shopee]  Score [<=40]  Categoria [Moda]
+----+ Score + Título                                   + Vis + CVR +
|ID  |  38   | Kit 3 Cuecas Boxer Infantil ...          | 1.2k| 1.1% |
|... |  82   | Sunga Infantil ...                       | 4.7k| 2.0% |
```

**6.3 Ação — Título**
```
Anúncio: Kit 3 Cuecas Boxer Infantil  [Score: 38]
Recomendação:
1) "Cueca Boxer Infantil c/ Algodão Macio — Kit 3 Estampas"
2) "Kit 3 Cuecas Boxer Menino — Conforto, Estampas, Tecido Macio"
Justificativa: baixa presença de termos-chave e ordem subótima.
[ Aprovar e aplicar ]  [ Rejeitar ]
```

**6.4 Aprovação & Aplicação (Modal)**
```
Você confirma aplicar o novo título no Shopee?
[ Confirmar ]  [ Cancelar ]
```

**6.5 Relatório Diário (e-mail)**
```
Assunto: Resultados de hoje — 3 ações aplicadas, +0,3pp em CTR
- 2 títulos ajustados, 1 atributo completo
- 5 pendências com alto impacto
```

---

## 7) GitHub — Padrões e Projeto
**7.1 Estrutura de repositório (monorepo simplificado)**
```
/superseller
  /apps
    /web (Next.js)
    /api (Node/Python, FastAPI/Express)
  /packages
    /ui (design system)
    /connectors (Shopee, ML)
    /core (health-score, action-engine)
  /infra
    /terraform (IaC)
    /pipelines (ETL jobs, Airflow/AWS Step Functions)
  /docs
    ADRs, arquitetura, guias
```

**7.2 Branching & PRs**
- **Trunk-based**: `main` + feature branches curtas
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`
- **PR Template**: objetivo, escopo, testes, riscos, checklist de segurança
- **CODEOWNERS**: revisão obrigatória em áreas críticas

**7.3 Issues & Project Board**
- Labels: `epic`, `story`, `bug`, `infra`, `security`, `good-first-issue`
- Board (Kanban): **Backlog → Ready → In Progress → Review → Done**
- Link direto com Sprints e milestones

**7.4 CI/CD (GitHub Actions)**
- Pipelines: Lint + Test + Build + Deploy (preview)
- Scans: SAST/Dependabot
- Secrets: GitHub Environments + AWS OIDC (sem long-lived keys)

**7.5 Templates**
- **Issue template (Story)**: *como, quero, para* + AC + DoD
- **Bug template**: passos, esperado vs obtido, logs
- **PR template**: checklist de testes, segurança, migrações

---

## 8) Riscos & Mitigações (MVP)
- **APIs instáveis/quota** → backoff, cache, retries, circuit breaker
- **Dados faltantes** → empty states claros, recomendações degradadas
- **Adoção baixa** → checklist de ativação, primeira ação em 48h
- **Tempo de valor** → priorizar recomendações de alto impacto (título/atributos)

---

## 9) Próximos Passos
- Abrir issues no GitHub com as user stories (tags + milestone Sprint 1)
- Criar PR templates e CODEOWNERS
- Configurar Actions (lint/test/build) e ambientes
- Preparar wireframes hi‑fi após feedback dos founders

