# AI Evolution Roadmap — SuperSeller IA

> Este documento descreve a evolução estratégica da IA no SuperSeller IA, desde o modelo atual baseado em regras até a automação inteligente com supervisão do usuário.

## Visão Geral

A evolução da IA no SuperSeller IA segue um caminho progressivo e deliberado, onde cada fase constrói sobre a anterior. O objetivo não é substituir regras por IA, mas usar regras para **treinar e guiar** a IA, garantindo previsibilidade, confiança e resultados mensuráveis.

```
FASE 1 (atual)     →     FASE 2           →     FASE 3
IA Assistida            IA Propositiva          IA Autônoma
─────────────────────────────────────────────────────────────
Explica e reescreve     Sugere ações            Executa ações
com base em regras      baseadas em dados       com autorização
```

**Princípio fundamental:** Regras não limitam a IA — elas treinam a IA.

---

## FASE 1 — IA Assistida (Atual)

### Objetivo
Construir confiança, previsibilidade e credibilidade através de uma IA que explica decisões e opera dentro de limites bem definidos.

### Capacidades

| Capacidade | Descrição | Status |
|------------|-----------|--------|
| Explicar decisões | IA explica o score breakdown e identifica gargalos | Implementado |
| Reescrever com regras | IA reescreve títulos/descrições seguindo `rewriteGuidelines` | Implementado |
| Gerar Growth Hacks | IA sugere ações contextuais baseadas em dados reais | Implementado |
| Respeitar Data Quality | IA não afirma o que não é suportado por dados | Implementado |

### Limitações Intencionais

A IA na Fase 1 **NÃO**:
- Cria novas ações fora das regras definidas
- Executa mudanças automaticamente
- Toma decisões sem base em dados verificáveis
- Afirma métricas quando `performanceAvailable = false`

### Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────────┐
│                     FASE 1 — IA ASSISTIDA                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ SEO Rule    │───▶│ IA Score    │───▶│ OpenAI      │     │
│  │ Engine      │    │ Service     │    │ Service     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│        │                  │                  │              │
│        ▼                  ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              rewriteGuidelines + scoreBreakdown      │   │
│  │                    (regras determinísticas)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    IA (GPT-4o)                       │   │
│  │  - Explica gaps                                      │   │
│  │  - Sugere melhorias DENTRO das regras               │   │
│  │  - Gera variações A/B válidas                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Métricas de Sucesso (Fase 1)
- Taxa de adoção de sugestões de SEO
- Precisão das explicações (feedback do usuário)
- Redução de "alucinações" (afirmações sem dados)
- Tempo médio para primeira análise

---

## FASE 2 — IA Propositiva

### Objetivo
Evoluir a IA para sugerir novas ações baseadas em padrões históricos de sucesso, mantendo o usuário no controle de todas as decisões.

### Pré-requisitos (Gate de Entrada)

| Pré-requisito | Descrição | Critério de Aceite |
|---------------|-----------|-------------------|
| Data Quality sólida | Dados confiáveis e consistentes | `completenessScore >= 80%` em 90% dos anúncios |
| SEO Rule Engine madura | Regras validadas e estáveis | 6+ meses em produção, < 5% de falsos positivos |
| Histórico de ações | Registro de ações dos sellers | 1000+ ações registradas com outcome |
| Feedback loop | Sistema de feedback do usuário | Taxa de feedback > 20% |

### Capacidades

| Capacidade | Descrição | Dependência |
|------------|-----------|-------------|
| Sugerir novas ações | Propor ações além das regras atuais | Histórico de ações |
| Priorizar por impacto | Ordenar sugestões por impacto histórico | Dados de outcome |
| Aprender padrões vencedores | Identificar o que funciona por categoria/nicho | ML sobre histórico |
| Personalizar por seller | Adaptar sugestões ao perfil do vendedor | Segmentação de sellers |

### Arquitetura Técnica (Proposta)

