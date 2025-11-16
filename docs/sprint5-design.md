# Sprint 5 — Outcomes & Automation Intelligence

## Objetivo

Evoluir o sistema de IA com aprendizado de resultados, automação inteligente e observabilidade completa.

## User Stories Implementadas

### US-150 — AI Outcomes Tracking

**Objetivo:** Registrar resultados reais de ações executadas para aprendizado contínuo do sistema de IA.

**Implementação:**

- **Modelo de Dados:** `ListingActionOutcome`
  - `listing_id`: Referência ao listing
  - `action_type`: Tipo de ação executada (title, price, image, etc.)
  - `executed_at`: Data/hora de execução
  - `ctr_before`, `ctr_after`: CTR antes e depois
  - `cvr_before`, `cvr_after`: CVR antes e depois
  - `revenue_before`, `revenue_after`: Revenue antes e depois
  - `effectiveness_score`: Score calculado de efetividade (0-100)
  - `metadata`: Dados adicionais em JSON

- **Endpoints:**
  - `POST /api/v1/ai/outcomes`: Registra resultado de ação executada
  - Calcula effectiveness_score automaticamente baseado em melhorias de CTR/CVR/Revenue

- **Cálculo de Effectiveness Score:**
  ```
  effectiveness_score = (
    (ctr_improvement * 0.3) +
    (cvr_improvement * 0.3) +
    (revenue_improvement * 0.4)
  ) * 100
  ```

- **Integração:** Outcomes são considerados no cálculo de healthScore() para priorização de ações

**PR:** #25

---

### US-160 — Auto-Approve Policy Engine

**Objetivo:** Engine de políticas configuráveis para execução automática de ações de baixo risco.

**Implementação:**

- **Modelo de Dados:** `AutoApproveRule`
  - `tenant_id`: Tenant proprietário
  - `action_type`: Tipo de ação (title, price, image, etc.)
  - `enabled`: Flag de ativação
  - `min_ctr_threshold`: CTR mínimo para aprovação automática
  - `max_ctr_threshold`: CTR máximo para aprovação automática
  - `min_cvr_threshold`: CVR mínimo
  - `max_cvr_threshold`: CVR máximo
  - `min_revenue_impact`: Impacto mínimo de revenue
  - `max_revenue_impact`: Impacto máximo de revenue
  - `dry_run`: Modo de simulação (não executa, apenas loga)

- **Endpoints:**
  - `GET /api/v1/automation/rules`: Lista regras de auto-aprovação
  - `POST /api/v1/automation/rules`: Cria nova regra
  - `PUT /api/v1/automation/rules/:id`: Atualiza regra existente
  - `DELETE /api/v1/automation/rules/:id`: Remove regra
  - `POST /api/v1/automation/evaluate`: Avalia se ação deve ser auto-aprovada

- **Lógica de Avaliação:**
  - Verifica se existe regra ativa para o tipo de ação
  - Valida se métricas estão dentro dos thresholds configurados
  - Em modo dry-run, apenas loga a decisão sem executar
  - Retorna `shouldAutoApprove: boolean` e `reason: string`

**PR:** #26

---

### US-170 — Job & Sync Monitor

**Objetivo:** Dashboard de monitoramento de jobs de sincronização e agregação de dados.

**Implementação:**

- **Modelo de Dados:** `JobLog`
  - `tenant_id`: Tenant proprietário
  - `job_type`: Tipo de job (shopee_sync, mercadolivre_sync, amazon_sync, magalu_sync, metrics_aggregation, data_quality_check)
  - `status`: Status (success, error, running)
  - `started_at`: Início da execução
  - `completed_at`: Fim da execução
  - `duration_ms`: Duração em milissegundos
  - `records_processed`: Quantidade de registros processados
  - `error_message`: Mensagem de erro (se houver)
  - `metadata`: Dados adicionais em JSON

- **Endpoints:**
  - `GET /api/v1/jobs/status`: Lista jobs com filtros e resumo
    - Suporta filtro por `jobType`
    - Retorna resumo: total jobs, últimos sucessos por tipo, estatísticas
  - `POST /api/v1/jobs/log`: Registra execução de job
  - `GET /api/v1/jobs/stats`: Estatísticas agregadas e erros recentes

- **Métricas Calculadas:**
  - Duração média por tipo de job
  - Taxa de sucesso/erro
  - Última execução bem-sucedida
  - Jobs em execução

**PR:** #27

---

### US-180 — Data Quality Checks

**Objetivo:** Validação automática da qualidade dos dados de métricas.

**Implementação:**

- **Modelo de Dados:** `DataQualityCheck`
  - `tenant_id`: Tenant proprietário
  - `check_date`: Data da verificação
  - `status`: Status (pass, warning, critical)
  - `missing_days`: Quantidade de dias com dados faltantes
  - `outlier_count`: Quantidade de outliers detectados
  - `total_listings`: Total de listings verificados
  - `listings_checked`: Listings efetivamente verificados
  - `issues_found`: Detalhes dos problemas em JSON

- **Endpoints:**
  - `GET /api/v1/data/quality`: Lista verificações de qualidade
    - Suporta filtros por `startDate`, `endDate`, `limit`
    - Retorna latest check e summary por status
  - `POST /api/v1/data/quality/check`: Executa verificação de qualidade
  - `POST /api/v1/data/quality/log`: Registra resultado de verificação

