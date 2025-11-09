# Monorepo Structure — Superseller IA

## packages/core
- Contém lógica de negócio compartilhada (API + Web)
- Scripts obrigatórios:
  - `"test": "vitest run"`
  - `"test:coverage": "vitest run --coverage"`
- Testes em `__tests__/`
- Framework: Vitest

## apps/api
- Serviços backend (Fastify)
- Integra `core` via `@superseller/core`

## apps/web
- Aplicação Next.js (frontend)
- Usa `core` e API como dependências locais