```
┌─────────────────────────────────────────────────────────────┐
│                   FASE 2 — IA PROPOSITIVA                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FASE 1 (base)                           │   │
│  │  SEO Rule Engine + IA Score + OpenAI Service         │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Action History Service                  │   │
│  │  - Registro de ações aplicadas                       │   │
│  │  - Outcome tracking (antes/depois)                   │   │
│  │  - Correlação ação → resultado                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Pattern Learning Engine                 │   │
│  │  - Identificar padrões vencedores                    │   │
│  │  - Segmentar por categoria/nicho                     │   │
│  │  - Calcular impacto esperado                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Suggestion Ranker                       │   │
│  │  - Priorizar por impacto histórico                   │   │
│  │  - Personalizar por perfil do seller                 │   │
│  │  - Filtrar por confiança estatística                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Modelo de Dados (Proposta)

```typescript
// Registro de ação aplicada
interface ActionRecord {
  id: string;
  tenantId: string;
  listingId: string;
  actionType: 'title_rewrite' | 'description_rewrite' | 'image_add' | 'price_change' | ...;
  beforeSnapshot: ListingSnapshot;
  afterSnapshot: ListingSnapshot;
  appliedAt: Date;
  source: 'ai_suggestion' | 'manual' | 'rule_engine';
}

// Outcome tracking
interface ActionOutcome {
  actionId: string;
  metricsBefore: PerformanceMetrics; // 7 dias antes
  metricsAfter: PerformanceMetrics;  // 7 dias depois
  impactScore: number;               // Calculado
  confidence: number;                // Confiança estatística
}

// Padrão aprendido
interface LearnedPattern {
  actionType: string;
  categoryId: string;
  conditions: PatternCondition[];
  expectedImpact: number;
  sampleSize: number;
  confidence: number;
}
```

### Métricas de Sucesso (Fase 2)
- Taxa de aceitação de sugestões propositivas
- Precisão do impacto esperado vs. real
- Diversidade de ações sugeridas (além das regras)
- NPS de sellers sobre qualidade das sugestões

---

## FASE 3 — IA Autônoma

### Objetivo
Permitir que a IA execute ações automaticamente, com autorização explícita do usuário, monitoramento contínuo e capacidade de rollback.

### Pré-requisitos (Gate de Entrada)

| Pré-requisito | Descrição | Critério de Aceite |
|---------------|-----------|-------------------|
| Fase 2 madura | IA Propositiva validada | 6+ meses, precisão > 80% |
| Confiança do usuário | Alta taxa de aceitação | > 70% de sugestões aceitas |
| Sistema de rollback | Capacidade de reverter ações | Rollback em < 5 minutos |
| Monitoramento real-time | Detecção de anomalias | Alertas em < 1 hora |
| Autorização granular | Controle fino do usuário | UI de permissões implementada |

### Capacidades

| Capacidade | Descrição | Autorização Necessária |
|------------|-----------|----------------------|
| Aplicar mudanças automaticamente | Executar ações aprovadas | Opt-in por tipo de ação |
| Testar variações A/B | Criar e monitorar testes | Opt-in com limites |
| Monitorar impacto real | Acompanhar métricas pós-ação | Automático |
| Rollback automático | Reverter se impacto negativo | Configurável |
| Escalar ações vencedoras | Aplicar padrões em lote | Aprovação explícita |

### Modelo de Autorização

```
┌─────────────────────────────────────────────────────────────┐
│                 NÍVEIS DE AUTORIZAÇÃO                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  NÍVEL 0 — Desativado (padrão)                             │
│  └─ IA apenas sugere, nunca executa                        │
│                                                             │
│  NÍVEL 1 — Assistido                                       │
│  └─ IA prepara ação, usuário confirma cada uma             │
│                                                             │
│  NÍVEL 2 — Semi-autônomo                                   │
│  └─ IA executa ações de baixo risco automaticamente        │
│  └─ Ações de alto risco requerem confirmação               │
│                                                             │
│  NÍVEL 3 — Autônomo supervisionado                         │
│  └─ IA executa todas as ações dentro dos limites           │
│  └─ Usuário recebe relatório diário                        │
│  └─ Rollback automático se métricas caírem                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Arquitetura Técnica (Proposta)

