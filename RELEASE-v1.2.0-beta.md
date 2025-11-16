# Release Notes — v1.2.0-beta

**Release Date:** November 10, 2025  
**Milestone:** Sprint 3 — Connections & Auth  
**Repository:** [fernando-m-vale/superseller-ia](https://github.com/fernando-m-vale/superseller-ia)

---

## Overview

This release introduces **multi-tenant authentication** and **OAuth 2.0 integrations** with Shopee and Mercado Livre marketplaces, establishing the foundation for secure marketplace connections and data synchronization.

Sprint 3 delivers three major features that enable sellers to authenticate, connect their marketplace accounts, and synchronize product listings into the Super Seller IA platform.

---

## 🎯 Highlights

### 🔐 Multi-Tenant Authentication (US-090)
Complete authentication system with JWT-based access control, enabling secure user registration, login, and session management across multiple tenant organizations.

**Features:**
- User registration with automatic tenant creation
- Secure login with bcrypt password hashing
- JWT access tokens (7-day expiration) and refresh tokens (30-day expiration)
- Protected routes with authGuard middleware
- Multi-tenant data isolation

**Web Interface:**
- `/login` page with email/password authentication
- `/register` page for new user onboarding
- Persistent authentication via localStorage
- Auto-redirect to dashboard after successful login

### 🛍️ Shopee OAuth Connector (US-100)
Full OAuth 2.0 integration with Shopee marketplace, enabling sellers to connect their Shopee stores and import product listings.

**Features:**
- OAuth 2.0 authorization flow with CSRF protection
- HMAC-SHA256 signature generation for Shopee API authentication
- Secure token storage in database
- Automatic listing synchronization from Shopee API
- AWS Secrets Manager integration for credential management

**Endpoints:**
- `GET /auth/shopee/authorize` - Initiate OAuth flow
- `GET /auth/shopee/callback` - Handle OAuth callback
- `GET /shopee/sync` - Import listings from Shopee

### 🧾 Mercado Livre OAuth Connector (US-110)
Full OAuth 2.0 integration with Mercado Livre marketplace, enabling sellers to connect their Mercado Livre stores and import product listings.

**Features:**
- OAuth 2.0 authorization flow with CSRF protection
- Automatic token refresh for expired credentials
- Secure token storage in database
- Automatic listing synchronization from Mercado Livre API
- AWS Secrets Manager integration for credential management

**Endpoints:**
- `GET /auth/mercadolivre/authorize` - Initiate OAuth flow
- `GET /auth/mercadolivre/callback` - Handle OAuth callback
- `GET /mercadolivre/sync` - Import listings from Mercado Livre

### 🧩 AWS Integration
Both marketplace connectors support AWS Secrets Manager for secure credential storage in production environments, with automatic fallback to environment variables for local development.

---

## 📊 User Stories Delivered

| US | Description | Status | PR |
|----|-------------|--------|-----|
| US-090 | Auth API + Web Login | ✅ Complete | [#17](https://github.com/fernando-m-vale/superseller-ia/pull/17) |
| US-100 | Shopee Connector | ✅ Complete | [#18](https://github.com/fernando-m-vale/superseller-ia/pull/18) |
| US-110 | Mercado Livre Connector | ✅ Complete | [#19](https://github.com/fernando-m-vale/superseller-ia/pull/19) |

---

## 🔧 Technical Details

### Backend Changes (`apps/api`)

**New Routes:**
- `src/routes/auth.ts` - Authentication endpoints (register, login, me)
- `src/routes/shopee.ts` - Shopee OAuth and sync endpoints
- `src/routes/mercadolivre.ts` - Mercado Livre OAuth and sync endpoints

**New Plugins:**
- `src/plugins/auth.ts` - JWT validation middleware (authGuard)

**New Utilities:**
- `src/lib/secrets.ts` - AWS Secrets Manager integration

**Dependencies Added:**
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT token generation and validation
- `@aws-sdk/client-secrets-manager` - AWS Secrets Manager client
- `axios` - HTTP client for marketplace APIs

### Frontend Changes (`apps/web`)

**New Pages:**
- `src/app/login/page.tsx` - User login interface
- `src/app/register/page.tsx` - User registration interface

**New Utilities:**
- `src/lib/auth.ts` - Authentication API client and token management

**Dependencies Added:**
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `@hookform/resolvers` - Zod resolver for React Hook Form

### Database Changes

**Migrations:**
- `20251110153513_add_password_to_users` - Added `password_hash` field to users table

**Schema Updates:**
- `users` table now includes `password_hash` field (required, string)
- Existing tables validated: `tenants`, `marketplace_connections`, `listings`, `listing_metrics_daily`

---

## ✅ Quality & CI

### Build Status
- ✅ **Core package:** Build successful
- ✅ **Web app:** Build successful
- ✅ **API:** Lint passing (pre-existing typecheck issues noted)

### Lint & Type Checking
- ✅ **ESLint:** 0 errors, 0 warnings
- ✅ **TypeScript:** All Sprint 3 code properly typed

### CI/CD
- ✅ **PR #17:** All checks passing
- ✅ **PR #18:** All checks passing
- ✅ **PR #19:** All checks passing
- ✅ **100% green CI** across all Sprint 3 pull requests

### Testing
- ✅ Manual endpoint testing completed
- ✅ Auth flow validated end-to-end
- ✅ JWT token generation and validation verified
- ✅ Multi-tenant isolation confirmed
- ✅ Marketplace OAuth flows implemented and accessible

---

## 🚀 Deployment Notes

### Environment Variables Required

**API (`apps/api/.env`):**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/superseller

# JWT
JWT_SECRET=your-secret-key-here

# CORS
CORS_ORIGIN=http://localhost:3000

# AWS (Production)
AWS_REGION=us-east-2

# Shopee (Development fallback)
SHOPEE_CLIENT_ID=your-shopee-client-id
SHOPEE_CLIENT_SECRET=your-shopee-client-secret
SHOPEE_REDIRECT_URI=http://localhost:3001/api/v1/auth/shopee/callback

# Mercado Livre (Development fallback)
MERCADOLIVRE_CLIENT_ID=your-ml-client-id
MERCADOLIVRE_CLIENT_SECRET=your-ml-client-secret
MERCADOLIVRE_REDIRECT_URI=http://localhost:3001/api/v1/auth/mercadolivre/callback
```

**Web (`apps/web/.env`):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### AWS Secrets Manager (Production)

Create the following secrets in AWS Secrets Manager:
- `superseller/shopee/credentials` - JSON with `clientId` and `clientSecret`
- `superseller/mercadolivre/credentials` - JSON with `clientId` and `clientSecret`

### Database Migration

Run migrations after deployment:
```bash
pnpm --filter ./apps/api db:dev
```

---

## 📝 Breaking Changes

None. This release is backward compatible with Sprint 2.

---

## 🐛 Known Issues

### Pre-existing Issues (Not Sprint 3 Related)
1. TypeScript module resolution errors in `actions.ts` and `metrics.ts` for `@superseller/core` imports
   - These errors existed before Sprint 3
   - Do not affect Sprint 3 functionality
   - Will be addressed in future sprint

---

## 🔜 Next Steps — Sprint 4: Intelligence & Automation

The foundation is now in place for Sprint 4, which will focus on:
- AI-powered listing analysis using connected marketplace data
- Dynamic recommendations based on performance metrics
- Automated action execution via marketplace APIs
- Telemetry and observability infrastructure
- Real-time performance monitoring

---

## 👥 Contributors

- **Devin AI** - Implementation and testing
- **Fernando Marques do Vale** (@fernando-m-vale) - Product owner and reviewer

---

## 📚 Documentation

- [Sprint 3 Integration Report](./sprint3-integration-report.md)
- [CHANGELOG](./CHANGELOG.md)
- [API Documentation](./docs/)

---

## 🔗 Links

- **Repository:** https://github.com/fernando-m-vale/superseller-ia
- **PR #17 (US-090):** https://github.com/fernando-m-vale/superseller-ia/pull/17
- **PR #18 (US-100):** https://github.com/fernando-m-vale/superseller-ia/pull/18
- **PR #19 (US-110):** https://github.com/fernando-m-vale/superseller-ia/pull/19
- **Milestone:** Sprint 3 — Connections & Auth

---

**Full Changelog:** https://github.com/fernando-m-vale/superseller-ia/compare/v1.1.0...v1.2.0-beta
