# SuperSeller IA — Estratégia de Produto e Monetização

> Documento vivo. Atualizar a cada mudança estratégica relevante.
> Última atualização: Março 2026

---

## 1. Visão do Produto

**O que é:** Motor de decisão operacional para sellers do Mercado Livre.
Transforma dados fragmentados em diagnóstico preciso, causa raiz identificada e ações executáveis que aumentam vendas.

**Evolução em 3 fases:**

```
HOJE          → Diagnóstico + Recomendação
PRÓXIMO       → Diagnóstico + Recomendação + Execução assistida (1-click)
FUTURO        → Diagnóstico + Execução automática (Autopilot)
```

**Tese central:**
> Quem controla a decisão operacional do seller, controla o crescimento dele.

---

## 2. Mercado

- **TAM:** 7M+ sellers ativos em marketplaces no Brasil
- **SAM foco inicial:** ~500k sellers ativos no Mercado Livre com operação recorrente (>10 anúncios, >R$1k/mês)
- **Crescimento do setor:** e-commerce Brasil projetado em R$200B+ até 2027 (+12% a.a.)
- **Dor real:** sellers tomam decisões sem dados, perdem tráfego e conversão por falta de inteligência

---

## 3. Modelo de Negócio

### 3.1 Estrutura de Planos

#### 🆓 Free — Gratuito, para sempre

| Feature | Limite |
|---|---|
| Análises de IA/mês | 3 |
| Marketplaces conectados | 1 |
| Sync automático | ❌ |
| Histórico de métricas | 7 dias |
| readyCopy (copy pronta) | ❌ bloqueado |
| Diagnóstico do funil | ✅ básico |
| Relatório de performance | ❌ |

**Objetivo:** gancho de aquisição, não receita. Limite de 3 análises/mês cria fricção real sem bloquear completamente o valor.

#### 💎 Pro — R$297/mês (R$247/mês anual)

| Feature | Limite |
|---|---|
| Análises de IA | **Ilimitado** |
| Marketplaces conectados | Todos (ML, Shopee, Amazon, Magalu) |
| Sync automático | ✅ diário |
| Histórico de métricas | 90 dias |
| readyCopy | ✅ completo |
| Diagnóstico do funil v23 | ✅ completo |
| Relatório mensal de performance | ✅ |
| Suporte prioritário | ✅ |

**Decisão sobre limites Pro:** Ilimitado. Com a regra de 7 dias de validade das análises já implementada, o custo por usuário (~R$21/mês em OpenAI para 30 análises) garante margem bruta de ~95% a R$297.

### 3.2 Modelo de Trial — Reverse Trial

**Por que Reverse Trial e não trial com cartão ou freemium puro:**

| Modelo | Signup | Conversão | Problema |
|---|---|---|---|
| Freemium puro | Alta (13%) | Baixa (2–5%) | "Freeloader" — usa free para sempre |
| Trial sem cartão (opt-in) | Média (8%) | Média (18%) | Urgência menor |
| Trial com cartão (opt-out) | Baixa (2%) | Alta (49%) | Fricção no Brasil — seller desconfia |
| **Reverse Trial** | **Alta** | **Alta (15–25%)** | **Melhor dos dois mundos** |

**Fluxo do Reverse Trial:**
```
Dia 0   → Cadastro (sem cartão) → acesso completo ao Pro por 14 dias
Dia 12  → Email/notificação: "Seu trial Pro expira em 2 dias"
Dia 14  → Rebaixamento automático para Free
Dia 15+ → Banner + bloqueios visíveis → pressão para upgrade
```

O segredo está no "rebaixamento que dói": o seller já viu o readyCopy, já usou o sync automático, já gerou análises ilimitadas. Perder isso é mais doloroso do que nunca ter tido.

### 3.3 Unidade Econômica

| Métrica | Valor |
|---|---|
| Ticket mensal | R$297 |
| Ticket anual | R$247/mês (R$2.964/ano) |
| CAC estimado (orgânico) | R$150–250 |
| LTV (12 meses, 5% churn/mês) | ~R$4.000 |
| LTV (24 meses, 3% churn/mês) | ~R$8.000 |
| Payback period | ~1 mês |
| Margem bruta | ~95% |
| Break-even (infra) | 2 clientes pagantes |

### 3.4 Custos de Infraestrutura

**AWS (ambiente 24/7 produção):** ~$80/mês base
**OpenAI GPT-4o por análise:** ~R$0,21 (30 análises/usuário/mês = ~R$6)
**Custo total por usuário Pro:** ~R$21/mês
**Margem bruta a R$297:** ~R$276/usuário/mês (~93%)