```
┌─────────────────────────────────────────────────────────────┐
│                    FASE 3 — IA AUTÔNOMA                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FASE 2 (base)                           │   │
│  │  Pattern Learning + Suggestion Ranker                │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Authorization Service                   │   │
│  │  - Verificar nível de autorização                    │   │
│  │  - Validar limites configurados                      │   │
│  │  - Registrar audit trail                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Action Executor                         │   │
│  │  - Executar ação via API do marketplace              │   │
│  │  - Criar snapshot antes/depois                       │   │
│  │  - Agendar monitoramento                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Impact Monitor                          │   │
│  │  - Monitorar métricas pós-ação                       │   │
│  │  - Detectar anomalias                                │   │
│  │  - Trigger rollback se necessário                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              A/B Test Manager                        │   │
│  │  - Criar variações controladas                       │   │
│  │  - Distribuir tráfego                                │   │
│  │  - Calcular significância estatística               │   │
│  │  - Promover vencedor                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Métricas de Sucesso (Fase 3)
- Taxa de rollback (meta: < 5%)
- Impacto médio das ações automáticas
- Tempo economizado pelo seller
- ROI das ações automáticas vs. manuais

---

## Dependências entre Fases

```
FASE 1                    FASE 2                    FASE 3
────────────────────────────────────────────────────────────────
                          
SEO Rule Engine ─────────▶ Pattern Learning ────────▶ A/B Testing
        │                         │                        │
        ▼                         ▼                        ▼
IA Score Service ────────▶ Action History ──────────▶ Action Executor
        │                         │                        │
        ▼                         ▼                        ▼
Data Quality ────────────▶ Outcome Tracking ────────▶ Impact Monitor
        │                         │                        │
        ▼                         ▼                        ▼
Recommendation ──────────▶ Suggestion Ranker ───────▶ Authorization
Service                                                 Service

────────────────────────────────────────────────────────────────
CONFIANÇA              APRENDIZADO              AUTOMAÇÃO
PREVISIBILIDADE        PERSONALIZAÇÃO           SUPERVISÃO
CREDIBILIDADE          PRIORIZAÇÃO              CONTROLE
```

**Cada fase DEPENDE da anterior:**
- Fase 2 não pode existir sem Data Quality sólida da Fase 1
- Fase 3 não pode existir sem padrões aprendidos da Fase 2
- Pular fases resulta em IA não confiável e potencialmente prejudicial

---

## Princípios de Design

### 1. Regras treinam a IA
As regras determinísticas (SEO Rule Engine, IA Score) não são limitações — são o **curriculum** que ensina a IA o que funciona no marketplace. Quanto mais maduras as regras, mais inteligente a IA se torna.

### 2. Dados antes de decisões
A IA nunca deve afirmar ou agir sobre algo que não é suportado por dados verificáveis. `performanceAvailable = false` significa "não sei", não "está ruim".

### 3. Usuário sempre no controle
Mesmo na Fase 3, o usuário define os limites. A IA opera dentro de uma "sandbox" configurada pelo seller, nunca além dela.

### 4. Transparência total
Toda ação da IA deve ser explicável, rastreável e reversível. O usuário deve entender **por que** a IA fez algo e poder desfazer se discordar.

### 5. Evolução incremental
Cada fase deve provar seu valor antes de avançar. Métricas de sucesso são gates obrigatórios, não sugestões.

---

## Timeline Estimado

| Fase | Início | Duração Estimada | Status |
|------|--------|------------------|--------|
| Fase 1 — IA Assistida | Q4 2024 | 6-9 meses | Em andamento |
| Fase 2 — IA Propositiva | Q3 2025 | 9-12 meses | Planejado |
| Fase 3 — IA Autônoma | Q3 2026 | 12+ meses | Visão |

> ⚠️ Timeline sujeito a validação de pré-requisitos. Cada fase só inicia quando os gates da fase anterior são atingidos.

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Dados insuficientes para Fase 2 | Alto | Priorizar coleta de histórico de ações |
| Baixa adoção de sugestões | Médio | Melhorar UX e explicabilidade |
| Ações automáticas prejudiciais | Alto | Rollback automático + limites conservadores |
| Dependência excessiva de IA | Médio | Manter opção manual sempre disponível |
| Custo de API OpenAI | Médio | Cache agressivo + otimização de prompts |

---

## Conclusão

A evolução da IA no SuperSeller IA é um caminho deliberado de construção de confiança. Começamos com uma IA que explica e sugere (Fase 1), evoluímos para uma IA que aprende e prioriza (Fase 2), e chegamos a uma IA que executa com supervisão (Fase 3).

O diferencial não é a velocidade da evolução, mas a **solidez de cada fase**. Uma IA que o seller confia é mais valiosa do que uma IA que faz muito, mas erra frequentemente.

**Regras não limitam a IA — elas treinam a IA.**
