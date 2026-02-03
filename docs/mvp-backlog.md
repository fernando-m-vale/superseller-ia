# Super Seller IA — Backlog Funcional e Visão de MVP
Super Seller IA — Backlog Funcional e Visão de MVP (Atualizado)

Versão atualizada pós-implantação da IA e Estabilização de Infra.

🎯 Visão do MVP (Status Real)

Plataforma que conecta Mercado Livre (Shopee em breve), coleta dados, gera Super Seller Score e usa IA Generativa para sugerir otimizações.

Meta de sucesso MVP:

[x] Conexão estável com Mercado Livre (Auto-refresh)

[x] Dashboard com dados financeiros reais

[x] IA gerando diagnósticos automáticos

[ ] Conexão Shopee (Pendente)

[ ] Gateway de Pagamento (Pendente)

⚙️ Status do Escopo

1) Conectores (APIs)

[ ] Shopee — Autenticação + dados (Prioridade Alta)

[x] Mercado Livre — Autenticação + Sync de 30 dias + Webhooks

2) Health Score & IA

[x] Super Seller Score: Algoritmo proprietário (0-100) implementado.

[x] Action Queue: Lista de recomendações baseada em regras.

[x] Generative AI: Integração OpenAI para análise de SEO e Hacks.

3) Dashboard & UX

[x] Visão Geral: GMV, Pedidos, Ticket Médio.

[x] Listagem: Filtros avançados, paginação e Sheet de detalhes.

[x] Alertas: Notificação visual de token expirado.

📌 Backlog Restante (Rumo ao V1)

Prioridade 1: Monetização

[ ] Página de Planos (Starter/Pro).

[ ] Integração Stripe/Asaas.

[ ] Bloqueio de features (Paywall na IA).

Prioridade 2: Multi-Canal

[ ] OAuth Shopee.

[ ] Sync de Pedidos Shopee.

[ ] Unificação do Dashboard (ML + Shopee).

Prioridade 3: Automação

[ ] Botão "Aplicar Sugestão da IA" (Escrever no ML via API).

[ ] Edição em massa de preços.

🛠️ Tecnologia Atual

Front: Next.js 14 + Shadcn UI

Backend: Node.js (Fastify)

Infra: AWS App Runner + RDS

AI: OpenAI GPT-4o

Deploy: Terraform + GitHub Actions




> Versão inicial — foco em MVP enxuto, escalável e validado com sellers founders (early adopters).

---

## 🎯 Visão do MVP
Criar uma plataforma que:
- Conecta Shopee e Mercado Livre
- Coleta dados críticos do seller e anúncios
- Gera **Health Score** por anúncio e loja
- Sugere **ações priorizadas** (Action Queue)
- Permite **aprovação e execução assistida** das ações
- Envia **Relatório diário/weekly** com resultados e impacto

**Objetivo MVP:** provar que a IA consegue gerar ações que aumentam CTR, conversão e receita.

**Meta de sucesso MVP:**
- +15% CTR em 30 dias
- +10% conversão em 60 dias
- 70% sellers founders ativos após 30 dias
- 80% das ações sugeridas são aceitas

---

## ⚙️ Escopo do MVP
### 1) Conectores (APIs)
**Obrigatório no MVP:**
- Shopee — Autenticação + dados de anúncios e métricas
- Mercado Livre — Autenticação + dados de anúncios e métricas

**Dados mínimos a coletar:**
- Impressões
- CTR
- Cliques
- Visitas
- Conversão
- Vendas / pedidos
- Ticket médio
- Status do anúncio
- Estoque
- Histórico de preço
- Termos/buscas (quando disponível)
- Taxas / reputação do seller

---

### 2) Health Score
**Saídas do modelo:**
- Score 0–100 por anúncio
- Score geral da loja
- Classificação:
  - 🔴 crítico
  - 🟠 atenção
  - 🟢 saudável

**Fatores:**
- CTR
- Conversão
- Qualidade do título
- Qualidade da imagem de capa
- Preço competitivo
- Estoque / ruptura
- Atributos preenchidos
- Reputação do vendedor
- Frete / SLA

---

### 3) Action Queue (Motor de Recomendações)
**Tipos de ações MVP:**
- Título (melhorias + palavras-chave obrigatórias)
- Imagem de capa (auditoria e sugestão gerada por IA)
- Atributos obrigatórios/sugeridos
- Preço: ajuste com regra simples (faixa competitiva)
- Estoque: alerta e recomendação de reposição
- Revisão e resposta a perguntas

**Cada ação deve ter:**
- Impacto esperado (📈)
- Esforço (⚙️)
- Prioridade (score)
- Justificativa clara
- Botão "Aprovar e aplicar"
- Medição pós-execução (uplift)

---

### 4) Execução assistida (Human-in-the-loop)
- IA sugere
- Usuário aprova
- Sistema aplica via API ou dá instrução manual se API não permitir

**Exemplo:**
> ✅ Novo título aprovado — aplicar no ML