**Otimizações de custo pendentes:**
- Consolidar AWS Secrets Manager → SSM Parameter Store (~$8/mês economia)
- Desabilitar AWS Config → economiza ~$12/mês
- Lambda schedule para Bastion Host (ligar/desligar automático)

---

## 4. Estratégia de Lançamento

### 4.1 Lista de Espera (pré-lançamento)

**Por que fazer:** cria escassez, filtra usuários qualificados, gera MRR imediato no dia 1.

**Critérios de entrada:**
- Conta ativa no Mercado Livre
- Mínimo 10 anúncios publicados
- GMV mínimo: R$1.000/mês (auto-declarado, validação por amostragem)
- URL da loja (validação manual)

**Meta:** 200–500 pessoas na lista antes de abrir.
**Projeção dia 1:** 200 na lista × 20% conversão = 40 pagantes = R$11.880 MRR imediato.

### 4.2 Fases de Lançamento

```
FASE 0 — Lista de Espera (atual)
  → Landing page de captura
  → Formulário com critérios mínimos
  → Email de confirmação + posição na fila

FASE 1 — Beta Fechado (50 primeiros)
  → Acesso manual, onboarding white-glove
  → Feedback intensivo, ajustar produto
  → Meta: 30 pagantes ao final da fase

FASE 2 — Abertura Gradual
  → Liberar 200 por semana da lista de espera
  → Medir conversão trial → pago
  → Ajustar onboarding e comunicação

FASE 3 — Lançamento Público
  → Landing page pública
  → Conteúdo orgânico (YouTube, TikTok, Instagram)
  → Parcerias com influenciadores de e-commerce BR
```

---

## 5. Jornada do Usuário

### 5.1 Os 5 Passos do "Uau"

O objetivo é chegar no **Uau Moment** — o momento em que o seller vê pela primeira vez o diagnóstico real do seu anúncio com IA — em menos de 10 minutos após o cadastro.

```
PASSO 1: Landing Page
  Proposta de valor clara → CTA "Testar grátis 14 dias"
  Sem cartão. Sem burocracia.

PASSO 2: Cadastro
  Email + senha + nome da loja
  Trial Pro inicia automaticamente
  Redirect imediato para onboarding

PASSO 3: Conectar Mercado Livre
  OAuth em 30 segundos
  Sync automático dos primeiros listings
  Feedback visual de progresso

PASSO 4: Primeira Análise
  Sugestão automática: "Analisar seu anúncio mais visitado"
  Botão grande "Analisar agora"
  Loading com mensagens contextuais (~20s)

PASSO 5: Resultado Real
  Diagnóstico completo do funil
  readyCopy pronto para copiar e aplicar
  "Seu anúncio pode ganhar +30% de visitas com esse ajuste"
```

### 5.2 Onboarding Detalhado

#### Passo 1 — Landing Page
- **Headline:** "Seu anúncio aparece. Mas não vende. Descubra por quê."
- **Sub-headline:** "IA que analisa seus listings no Mercado Livre e entrega ações para aumentar suas vendas"
- **CTA primário:** "Analisar meus anúncios grátis" (sem cartão)
- **Social proof:** X sellers usando, Y anúncios analisados, Z de aumento médio em visitas
- **Como funciona:** 3 passos visuais (Conectar → Analisar → Vender mais)
- **Seção de preço:** mostrar Free vs Pro, CTA "Começar trial gratuito"

#### Passo 2 — Cadastro (< 60 segundos)
```
/register
  → Campo: Email
  → Campo: Senha
  → Campo: Nome da sua loja (para personalização)
  → Botão: "Criar conta e começar trial grátis"
  → Fine print: "14 dias grátis do Pro. Sem cartão. Cancele quando quiser."
```

Após cadastro: **redirect imediato para `/onboarding`** (não para `/listings` — o usuário precisa ser guiado).

#### Passo 3 — Conectar Mercado Livre (30 segundos)
```
/onboarding
  → Header: "Bem-vindo, [Nome]! Seu trial Pro está ativo por 14 dias."
  → Passo 1 de 3: "Conecte sua conta do Mercado Livre"
  → Botão grande: "Conectar Mercado Livre" → OAuth
  → Após conexão: progress bar "Importando seus anúncios..." (~10s)
  → Redirect para Passo 2
```

#### Passo 4 — Primeira Análise (20 segundos de espera)
```
/onboarding (passo 2 de 3)
  → "Encontramos X anúncios na sua conta"
  → Destaque: "Recomendamos analisar primeiro: [anúncio mais visitado]"
    → Mostra título, foto, métricas básicas (visitas/conversão)
  → Botão: "Analisar este anúncio com IA"
  → Loading screen com mensagens rotativas:
    - "Analisando título e palavras-chave..."
    - "Avaliando imagens e qualidade visual..."
    - "Calculando seu funil de vendas..."
    - "Gerando recomendações personalizadas..."
```

