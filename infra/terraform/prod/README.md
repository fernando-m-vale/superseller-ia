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
# Super Seller IA - Production Infrastructure

This directory contains Terraform configuration for provisioning the complete production infrastructure on AWS.

## Architecture Overview

The infrastructure includes:

- **ECR Repositories**: Docker image storage for API and Web applications
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: HTTPS traffic distribution with path-based routing
- **ACM Certificates**: SSL/TLS certificates for api.superselleria.com.br and app.superselleria.com.br
- **Route53 DNS**: DNS records for both subdomains
- **Security Groups**: Network isolation for ALB, ECS, and RDS
- **IAM Roles**: Task and execution roles with least-privilege access
- **CloudWatch Logs**: Centralized logging for all services
- **RDS PostgreSQL** (optional): Managed database service

## Prerequisites

1. **AWS Credentials**: Configured via GitHub OIDC (role: `superseller-github-oidc-dev`)
2. **Existing Resources**:
   - VPC: `vpc-097386e13a22a9c7b`
   - Route53 Hosted Zone: `superselleria.com.br`
   - AWS Secrets Manager secrets (see below)

## Required Secrets

The following secrets must exist in AWS Secrets Manager before deployment:

```
prod/DB_SSELLERIA          - Database connection URL
prod/JWT_SECRET            - JWT signing secret
prod/ML_APP_ID             - Mercado Livre App ID
prod/ML_APP_SECRET         - Mercado Livre App Secret
prod/ML_REDIRECT_URI       - Mercado Livre OAuth redirect URI
prod/SHOPEE_CLIENT_ID      - Shopee Client ID
prod/SHOPEE_CLIENT_SECRET  - Shopee Client Secret
prod/SHOPEE_REDIRECT_URI   - Shopee OAuth redirect URI
prod/NEXT_PUBLIC_API_URL   - API URL for frontend (https://api.superselleria.com.br/api/v1)
```

## Infrastructure Components

### Networking

- **VPC**: Uses existing VPC `vpc-097386e13a22a9c7b`
- **Subnets**: Automatically discovers public and private subnets
  - Public subnets: Used for ALB (internet-facing)
  - Private subnets: Used for ECS tasks and RDS

### Security Groups

1. **ALB Security Group** (`superseller-prod-alb-sg`)
   - Ingress: 80 (HTTP), 443 (HTTPS) from 0.0.0.0/0
   - Egress: All traffic

2. **ECS Security Group** (`superseller-prod-ecs-sg`)
   - Ingress: 3000 (Web), 3001 (API) from ALB only
   - Egress: All traffic

3. **RDS Security Group** (`superseller-prod-rds-sg`) - if enabled
   - Ingress: 5432 (PostgreSQL) from ECS only
   - Egress: All traffic

### Container Services

- **ECS Cluster**: `superseller-prod-cluster`
- **API Service**: `superseller-api-svc`
  - Task: 512 CPU, 1024 MB memory
  - Port: 3001
  - Health check: `/health`
- **Web Service**: `superseller-web-svc`
  - Task: 512 CPU, 1024 MB memory
  - Port: 3000
  - Health check: `/`

### Load Balancing

- **ALB**: `superseller-prod-alb`
- **Listeners**:
  - Port 80: Redirects to HTTPS
  - Port 443: Routes traffic based on host header
- **Target Groups**:
  - API: Routes `api.superselleria.com.br` → API service
  - Web: Routes `app.superselleria.com.br` → Web service

### DNS & Certificates

- **ACM Certificates**: Auto-validated via Route53 DNS
  - `api.superselleria.com.br`
  - `app.superselleria.com.br`
- **Route53 Records**: A and AAAA aliases to ALB

### Database (Optional)

RDS PostgreSQL can be enabled by setting `enable_rds = true`:

- Engine: PostgreSQL 15
- Instance: db.t3.micro
- Storage: 20 GB (auto-scaling up to 100 GB)
- Multi-AZ: Disabled (can be enabled for production)
- Backups: 7-day retention
- Encryption: Enabled

## Usage

### Initial Setup

1. **Configure AWS credentials** (via GitHub OIDC in CI/CD):
   ```bash
   # This is handled automatically by GitHub Actions
   # Role: arn:aws:iam::234642166969:role/superseller-github-oidc-dev
   ```

