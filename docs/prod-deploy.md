# Super Seller IA - Production Deployment Guide

This document provides step-by-step instructions for deploying the Super Seller IA platform to production on AWS.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Provisioning](#infrastructure-provisioning)
4. [Application Deployment](#application-deployment)
5. [Validation Checklist](#validation-checklist)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Overview

The production deployment consists of three main phases:

1. **Infrastructure Provisioning**: Create AWS resources using Terraform
2. **Application Deployment**: Build and deploy Docker images to ECS
3. **Validation**: Verify all services are running and accessible

### Architecture

- **Region**: us-east-2 (Ohio)
- **VPC**: vpc-097386e13a22a9c7b
- **Domain**: superselleria.com.br
- **Endpoints**:
  - API: https://api.superselleria.com.br
  - Web: https://app.superselleria.com.br

### Key Resources

- **ECR**: Docker image repositories
- **ECS Fargate**: Serverless container orchestration
- **ALB**: Application Load Balancer with HTTPS
- **ACM**: SSL/TLS certificates
- **Route53**: DNS management
- **CloudWatch**: Logging and monitoring
- **Secrets Manager**: Secure credential storage

---

## Prerequisites

### 1. AWS Account Setup

- **Account ID**: 234642166969
- **Region**: us-east-2
- **OIDC Role**: superseller-github-oidc-dev (already configured)

### 2. GitHub Repository Variables

Ensure the following repository variables are set:

```
OIDC_ROLE=superseller-github-oidc-dev
```

To verify:
```bash
gh variable list
```

### 3. AWS Secrets Manager

The following secrets must exist before deployment:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `prod/DB_SSELLERIA` | Database connection URL | `postgresql://user:pass@host:5432/db` |
| `prod/JWT_SECRET` | JWT signing secret | Random 32+ character string |
| `prod/ML_APP_ID` | Mercado Livre App ID | From ML Developer Portal |
| `prod/ML_APP_SECRET` | Mercado Livre App Secret | From ML Developer Portal |
| `prod/ML_REDIRECT_URI` | ML OAuth redirect | `https://api.superselleria.com.br/api/v1/connectors/mercadolivre/oauth/callback` |
| `prod/SHOPEE_CLIENT_ID` | Shopee Client ID | From Shopee Open Platform |
| `prod/SHOPEE_CLIENT_SECRET` | Shopee Client Secret | From Shopee Open Platform |
| `prod/SHOPEE_REDIRECT_URI` | Shopee OAuth redirect | `https://api.superselleria.com.br/api/v1/connectors/shopee/oauth/callback` |
| `prod/NEXT_PUBLIC_API_URL` | API URL for frontend | `https://api.superselleria.com.br/api/v1` |

To verify secrets exist:
```bash
aws secretsmanager list-secrets --region us-east-2 | grep prod/
```

### 4. Existing AWS Resources

The following resources must already exist:

- **VPC**: vpc-097386e13a22a9c7b
  - At least 2 public subnets (for ALB)
  - At least 2 private subnets (for ECS)
  - Internet Gateway attached
  - NAT Gateway(s) for private subnet internet access
- **Route53 Hosted Zone**: superselleria.com.br

---

## Infrastructure Provisioning

### Step 1: Run Terraform Plan

First, review what resources will be created:

1. Navigate to GitHub Actions
2. Select "Infrastructure Apply (Terraform)" workflow
3. Click "Run workflow"
4. Select:
   - **Action**: `plan`
   - **Enable RDS**: `false` (default, can enable later)
5. Click "Run workflow"

The workflow will:
- Initialize Terraform
- Validate configuration
- Generate execution plan
- Upload plan as artifact

**Review the plan output** in the workflow summary to ensure all resources are correct.

### Step 2: Apply Infrastructure

Once the plan is reviewed and approved:

1. Navigate to GitHub Actions
2. Select "Infrastructure Apply (Terraform)" workflow
3. Click "Run workflow"
4. Select:
   - **Action**: `apply`
   - **Enable RDS**: `false` (or `true` if needed)
5. Click "Run workflow"

The workflow will:
- Apply the Terraform plan
- Create all AWS resources
- Output resource ARNs and URLs

**Expected Duration**: 10-15 minutes (ACM certificate validation takes the longest)

### Step 3: Verify Infrastructure

After Terraform completes, verify the following resources were created:

#### ECR Repositories
```bash
aws ecr describe-repositories --region us-east-2 --repository-names superseller/api superseller/web
```

Expected output: Two repositories

#### ECS Cluster
```bash
aws ecs describe-clusters --region us-east-2 --clusters superseller-prod-cluster
```

Expected output: Cluster with status ACTIVE

#### ALB
```bash
aws elbv2 describe-load-balancers --region us-east-2 --names superseller-prod-alb
```

Expected output: Load balancer with state "active"

#### ACM Certificates
```bash
aws acm list-certificates --region us-east-2 | grep superselleria.com.br
```

Expected output: Two certificates with status ISSUED

#### Route53 Records
```bash
aws route53 list-resource-record-sets --hosted-zone-id $(aws route53 list-hosted-zones --query "HostedZones[?Name=='superselleria.com.br.'].Id" --output text)
```

Expected output: A records for api.superselleria.com.br and app.superselleria.com.br

---

## Application Deployment

### Step 1: Deploy API

1. Navigate to GitHub Actions
2. Select "Deploy API (ECS)" workflow
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow"

The workflow will:
- Build Docker image from `apps/api/`
- Push image to ECR
- Update ECS task definition
- Deploy to ECS service
- Wait for service stability
- Validate health endpoint

**Expected Duration**: 5-8 minutes

**Success Criteria**:
- Workflow completes successfully
- Health check passes: `curl https://api.superselleria.com.br/health` returns `{"status":"ok"}`

### Step 2: Deploy Web

1. Navigate to GitHub Actions
2. Select "Deploy WEB (ECS)" workflow
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow"

The workflow will:
- Build Docker image from `apps/web/`
- Push image to ECR
- Update ECS task definition
- Deploy to ECS service
- Wait for service stability
- Validate web endpoint

**Expected Duration**: 5-8 minutes

**Success Criteria**:
- Workflow completes successfully
- Web endpoint accessible: `curl -I https://app.superselleria.com.br/` returns HTTP 200

---

## Validation Checklist

After deployment, verify all components are working:

### Infrastructure Validation

- [ ] **ALB Health Checks**: All target groups show healthy targets
  ```bash
  aws elbv2 describe-target-health --region us-east-2 --target-group-arn <API_TG_ARN>
  aws elbv2 describe-target-health --region us-east-2 --target-group-arn <WEB_TG_ARN>
  ```

- [ ] **ECS Services**: Both services show RUNNING status
  ```bash
  aws ecs describe-services --region us-east-2 --cluster superseller-prod-cluster --services superseller-api-svc superseller-web-svc
  ```

- [ ] **DNS Resolution**: Domains resolve to ALB
  ```bash
  dig api.superselleria.com.br
  dig app.superselleria.com.br
  ```

- [ ] **SSL Certificates**: HTTPS works without warnings
  ```bash
  curl -vI https://api.superselleria.com.br/health 2>&1 | grep "SSL certificate verify ok"
  curl -vI https://app.superselleria.com.br/ 2>&1 | grep "SSL certificate verify ok"
  ```

### Application Validation

- [ ] **API Health Endpoint**
  ```bash
  curl https://api.superselleria.com.br/health
  ```
  Expected: `{"status":"ok"}`

- [ ] **API CORS Headers**
  ```bash
  curl -I https://api.superselleria.com.br/health
  ```
  Expected: `Access-Control-Allow-Origin` header present

- [ ] **Web Application**: Open https://app.superselleria.com.br/ in browser
  - [ ] Page loads without errors
  - [ ] No console errors
  - [ ] Can navigate to different pages
  - [ ] API calls work (check Network tab)

- [ ] **CloudWatch Logs**: Logs are being written
  ```bash
  aws logs tail /ecs/superseller-api --region us-east-2 --follow
  aws logs tail /ecs/superseller-web --region us-east-2 --follow
  ```

### Security Validation

- [ ] **HTTP to HTTPS Redirect**
  ```bash
  curl -I http://api.superselleria.com.br/health
  ```
  Expected: 301 redirect to HTTPS

- [ ] **Security Headers**: Check for security headers
  ```bash
  curl -I https://api.superselleria.com.br/health | grep -E "(Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options)"
  ```

- [ ] **Secrets Access**: Verify tasks can access secrets (check logs for connection success)

---

## Troubleshooting

### Common Issues

#### 1. ACM Certificate Validation Stuck

**Symptom**: Terraform hangs on certificate validation

**Solution**:
1. Check Route53 for validation records:
   ```bash
   aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID> | grep _acm-challenge
   ```
2. Wait up to 30 minutes for DNS propagation
3. If still stuck, check that hosted zone is correct

#### 2. ECS Tasks Not Starting

**Symptom**: ECS service shows 0 running tasks

**Solution**:
1. Check CloudWatch Logs for errors:
   ```bash
   aws logs tail /ecs/superseller-api --region us-east-2 --since 30m
   ```
2. Common causes:
   - Missing secrets in Secrets Manager
   - Incorrect IAM permissions
   - Container health check failing
   - No available private subnets with NAT Gateway

#### 3. ALB Health Checks Failing

**Symptom**: Target group shows unhealthy targets

**Solution**:
1. Check target health:
   ```bash
   aws elbv2 describe-target-health --target-group-arn <TG_ARN>
   ```
2. Common causes:
   - Security group not allowing traffic from ALB
   - Container not listening on correct port
   - Health check path incorrect
   - Application not starting properly

#### 4. DNS Not Resolving

**Symptom**: Domain doesn't resolve or resolves to wrong IP

**Solution**:
1. Check Route53 records:
   ```bash
   aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID>
   ```
2. Verify ALB DNS name matches Route53 alias target
3. Wait for DNS propagation (up to 5 minutes)

#### 5. 502 Bad Gateway

**Symptom**: ALB returns 502 error

**Solution**:
1. Check if ECS tasks are running
2. Check security group allows ALB → ECS traffic
3. Check container logs for application errors
4. Verify health check endpoint is responding

### Debugging Commands

```bash
# View ECS service events
aws ecs describe-services --cluster superseller-prod-cluster --services superseller-api-svc --region us-east-2 --query 'services[0].events[0:10]'

# View ECS task details
aws ecs list-tasks --cluster superseller-prod-cluster --service-name superseller-api-svc --region us-east-2
aws ecs describe-tasks --cluster superseller-prod-cluster --tasks <TASK_ARN> --region us-east-2

# View CloudWatch Logs
aws logs tail /ecs/superseller-api --region us-east-2 --follow --format short

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn <TG_ARN> --region us-east-2

# Test endpoint from within VPC (if you have access)
aws ssm start-session --target <EC2_INSTANCE_ID>
curl http://<PRIVATE_IP>:3001/health
```

---

## Rollback Procedures

### Rolling Back Application Deployment

If a deployment causes issues:

1. **Identify Previous Task Definition**:
   ```bash
   aws ecs list-task-definitions --family-prefix superseller-api --region us-east-2 --sort DESC
   ```

2. **Update Service to Previous Revision**:
   ```bash
   aws ecs update-service \
     --cluster superseller-prod-cluster \
     --service superseller-api-svc \
     --task-definition superseller-api:<PREVIOUS_REVISION> \
     --region us-east-2
   ```

3. **Wait for Stability**:
   ```bash
   aws ecs wait services-stable \
     --cluster superseller-prod-cluster \
     --services superseller-api-svc \
     --region us-east-2
   ```

### Rolling Back Infrastructure Changes

**Warning**: Infrastructure rollback can be destructive. Always backup data first.

1. **Revert Terraform Changes**:
   ```bash
   cd infra/terraform/prod
   git checkout <PREVIOUS_COMMIT>
   terraform plan
   terraform apply
   ```

2. **Or Destroy and Recreate** (if safe):
   ```bash
   terraform destroy -target=<SPECIFIC_RESOURCE>
   terraform apply
   ```

---

## Monitoring and Maintenance

### CloudWatch Dashboards

Create custom dashboards for:
- ECS CPU/Memory utilization
- ALB request count and latency
- Target group health
- API error rates

### CloudWatch Alarms

Recommended alarms:
- ECS CPU > 80% for 5 minutes
- ECS Memory > 80% for 5 minutes
- ALB 5XX errors > 10 in 5 minutes
- Target group unhealthy targets > 0 for 2 minutes
- API health check failures

### Log Retention

Current retention: 7 days

To increase:
```bash
aws logs put-retention-policy --log-group-name /ecs/superseller-api --retention-in-days 30 --region us-east-2
aws logs put-retention-policy --log-group-name /ecs/superseller-web --retention-in-days 30 --region us-east-2
```

### Cost Monitoring

Monitor costs in AWS Cost Explorer:
- Filter by tag: `Project=SuperSellerIA`
- Set budget alerts
- Review monthly spend

Expected monthly costs (without RDS):
- ECS Fargate: $30-40
- ALB: $20
- Data Transfer: $10-20
- **Total**: ~$60-80/month

### Backup and Disaster Recovery

1. **ECR Images**: Retained with lifecycle policy (last 10 images)
2. **RDS Backups** (if enabled): 7-day retention
3. **Terraform State**: Stored locally (consider migrating to S3)
4. **Secrets**: Backed up in Secrets Manager with versioning

### Scaling

To scale services:

```bash
# Scale API service
aws ecs update-service \
  --cluster superseller-prod-cluster \
  --service superseller-api-svc \
  --desired-count 2 \
  --region us-east-2

# Scale Web service
aws ecs update-service \
  --cluster superseller-prod-cluster \
  --service superseller-web-svc \
  --desired-count 2 \
  --region us-east-2
```

Or update Terraform variables:
```hcl
api_desired_count = 2
web_desired_count = 2
```

---

## Next Steps

After successful deployment:

1. **Enable Auto Scaling**: Configure ECS auto-scaling based on CPU/memory
2. **Add WAF**: Protect ALB with AWS WAF rules
3. **Enable RDS**: Provision production database
4. **Set Up Monitoring**: Create CloudWatch dashboards and alarms
5. **Configure Backups**: Set up automated RDS snapshots
6. **Enable VPC Flow Logs**: For network traffic analysis
7. **Set Up CI/CD**: Automate deployments on merge to main
8. **Load Testing**: Verify performance under load
9. **Security Audit**: Run AWS Security Hub and Trusted Advisor
10. **Documentation**: Update runbooks and incident response procedures

---

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/fernando-m-vale/superseller-ia/issues
- **Infrastructure Code**: `/infra/terraform/prod/`
- **Workflows**: `/.github/workflows/`

## References

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