#### Passo 5 — Resultado Real (o Uau Moment)
```
/onboarding (passo 3 de 3) ou redirect para /listings com painel aberto
  → Banner: "🎉 Sua primeira análise está pronta!"
  → Mostra o painel completo:
    - performanceSignal (CRÍTICO / ATENÇÃO / BOM / EXCELENTE)
    - Veredito com headline específico
    - Diagnóstico do funil (4 pilares com scores)
    - Top ação recomendada com readyCopy
    - Botão "Aplicar agora" / "Copiar copy"
  → CTA secondary: "Ver todos os seus anúncios"
  → Email de boas-vindas disparado com resumo da análise
```

### 5.3 Emails da Jornada

| Dia | Trigger | Assunto | Objetivo |
|---|---|---|---|
| 0 | Cadastro | "Sua conta está pronta — veja o diagnóstico do seu anúncio" | Ativação |
| 1 | Sem login | "Você tem X anúncios esperando análise" | Reativação |
| 7 | Trial dia 7 | "Metade do trial passou — você já aplicou alguma ação?" | Engajamento |
| 12 | Trial dia 12 | "⏰ Seu trial Pro expira em 2 dias" | Urgência |
| 14 | Trial expirou | "Seu acesso Pro acabou — veja o que você vai perder" | Conversão |
| 15 | Downgrade | "Você perdeu acesso ao readyCopy de 3 anúncios" | Dor |
| 21 | Free ativo | "Sellers Pro aumentam vendas 3x mais rápido" | Nurture |
| 30 | Free ativo | "Oferta especial: 20% off no primeiro mês Pro" | Conversão |

---

## 6. Features por Fase

### Fase Atual (implementado)
- ✅ Auth multi-tenant (JWT + refresh token)
- ✅ Connector Mercado Livre (OAuth 2.0 + sync)
- ✅ Recommendation Engine v23 (GPT-4o + payload enriquecido)
- ✅ Dashboard overview + listings
- ✅ Sync rules (login refresh, freshness check, scheduler semanal)
- ✅ UI: funnelAnalysis, performanceSignal, readyCopy, botões APLICAR

### Próxima Fase (para lançamento)
- ⬜ Billing (Stripe + Reverse Trial + Free limits)
- ⬜ Onboarding (fluxo /onboarding 3 passos)
- ⬜ Landing page pública
- ⬜ Emails transacionais (trial, upgrade, expiração)
- ⬜ Plan enforcement (bloquear readyCopy no Free)
- ⬜ UpgradeBanner + página /upgrade

### Fase Pós-Lançamento
- ⬜ Execução assistida (aplicar título/descrição via API ML)
- ⬜ Connector Shopee
- ⬜ Relatório mensal automático
- ⬜ Connector Amazon + Magalu
- ⬜ Plano Enterprise (agências)
- ⬜ Autopilot (execução automática de ações aprovadas)

---

## 7. Métricas de Sucesso

### North Star Metric
**MRR** (Monthly Recurring Revenue)

### Métricas de Produto
| Métrica | Meta mês 1 | Meta mês 6 | Meta mês 12 |
|---|---|---|---|
| Cadastros | 200 | 500/mês | 1.000/mês |
| Ativação (conectou ML) | >80% | >85% | >90% |
| Análise no dia 1 | >60% | >70% | >75% |
| Trial → Pago | >20% | >25% | >30% |
| Churn mensal | <8% | <5% | <3% |
| MRR | R$5k | R$50k | R$200k |
| Usuários Pro ativos | 20 | 170 | 680 |

### Marcos para Venda/Investimento
- **R$50k MRR** com churn < 5% → Produto validado, conversa com investidores anjo
- **R$150k MRR** com crescimento >15% m/m → Candidato a Série A ou venda estratégica
- **R$300k MRR** → Valuation ~R$15–25M (5–8x ARR)

---

## 8. Decisões Estratégicas Registradas

| Data | Decisão | Motivo |
|---|---|---|
| Mar/2026 | Reverse Trial (sem cartão) | Alta fricção do cartão no Brasil; reverse trial maximiza conversão sem barreira |
| Mar/2026 | Pro ilimitado (sem limite de análises) | Margem 95%, custo controlado pela regra de 7 dias, elimina fricção de suporte |
| Mar/2026 | Ticket R$297 (não R$399) | Sweet spot psicológico abaixo de R$300; aumentar depois com tração |
| Mar/2026 | Lista de espera pré-lançamento | Cria escassez, filtra usuários qualificados, valida produto antes de escalar |
| Mar/2026 | Foco ML primeiro, outros em seguida | ML = maior mercado BR, connector funcionando; Shopee/Amazon como diferencial |
