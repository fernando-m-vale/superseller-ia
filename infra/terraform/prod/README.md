# SuperSeller IA - Production Infrastructure

This directory contains the Terraform configuration for the production environment of SuperSeller IA.

## Overview

This infrastructure creates a complete production environment on AWS with:

- **ECS Cluster**: Fargate-based container orchestration
- **Application Load Balancer**: HTTPS traffic routing with SSL/TLS certificates
- **ECR Repositories**: Docker image storage for API and Web applications
- **Security Groups**: Network security for ALB, ECS, and RDS
- **IAM Roles**: Proper permissions for ECS tasks with Secrets Manager access
- **CloudWatch Logs**: Centralized logging for all services
- **Route53 Records**: DNS configuration for api.superselleria.com.br and app.superselleria.com.br
- **ACM Certificates**: SSL/TLS certificates with automatic DNS validation

## Key Features

### Secrets Management

All secrets are managed via **AWS Secrets Manager** (not SSM Parameter Store). The Task Definitions reference secrets using complete ARNs:

- `prod/DB_URL` - Database connection string
- `prod/JWT_SECRET` - JWT signing secret
- `prod/SHOPEE_CLIENT_ID`, `prod/SHOPEE_CLIENT_SECRET`, `prod/SHOPEE_REDIRECT_URI` - Shopee API credentials
- `prod/ML_APP_ID`, `prod/ML_APP_SECRET`, `prod/ML_REDIRECT_URI` - Mercado Livre API credentials
- And more...

### IAM Permissions

The ECS Task Execution Role has been configured with inline policy to access Secrets Manager:

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:us-east-2:234642166969:secret:prod/*"
}
```

This eliminates the "invalid ssm parameters" error by using Secrets Manager exclusively.

## Prerequisites

1. **AWS CLI** configured with credentials
2. **Terraform** >= 1.6.0
3. **Existing VPC** with public and private subnets (tagged with `Tier=public` and `Tier=private`)
4. **Route53 Hosted Zone** for `superselleria.com.br`
5. **Secrets in Secrets Manager** with `prod/*` prefix

## Usage

### Initialize Terraform

```bash
cd infra/terraform/prod
terraform init
```

### Plan Infrastructure Changes

```bash
terraform plan
```

### Apply Infrastructure

```bash
terraform apply
```

Review the plan and type `yes` to confirm.

### View Outputs

After applying, view important resource information:

```bash
terraform output
```

## Configuration

### Variables

Key variables in `variables.tf`:

- `aws_region`: AWS region (default: us-east-2)
- `aws_account_id`: AWS account ID (default: 234642166969)
- `vpc_id`: VPC ID (default: vpc-097386e13a22a9c7b)
- `domain_name`: Root domain (default: superselleria.com.br)
- `api_subdomain`: API subdomain (default: api.superselleria.com.br)
- `app_subdomain`: Web app subdomain (default: app.superselleria.com.br)
- `enable_rds`: Enable RDS PostgreSQL (default: false)
- `api_cpu`: CPU units for API task (default: 256)
- `api_memory`: Memory for API task in MB (default: 512)
- `web_cpu`: CPU units for Web task (default: 256)
- `web_memory`: Memory for Web task in MB (default: 512)

### Customization

To customize the infrastructure, create a `terraform.tfvars` file:

```hcl
api_cpu           = 512
api_memory        = 1024
api_desired_count = 2
enable_rds        = true
```

## Deployment Workflow

After applying the Terraform infrastructure:

1. **Build and push Docker images** to ECR:
   ```bash
   # API
   docker build -t superseller/api:latest apps/api
   aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 234642166969.dkr.ecr.us-east-2.amazonaws.com
   docker tag superseller/api:latest 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/api:latest
   docker push 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/api:latest
   
   # Web
   docker build -t superseller/web:latest apps/web
   docker tag superseller/web:latest 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/web:latest
   docker push 234642166969.dkr.ecr.us-east-2.amazonaws.com/superseller/web:latest
   ```

2. **Update ECS services** to use new task definitions:
   ```bash
   aws ecs update-service --cluster superseller-prod-cluster --service superseller-api-svc --force-new-deployment
   aws ecs update-service --cluster superseller-prod-cluster --service superseller-web-svc --force-new-deployment
   ```

3. **Monitor deployment**:
   ```bash
   aws ecs describe-services --cluster superseller-prod-cluster --services superseller-api-svc superseller-web-svc
   ```

4. **Check logs**:
   ```bash
   aws logs tail /ecs/superseller/api --follow
   aws logs tail /ecs/superseller/web --follow
   ```

## Troubleshooting

### Secrets Manager Access Issues

If you see errors like "unable to retrieve secrets from ssm", ensure:

1. Secrets exist in Secrets Manager with `prod/*` prefix
2. Task Execution Role has `secretsmanager:GetSecretValue` permission
3. Secret ARNs in Task Definitions match actual secrets

### Service Not Starting

Check CloudWatch Logs:

```bash
aws logs tail /ecs/superseller/api --follow
```

Common issues:
- Missing or invalid secrets
- Database connection failures
- Port conflicts

### DNS Not Resolving

Verify Route53 records:

```bash
aws route53 list-resource-record-sets --hosted-zone-id <zone-id>
```

Ensure ACM certificates are validated and attached to ALB listener.

## Migration from Manual Setup

If you have existing ECS resources created manually:

1. **Apply this Terraform configuration** to create new resources
2. **Update DNS records** to point to new ALB
3. **Test the new infrastructure** thoroughly
4. **Delete old manual resources** via AWS Console or CLI

## Security Considerations

- All secrets are stored in AWS Secrets Manager (encrypted at rest)
- ECS tasks run in private subnets (no public IPs)
- ALB handles SSL/TLS termination with ACM certificates
- Security groups follow principle of least privilege
- CloudWatch Logs retention set to 7 days (adjust as needed)

## Cost Optimization

Current configuration uses:
- Fargate Spot for cost savings (with Fargate as fallback)
- Minimal task sizes (256 CPU, 512 MB memory)
- Single task per service (scale as needed)
- 7-day log retention

To reduce costs further:
- Use Fargate Spot exclusively
- Reduce log retention
- Scale down during off-hours

## Support

For issues or questions, contact the infrastructure team or refer to the main project documentation.
