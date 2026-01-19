# PROJECT CONTEXT — SuperSeller IA (2026-01-19)

## 🧠 O que é o SuperSeller IA
Plataforma que analisa anúncios em marketplaces (foco atual: Mercado Livre) e entrega:
- Diagnóstico por dimensão (Cadastro, Mídia, SEO, Competitividade, Performance)
- Score determinístico e explicável
- Plano de ação priorizado
- IA como amplificador (explica e reescreve, sem contradizer regras)

## ✅ Decisões base (imutáveis)
- IA NÃO calcula score.
- Score e ações são determinísticos (regras).
- IA apenas amplia valor: explica, reescreve SEO e contextualiza.
- Nunca afirmar ausência quando dado é NULL.
- Mídia no Mercado Livre é tratada como "Clip (vídeo)" (conceito único).

## 🧱 Arquitetura atual (produção)
- Backend: AWS App Runner (API)
- Frontend: Next.js (deploy web)
- Database: Postgres (RDS)
- Observabilidade: Logs via App Runner (CloudWatch/console App Runner) + job_logs no DB

### Importante: Cron/Scheduler
- Não usamos cron interno no processo do App Runner.
- Operação confiável é feita via:
  1) Endpoints internos idempotentes (jobs)
  2) Scheduler externo (AWS EventBridge Scheduler) chamando os endpoints

## 🔧 Endpoints internos (jobs) — fonte de verdade operacional
Proteção:
- Header obrigatório: X-Internal-Key
- Chave: INTERNAL_JOBS_KEY (Secrets Manager + env do App Runner)

Endpoints:
- POST /api/v1/jobs/sync-mercadolivre
  - Sync listings + orders
  - Params: tenantId, daysBack (default 30)
  - Registra execução em job_logs
- POST /api/v1/jobs/rebuild-daily-metrics
  - Rebuild/UPSERT idempotente em listing_metrics_daily
  - Body: { tenantId, from, to }
  - Retorna resumo + MAX(date) pós rebuild

## 📊 Fonte do Dashboard
- Gráficos e cards dependem de listing_metrics_daily.
- Se MAX(date) estiver atrasado, dashboard fica “parado”.
- Rebuild deve ser executado diariamente via scheduler.

## 📁 Documentos operacionais fixos
- docs/ML_DATA_AUDIT.md (prioridade zero)
- docs/DAILY_EXECUTION_LOG.md
- docs/NEXT_SESSION_PLAN.md
- docs/OPERATIONS_SCHEDULER.md (scheduler EventBridge + App Runner)

## 🧭 Roadmap (alto nível)
- ONDA 1/2: Score V2 + UX (concluído)
- ONDA 3: IA como amplificador (em progresso)
- Operação: jobs internos + scheduler (fase atual, crítico para clientes reais)
- Próxima épica: Benchmark/Ads/Automações (após dados e operação sólidos)