2. **Initialize Terraform**:
   ```bash
   cd infra/terraform/prod
   terraform init
   ```

3. **Review the plan**:
   ```bash
   terraform plan
   ```

4. **Apply the infrastructure**:
   ```bash
   terraform apply
   ```

### Enabling RDS

To enable RDS PostgreSQL:

```bash
terraform apply -var="enable_rds=true"
```

**Note**: When RDS is disabled (default), the API must handle missing database connections gracefully or use an external database.

### Updating Infrastructure

1. Modify the Terraform files as needed
2. Run `terraform plan` to review changes
3. Run `terraform apply` to apply changes

### Destroying Infrastructure

```bash
terraform destroy
```

**Warning**: This will delete all resources including data. Ensure backups are taken before destroying.

## Variables

Key variables can be customized in `variables.tf`:

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `us-east-2` | AWS region |
| `vpc_id` | `vpc-097386e13a22a9c7b` | VPC ID |
| `domain_name` | `superselleria.com.br` | Root domain |
| `enable_rds` | `false` | Enable RDS PostgreSQL |
| `api_desired_count` | `1` | Number of API tasks |
| `web_desired_count` | `1` | Number of Web tasks |

## Outputs

After applying, Terraform outputs important values:

```bash
terraform output
```

Key outputs:
- `api_url`: https://api.superselleria.com.br
- `web_url`: https://app.superselleria.com.br
- `alb_dns_name`: ALB DNS name
- `ecs_cluster_name`: ECS cluster name
- `api_service_name`: API service name
- `web_service_name`: Web service name

## Deployment Workflow

1. **Provision Infrastructure** (this Terraform)
   - Creates ECR, ECS, ALB, ACM, Route53, etc.

2. **Build & Push Images** (GitHub Actions)
   - Builds Docker images
   - Pushes to ECR

3. **Deploy Services** (GitHub Actions)
   - Updates ECS task definitions
   - Deploys to ECS services
   - Waits for stability

## Monitoring

- **CloudWatch Logs**:
  - API: `/ecs/superseller-api`
  - Web: `/ecs/superseller-web`

- **Container Insights**: Enabled on ECS cluster

- **ALB Health Checks**:
  - API: `GET /health` (expect 200)
  - Web: `GET /` (expect 200)

## Troubleshooting

### Subnet Discovery Issues

If automatic subnet discovery fails:

1. List subnets manually:
   ```bash
   aws ec2 describe-subnets --filters Name=vpc-id,Values=vpc-097386e13a22a9c7b
   ```

2. Identify public subnets (those with route to IGW)

3. Update `main.tf` with explicit subnet IDs if needed

### Certificate Validation

ACM certificates are validated via DNS. If validation hangs:

1. Check Route53 for validation records
2. Ensure hosted zone is correct
3. Wait up to 30 minutes for DNS propagation

### ECS Service Not Starting

1. Check CloudWatch Logs for container errors
2. Verify secrets exist in Secrets Manager
3. Check security group rules
4. Verify subnet has internet access (via NAT Gateway)

## Security Considerations

- All traffic uses HTTPS (HTTP redirects to HTTPS)
- ECS tasks run in private subnets
- Secrets stored in AWS Secrets Manager
- IAM roles follow least-privilege principle
- Security groups restrict traffic to necessary ports
- RDS encryption enabled
- CloudWatch logging enabled

## Cost Optimization

Current configuration (without RDS):
- ECS Fargate: ~$30-40/month (2 tasks)
- ALB: ~$20/month
- Data transfer: Variable
- **Total**: ~$50-60/month

With RDS (db.t3.micro):
- Add ~$15-20/month

## Next Steps

After infrastructure is provisioned:

1. Deploy API and Web applications via GitHub Actions
2. Configure WAF rules for ALB
3. Set up auto-scaling policies
4. Configure RDS backups and snapshots
5. Set up CloudWatch alarms
6. Enable AWS Config for compliance
7. Configure VPC Flow Logs

## Support

For issues or questions:
- GitHub Issues: https://github.com/fernando-m-vale/superseller-ia/issues
- Documentation: `/docs/prod-deploy.md`