- **Validações Realizadas:**
  - **Missing Data:** Detecta listings com mais de 7 dias sem métricas nos últimos 30 dias
  - **Outliers:** Identifica valores anormais (CTR > 50%, CVR > 50%, GMV > 100k)
  - **Status Calculation:**
    - `critical`: missing_days > 50 OU outlier_count > 20
    - `warning`: missing_days > 20 OU outlier_count > 10
    - `pass`: Caso contrário

**PR:** #28

---

### US-190 — AI Model Metrics v1.1

**Objetivo:** Rastreamento de métricas de performance dos modelos de IA.

**Implementação:**

- **Modelo de Dados:** `AiModelMetric`
  - `tenant_id`: Tenant proprietário
  - `model_version`: Versão do modelo (default: "v1.1")
  - `mae`: Mean Absolute Error
  - `rmse`: Root Mean Squared Error
  - `r_squared`: Coeficiente de determinação R²
  - `training_date`: Data do treinamento
  - `samples_count`: Quantidade de amostras usadas
  - `features_used`: Array de features utilizadas
  - `metadata`: Dados adicionais em JSON

- **Endpoints:**
  - `GET /api/v1/ai/metrics`: Lista métricas de modelos
    - Suporta filtro por `modelVersion`
    - Retorna latest metrics e summary (avg MAE/RMSE/R²)
  - `POST /api/v1/ai/metrics`: Registra métricas de modelo
  - `GET /api/v1/ai/health`: Status de saúde do modelo de IA
    - Calcula health score baseado em MAE, RMSE e R²
    - Retorna recomendações (ex: retreinar se > 30 dias)

- **Health Score Calculation:**
  - `excellent` (95): R² ≥ 0.8, MAE < 0.1, RMSE < 0.15
  - `good` (75): R² ≥ 0.6, MAE < 0.2, RMSE < 0.25
  - `fair` (55): R² ≥ 0.4, MAE < 0.3, RMSE < 0.35
  - `poor` (30): Caso contrário

**PR:** #29

---

## Arquitetura

### Database Schema

Todas as novas tabelas seguem o padrão:
- Multi-tenant com `tenant_id` e foreign key para `tenants`
- Índices apropriados para queries frequentes
- Campos `created_at` para auditoria
- Uso de `Json` type para metadados flexíveis
- Enums para valores categóricos

### API Design

Todos os endpoints seguem:
- Padrão REST com `/api/v1` prefix
- Autenticação via `tenantPlugin` e `authPlugin`
- Validação com Zod schemas
- Conversão de Decimal para number em responses
- Error handling consistente
- Logging estruturado com Fastify logger

### Tecnologias

- **Backend:** Fastify + TypeScript
- **ORM:** Prisma 5.22.0
- **Database:** PostgreSQL
- **Validation:** Zod
- **AI:** TensorFlow.js (packages/ai)

---

## Endpoints Resumo

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/v1/ai/outcomes` | POST | Registra resultado de ação |
| `/api/v1/automation/rules` | GET | Lista regras de auto-aprovação |
| `/api/v1/automation/rules` | POST | Cria regra de auto-aprovação |
| `/api/v1/automation/rules/:id` | PUT | Atualiza regra |
| `/api/v1/automation/rules/:id` | DELETE | Remove regra |
| `/api/v1/automation/evaluate` | POST | Avalia auto-aprovação |
| `/api/v1/jobs/status` | GET | Lista jobs e resumo |
| `/api/v1/jobs/log` | POST | Registra execução de job |
| `/api/v1/jobs/stats` | GET | Estatísticas de jobs |
| `/api/v1/data/quality` | GET | Lista verificações de qualidade |
| `/api/v1/data/quality/check` | POST | Executa verificação |
| `/api/v1/data/quality/log` | POST | Registra verificação |
| `/api/v1/ai/metrics` | GET | Lista métricas de modelos |
| `/api/v1/ai/metrics` | POST | Registra métricas |
| `/api/v1/ai/health` | GET | Status de saúde do modelo |

---

## Migrations

Todas as migrations foram criadas seguindo o padrão:
- Timestamp no formato `YYYYMMDDHHMMSS`
- Criação de enums quando necessário
- Criação de tabelas com constraints apropriadas
- Índices para otimização de queries
- Foreign keys com `ON DELETE CASCADE`

**Migrations criadas:**
1. `20251110190324_add_listing_action_outcomes`
2. `20251110191006_add_auto_approve_rules`
3. `20251110191445_add_job_logs`
4. `20251110192630_add_data_quality_checks`
5. `20251110193000_add_ai_model_metrics`

---

## Próximos Passos

Para v1.4.0-beta:
1. Merge dos 5 PRs (#25, #26, #27, #28, #29)
2. Testes de integração end-to-end
3. Implementação de schedulers para:
   - Data quality checks noturnos
   - Retreinamento automático de modelos
4. Dashboard UI para visualização de:
   - Job monitoring
   - Data quality alerts
   - AI health status
5. Documentação de API completa (OpenAPI/Swagger)

---

## Considerações Técnicas

### Performance
- Índices criados em campos frequentemente consultados
- Uso de aggregations do Prisma para estatísticas
- Paginação implementada com `take` e `skip`

### Segurança
- Multi-tenancy garantido em todas as queries
- Validação de inputs com Zod
- Sanitização de erros em responses

### Manutenibilidade
- Código TypeScript com tipos fortes
- Separação clara de responsabilidades
- Logging estruturado para debugging
- Migrations versionadas

### Escalabilidade
- Preparado para sharding por tenant_id
- Índices otimizados para queries de leitura
- Metadados em JSON para flexibilidade futura
