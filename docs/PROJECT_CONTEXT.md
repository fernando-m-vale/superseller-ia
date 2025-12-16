# Super Seller IA — Project Context

## Vision
Super Seller IA is an AI-powered co-pilot for marketplace sellers (Mercado Livre, Shopee),
focused on improving listing performance through diagnostics, scoring, and actionable recommendations.

## Current Stage
- Closed beta
- Real sellers with real data
- Focus on ROI and activation

## Architecture
- Frontend: Next.js 14
- Backend: Fastify (Node.js)
- DB: PostgreSQL (RDS)
- Infra: AWS App Runner + Terraform
- Auth: JWT (access + refresh)
- AI: OpenAI (GPT-4o)

## Core Flows
1. Seller connects marketplace
2. Listings and metrics are synced
3. Health score is calculated
4. AI generates:
   - critique
   - growth hacks
   - SEO suggestions
5. Recommendations are saved and shown to the user

## What is working
- Auth
- Sync
- Dashboards
- AI connectivity (OpenAI OK)

## Current Focus
- Make AI insights valuable and consistent
- Prepare closed beta (10–20 sellers)
- Measure ROI

## Things to avoid
- Overengineering
- Premature automation
- Exposing secrets or debug endpoints
