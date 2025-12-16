Super Seller IA - Production Deployment Guide (App Runner)

This document provides updated instructions for deploying the Super Seller IA platform to production on AWS using App Runner.

(Note: We migrated from ECS to App Runner for simplified management).

Table of Contents

Overview

Prerequisites

Infrastructure Provisioning

Deployment Flow

Secrets & Environment

Overview

The production environment runs on AWS App Runner, a fully managed service for containerized applications. It connects directly to ECR and handles load balancing, scaling, and SSL automatically.

Architecture

Web Service: superseller-web (Port 3000)

API Service: superseller-api (Port 3001)

Database: RDS PostgreSQL (Private VPC)

Networking: VPC Connector allows App Runner to talk to RDS.

Prerequisites

1. AWS Secrets Manager

Ensure the following secrets exist in us-east-2:

prod/superseller/database-url

prod/OPENAI_API_KEY (Required for AI features)

prod/auth/secret (NextAuth)

2. ECR Repositories

superseller-web

superseller-api

Deployment Flow

Automatic Deployment (CI/CD)

Pushing to the main branch triggers the GitHub Action .github/workflows/deploy.yml:

Builds Docker images.

Pushes to ECR.

App Runner automatically detects the new image and starts a rolling deployment.

Manual Deployment (If needed)

If auto-deploy is disabled or stuck:

# Trigger deployment for Web
aws apprunner start-deployment \
    --service-arn arn:aws:apprunner:us-east-2:234642166969:service/superseller-web/...

# Trigger deployment for API
aws apprunner start-deployment \
    --service-arn arn:aws:apprunner:us-east-2:234642166969:service/superseller-api/...


Secrets & Environment Variables

App Runner injects secrets at runtime via RuntimeEnvironmentSecrets.

Important: If you add a new secret (like OPENAI_API_KEY), you must update the App Runner configuration via Terraform or AWS CLI to "link" the secret. Just creating it in Secrets Manager is not enough.

Terraform Location:
/infra/terraform/prod/app-runner.tf

Troubleshooting

Logs:
View application logs directly in the AWS Console > App Runner > Service > Logs.

Database Migrations:
Migrations run automatically on API startup (defined in Dockerfile).
If a migration fails, the deployment will fail. Check logs for Prisma Migrate errors.