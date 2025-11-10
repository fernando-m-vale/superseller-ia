# Changelog

All notable changes to the SuperSeller IA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.0-beta] – 2025-11-10

### Added

#### Core Package (@superseller/core)
- **healthScore() function** with min-max normalization algorithm
  - Calculates listing health score (0-100) based on CTR, CVR, revenue, and orders
  - Customizable weights (default: CTR 30%, CVR 30%, revenue 25%, orders 15%)
  - Temporal window support (last N days, default 7 days, minimum 3 days)
  - Handles edge cases: empty data, zeros, NaN, out-of-order dates
  - Returns scores with 2 decimal places precision
- **13 comprehensive unit tests** using Vitest (100% passing)
- TypeScript declarations and build configuration
- Test coverage reporting

#### API (apps/api)
- **Fastify server** with TypeScript and CORS support
- **GET /health** endpoint for health checks
- **GET /api/v1/listings** endpoint with Prisma DB integration
  - Filters: tenantId, marketplace, search query (q), pagination (page, pageSize)
  - Case-insensitive search on listing titles
  - Ordered by creation date (most recent first)
  - Zod validation for query parameters
- **GET /api/v1/actions/recommendations** endpoint with mock data
  - Integration with healthScore() from @superseller/core
  - 5 heuristic rules: out_of_stock, low_ctr, low_cvr, low_health, high_performance
  - 5 action types: optimize_photos, improve_title, adjust_price, restock, increase_ad_spend
  - Filters: marketplace, search query, pagination
  - Sorting by impact → effort → health score
- **Prisma ORM** integration with PostgreSQL
  - Schema with 5 tables: tenants, users, marketplace_connections, listings, listing_metrics_daily
  - 4 enums: UserRole, Marketplace, ConnectionStatus, ListingStatus
  - Multi-tenant design with tenant_id in all tables
  - Foreign keys with CASCADE delete
  - Optimized indexes for queries
- **Database seed script** (apps/api/prisma/seed.ts)
  - Creates demo tenant, owner user, 6 listings (3 Shopee, 3 Mercado Livre)
  - Generates 7 days of metrics per listing (42 total records)
  - Idempotent using upsert operations
  - Protected against production execution
- **Docker Compose** configuration for PostgreSQL 15
- Database management scripts: db:dev, db:up, db:reset, db:studio, db:seed, db:generate

#### Web (apps/web)
- **Activation Checklist component** (ActivationChecklist.tsx)
  - 4 onboarding steps with checkboxes
  - Dynamic progress bar (0-100%)
  - Action buttons: "Marcar tudo", "Limpar tudo", "Resetar progresso"
  - localStorage persistence (key: ssia.activationChecklist.v1)
  - SSR-safe with useEffect hydration
  - Telemetry stubs (console.info) for user actions
- **Recommendations page** (/recommendations)
  - Table with 8 columns: Title, Marketplace, Action, Reason, Impact, Effort, Health Score, Date
  - Filters: marketplace dropdown, search input (debounced 500ms), page size selector
  - Pagination with Previous/Next buttons
  - URL querystring synchronization (filters persist on reload)
  - Loading state with skeleton placeholders
  - Empty state with "Clear filters" button
  - Error state with retry button
  - React Query integration for API calls
- **shadcn/ui components**:
  - Card (CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
  - Progress bar (Radix UI)
  - Checkbox (Radix UI)
  - Badge (for Impact and Effort indicators)
  - Alert (for error messages)
  - Separator (visual divider)
  - Table components
- **Custom hooks**:
  - useRecommendations: React Query hook for fetching recommendations
- **Type definitions**:
  - types/onboarding.ts: ChecklistState, INITIAL_CHECKLIST_STATE
  - types/recommendations.ts: Recommendation, RecommendationsResponse
- **Storage utilities** (lib/storage.ts):
  - loadChecklistState(), saveChecklistState(), resetChecklistState()
  - Versioned storage with timestamp tracking
  - Error handling and validation

#### Infrastructure
- **GitHub Actions workflow** (check-forbidden-paths.yml)
  - Validates that .env, .terraform/, node_modules/ are not committed
  - Fixed to handle cases when grep finds no matches
- **Environment configuration**:
  - .env.example files for API
  - NEXT_PUBLIC_API_URL support for Web
- **Monorepo structure** with pnpm workspaces:
  - packages/core: Shared business logic
  - apps/api: Backend API
  - apps/web: Frontend application

### Changed

- **Monorepo configuration**: Updated pnpm workspace settings
- **Package scripts**: Consolidated build, dev, lint, typecheck scripts across workspaces
- **TypeScript configuration**: Enabled composite builds for better performance
- **ESLint configuration**: Updated to v8 compatibility
- **Prisma Client generation**: Integrated into build pipeline

### Fixed

- **Merge conflict markers in main branch** (PR #12 - Hotfix)
  - Removed conflict markers from apps/api/package.json
  - Regenerated pnpm-lock.yaml (resolved 39 conflicts)
  - Unified scripts and dependencies correctly
  - Maintained Prisma 5.22.0 version (not upgraded to 6.x)
  - Preserved @superseller/core workspace dependency
- **Next.js build error - Suspense boundary** (PR #13)
  - Split recommendations page into server wrapper (page.tsx) + client component (client.tsx)
  - Added Suspense boundary with loading fallback
  - Fixed useSearchParams() static generation requirement
  - Maintained all original functionality
- **TypeScript type errors**: Replaced `any` with `unknown` in healthScore tests
- **CI workflow**: Fixed check-forbidden-paths to not fail when no matches found
- **JSON syntax**: Fixed malformed package.json in API workspace
- **Dependency issues**: Added missing tsx devDependency for API dev script

### Security

- **Production protection**: Seed script refuses to run in production environment
- **Input validation**: All API endpoints use Zod schemas for request validation
- **SQL injection prevention**: Prisma ORM parameterized queries
- **Environment variables**: Sensitive data in .env files (gitignored)

---

## Sprint 1 Summary

**Total Deliverables**: 7 User Stories  
**PRs Merged**: 8 (including hotfix #12 and fix #13)  
**Success Rate**: 100% CI passing  
**Code Changes**: 16 files changed, 833 insertions(+), 542 deletions(-)  
**Test Coverage**: 13/13 tests passing (100%)  
**Build Status**: ✅ All workspaces building successfully  

**User Stories Completed**:
- US-001: API Bootstrap + /health + CORS
- US-021: DB + Prisma + Migrations
- US-030: Core — healthScore() + Unit Tests
- US-040: API — /actions/recommendations (mock)
- US-003: Web — Activation Checklist (localStorage)
- US-050: Web — Recommendations Page
- US-060: API — /listings from DB + Seed

**System Health**: 🟢 All services operational  
**Quality**: 🟢 100% CI passing  
**Integration**: 🟢 Full stack validated  

---

## Links

- **Repository**: https://github.com/fernando-m-vale/superseller-ia
- **Release**: https://github.com/fernando-m-vale/superseller-ia/releases/tag/v1.0.0-beta
- **Milestone**: Sprint 1 — MVP Foundation
- **Devin Session**: https://app.devin.ai/sessions/fe686698835a4f41bb432ce01ffeeb32

---

[v1.0.0-beta]: https://github.com/fernando-m-vale/superseller-ia/compare/7e714bd...v1.0.0-beta