Caso API não permita:
> 📋 Copiar com 1 clique + guia de aplicação

---

### 5) Relatórios e Alertas
- Relatório diário de performance
- Ranking dos anúncios com maior impacto potencial
- Alertas críticos:
  - Estoque baixo
  - Queda de CTR
  - Queda conversão
  - Aumento competição

Entrega via:
- Email
- WhatsApp (fase 2 opcional)

---

### 6) UX / Interface MVP
- Dashboard visão geral
- Lista de anúncios
- Filtro por categoria / marketplace
- Scores e prioridades
- Tela de ação
- Histórico de ações executadas
- Gráfico simples de evolução CTR/Conversão

---

### 7) Gamificação inicial
- Barra de "saúde da loja"
- Checklist de início rápido
- Selo Founder no perfil

---

## 🛑 Fora do escopo MVP (planejar V1)
- Testes A/B nativos
- Otimização automática de Ads
- Pricing dinâmico avançado
- Integração Amazon / Magalu
- API pública
- Multi-usuário (gestor + operador)
- Suporte interno a WMS/ERP
- IA para vídeo e conteúdos avançados

---

## 📌 Critérios de Aceite MVP
| Área | KPI |
|---|---|
Onboarding | Conectar marketplace em < 5min |
Health Score | Score exibido para 100% anúncios |
Ações sugeridas | >=10 por seller/semana |
Ações aprovadas | >70% |
Resultado | +15% CTR médio |
Satisfação | NPS > 40 no MVP |

---

## 🛠️ Tecnologia MVP
- Front: Next.js + Tailwind
- Backend: Node/Python
- Infra: AWS Lambda + RDS Postgres + S3
- AI: modelos LLM + regras proprietárias por marketplace
- Autenticação: Cognito
- Observabilidade: CloudWatch
- Deploy: Terraform

---

## 📅 Timeline MVP (90 dias)
**Fase 1 — Semana 1–3:** Conectores + Data Lake inicial + UI base
**Fase 2 — Semana 4–8:** Health Score + Action Engine + aplicação assistida
**Fase 3 — Semana 9–12:** Refinamentos, relatórios, founders onboarding

---

## ✅ Entregáveis finais do MVP
- Plataforma live com sellers founders
- Dashboard + score + ações + relatórios
- 10+ casos de melhoria comprovada
- Dados para treinar modelos categoriais
- Playbook de crescimento pós-MVP

---

## 📎 Próximos passos
- Criar user stories detalhadas
- Priorizar com RICE
- Arquitetura técnica definitiva
- Wireframes UI/UX
- Pipeline de IA & feedback loop

---

## 🛠️ Tech Debts / Backlog Técnico

### Remover workaround de imports diretos dos prompts (2026-02-02)
**Status:** 🔴 Pendente

**Problema:**
- `apps/api/src/services/OpenAIService.ts` usa imports diretos de `@superseller/ai/dist/prompts/*` devido a problema de resolução de módulos TypeScript
- Workaround temporário implementado com TODO no código

**DoD (Definition of Done):**
- [ ] `@superseller/ai` exporta registry via `dist/` + `exports` corretamente
- [ ] API importa apenas de `@superseller/ai` (sem paths internos como `dist/prompts/*`)
- [ ] Build `@superseller/ai` e `@superseller/api` passam sem erros
- [ ] Deploy ok
- [ ] Remover TODO do código: `// TODO(2026-02-02): remove after exports fix`

**Referência no código:**
- `apps/api/src/services/OpenAIService.ts` linhas 30-40

---

### Refatoração UX Tela de Anúncios (2026-01-27)
**Status:** ✅ Implementado (accordion inline substituindo modal lateral)

**Itens pendentes / melhorias futuras:**

- [ ] **Melhorar distribuição visual/spacing do painel de análise (UX polish)**
  - Ajustar espaçamentos entre seções
  - Melhorar hierarquia visual dos cards
  - Otimizar responsividade mobile

- [ ] **Promoção ainda não detectada corretamente (preço promo)**
  - Backend ainda não fornece `priceFinal` e `hasPromotion` no endpoint de listings
  - Preparar integração quando campos estiverem disponíveis
  - Atualmente usando fallback: mesmo valor do preço normal

- [ ] **Clip/vídeo: parar de diferenciar "video" vs "clip" e ajustar linguagem para "clip"**
  - Unificar terminologia em toda a aplicação
  - Atualizar textos e labels para usar apenas "clip"

- [ ] **Abrir anúncio editável no ML (garantir link correto em todos casos)**
  - Validar construção de URL de edição em todos os cenários
  - Adicionar fallback quando `listingIdExt` não estiver disponível
  - Melhorar tratamento de erros ao abrir link

- [ ] **Preparar fundação para análise de imagens**
  - Salvar `pictures_urls[]` e `pictures_count` no sync
  - Preparar estrutura de dados para análise visual futura
  - (Sem análise visual ainda, apenas preparação de dados)
