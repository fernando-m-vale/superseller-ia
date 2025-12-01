# GitHub OIDC Authentication for AWS

This document explains how GitHub Actions authenticates to AWS using OpenID Connect (OIDC) for the superseller-ia project.

## Overview

OIDC allows GitHub Actions to authenticate to AWS without storing long-lived credentials (Access Keys) in the repository. Instead, GitHub generates short-lived tokens that AWS validates against a trust policy.

## Architecture

```
GitHub Actions Workflow
    ↓ (requests token)
GitHub OIDC Provider (token.actions.githubusercontent.com)
    ↓ (provides JWT token with 'sub' claim)
AWS IAM OIDC Provider
    ↓ (validates token against trust policy)
IAM Role (superseller-github-oidc-dev)
    ↓ (assumes role)
AWS Services (ECR, App Runner, Secrets Manager)
```

## Configuration

### AWS Side

#### 1. OIDC Provider
The OIDC provider must be configured in AWS IAM:
- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`
- **ARN**: `arn:aws:iam::234642166969:oidc-provider/token.actions.githubusercontent.com`

#### 2. IAM Role
The IAM role that GitHub Actions will assume:
- **Role Name**: `superseller-github-oidc-dev`
- **ARN**: `arn:aws:iam::234642166969:role/superseller-github-oidc-dev`
- **Trust Policy**: See `iam/trust-policy-restrictive.json` or `iam/trust-policy-permissive.json`

#### 3. Trust Policy

The trust policy determines which GitHub workflows can assume the role. Two variants are provided:

**Restrictive (Recommended for Production)**
- File: `iam/trust-policy-restrictive.json`
- Allows only: `repo:fernando-m-vale/superseller-ia:ref:refs/heads/main`
- Use this to restrict access to only the main branch

**Permissive (Easier for Testing)**
- File: `iam/trust-policy-permissive.json`
- Allows: `repo:fernando-m-vale/superseller-ia:*`
- Use this temporarily to allow all branches, PRs, and tags

#### 4. IAM Permissions (App Runner)

The role must have permissions to deploy to App Runner. Use the policy in `infra/oidc/apprunner-deploy-policy.json`:

**App Runner Permissions:**
- `apprunner:StartDeployment` - Trigger new deployments
- `apprunner:DescribeService` - Check deployment status
- `apprunner:ListServices` - List available services

**ECR Permissions:**
- `ecr:GetAuthorizationToken` - Login to ECR
- `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload` - Push images

**Secrets Manager:**
- `secretsmanager:GetSecretValue` - Read build-time secrets (e.g., NEXT_PUBLIC_API_URL)

##### Apply App Runner Deploy Policy

```bash
# Create the policy
aws iam create-policy \
  --policy-name superseller-apprunner-deploy \
  --policy-document file://infra/oidc/apprunner-deploy-policy.json

# Attach to the OIDC role
aws iam attach-role-policy \
  --role-name superseller-github-oidc-dev \
  --policy-arn arn:aws:iam::234642166969:policy/superseller-apprunner-deploy
```

### GitHub Side

#### Required Variables
Configure these in GitHub: **Settings → Secrets and variables → Actions → Variables**

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `AWS_ACCOUNT_ID` | `234642166969` | AWS account ID |
| `AWS_REGION` | `us-east-2` | AWS region for resources |
| `OIDC_ROLE` | `superseller-github-oidc-dev` | IAM role name to assume |
| `ECR_API_REPO` | `superseller/api` | ECR repository for API |
| `ECR_WEB_REPO` | `superseller/web` | ECR repository for WEB |

**Note:** ECS-related variables (`ECS_CLUSTER_NAME`, `ECS_SERVICE_*`) are no longer needed with App Runner.

#### Workflow Configuration
All workflows that need AWS access must include:

```yaml
permissions:
  id-token: write  # Required for OIDC token
  contents: read   # Required for checkout

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Validate required variables
        run: |
          test -n "${{ vars.OIDC_ROLE }}" || (echo "ERROR: Repository variable OIDC_ROLE is not defined"; exit 1)
          test -n "${{ vars.AWS_ACCOUNT_ID }}" || (echo "ERROR: AWS_ACCOUNT_ID missing"; exit 1)
          test -n "${{ vars.AWS_REGION }}" || (echo "ERROR: AWS_REGION missing"; exit 1)

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ vars.AWS_ACCOUNT_ID }}:role/${{ vars.OIDC_ROLE }}
          aws-region: ${{ vars.AWS_REGION }}
```

## App Runner Service ARNs

The deploy workflows use these App Runner service ARNs (defined in the workflow files):

| Service | ARN |
|---------|-----|
| API | `arn:aws:apprunner:us-east-2:234642166969:service/superseller-api/8586afa61cff49f0b03ee6a5675772aa` |
| WEB | `arn:aws:apprunner:us-east-2:234642166969:service/superseller-web/bfc34e44dba340259ae9812f392fe204` |

To get the current ARNs from Terraform:
```bash
cd infra/terraform/prod
terraform output apprunner_api_service_arn
terraform output apprunner_web_service_arn
```

## OIDC 'sub' Claim Patterns

The `sub` claim in the OIDC token identifies the workflow context. Different triggers produce different patterns:

| Trigger | Example `sub` Claim |
|---------|-------------------|
| Push to main | `repo:fernando-m-vale/superseller-ia:ref:refs/heads/main` |
| Push to branch | `repo:fernando-m-vale/superseller-ia:ref:refs/heads/feature-branch` |
| Pull request | `repo:fernando-m-vale/superseller-ia:pull_request` |
| Tag | `repo:fernando-m-vale/superseller-ia:ref:refs/tags/v1.0.0` |
| Workflow dispatch | `repo:fernando-m-vale/superseller-ia:ref:refs/heads/main` (depends on branch) |

## Validation Workflows

### 1. Validate AWS Auth
**File**: `.github/workflows/validate-aws-auth.yml`

**Purpose**: Diagnose OIDC authentication issues

**How to run**:
```bash
# Via GitHub UI: Actions → Validate AWS Auth (OIDC) → Run workflow
# Or automatically on push to main or pull requests
```

**What it checks**:
- Prints GitHub context (repository, ref, event)
- Shows expected `sub` claim pattern
- Attempts AWS authentication via OIDC
- Lists ECR repositories
- Describes App Runner services
- Provides troubleshooting guidance

### 2. Pre-Deploy Readiness
**File**: `.github/workflows/pre-deploy-readiness.yml`

**Purpose**: Validate AWS infrastructure is ready for deployment

**How to run**:
```bash
# Via GitHub UI: Actions → Pre-Deploy Readiness Check → Run workflow
```

**What it checks**:
- ✅ ECR repositories exist
- ✅ App Runner services exist and are RUNNING
- ⚠️  CloudWatch log groups exist (optional)
- ✅ Route53 hosted zone exists
- ⚠️  Secrets Manager secrets exist

## Troubleshooting

### Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Cause**: The trust policy doesn't allow the workflow's `sub` claim.

**Solution**:
1. Run the `validate-aws-auth.yml` workflow to see the expected `sub` claim
2. Compare it with your trust policy in AWS IAM
3. Update the trust policy to include the correct pattern:
   - For restrictive: `repo:fernando-m-vale/superseller-ia:ref:refs/heads/main`
   - For permissive: `repo:fernando-m-vale/superseller-ia:*`
4. Apply the trust policy:
   ```bash
   aws iam update-assume-role-policy \
     --role-name superseller-github-oidc-dev \
     --policy-document file://iam/trust-policy-permissive.json
   ```

### Error: "Not authorized to perform apprunner:StartDeployment"

**Cause**: The IAM role doesn't have App Runner permissions.

**Solution**:
1. Apply the App Runner deploy policy:
   ```bash
   aws iam create-policy \
     --policy-name superseller-apprunner-deploy \
     --policy-document file://infra/oidc/apprunner-deploy-policy.json

   aws iam attach-role-policy \
     --role-name superseller-github-oidc-dev \
     --policy-arn arn:aws:iam::234642166969:policy/superseller-apprunner-deploy
   ```

### Error: "No OIDC provider found"

**Cause**: The OIDC provider is not configured in AWS.

**Solution**:
1. Create the OIDC provider in AWS IAM Console:
   - Go to IAM → Identity providers → Add provider
   - Provider type: OpenID Connect
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. Or via CLI:
   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

### Error: "Role not found"

**Cause**: The IAM role doesn't exist.

**Solution**:
1. Create the role in AWS IAM Console or via CLI
2. Attach the trust policy from `iam/trust-policy-permissive.json`
3. Attach necessary permissions (ECR, App Runner, Secrets Manager)

### Error: "Access Denied" after successful authentication

**Cause**: The role lacks necessary permissions.

**Solution**:
1. Review the specific AWS API call that failed
2. Add the required permission to the role's policy
3. Common permissions needed:
   - `ecr:*` for ECR operations
   - `apprunner:*` for App Runner operations
   - `secretsmanager:GetSecretValue` for secrets

### Workflow doesn't trigger

**Cause**: Missing `permissions` block in workflow.

**Solution**:
Ensure the workflow has:
```yaml
permissions:
  id-token: write
  contents: read
```

### Variables not set

**Cause**: GitHub Variables are not configured.

**Solution**:
1. Go to GitHub: Settings → Secrets and variables → Actions → Variables
2. Add all required variables (see table above)
3. Verify variable names match exactly (case-sensitive)

## Applying Trust Policy to AWS

After reviewing the trust policy files, apply one to your IAM role:

### Option 1: Via AWS Console
1. Go to IAM → Roles → superseller-github-oidc-dev
2. Click "Trust relationships" tab
3. Click "Edit trust policy"
4. Copy contents from `iam/trust-policy-restrictive.json` or `iam/trust-policy-permissive.json`
5. Click "Update policy"

### Option 2: Via AWS CLI
```bash
# For restrictive (main branch only)
aws iam update-assume-role-policy \
  --role-name superseller-github-oidc-dev \
  --policy-document file://iam/trust-policy-restrictive.json

# For permissive (all refs)
aws iam update-assume-role-policy \
  --role-name superseller-github-oidc-dev \
  --policy-document file://iam/trust-policy-permissive.json
```

## Testing

After applying the trust policy:

1. **Run validation workflow**:
   - Go to Actions → Validate AWS Auth (OIDC) → Run workflow
   - Check the logs for successful authentication
   - Verify `aws sts get-caller-identity` shows the correct role

2. **Run readiness check**:
   - Go to Actions → Pre-Deploy Readiness Check → Run workflow
   - Review the status of all AWS resources
   - Address any MISSING required resources

3. **Test deployment** (optional):
   - Make a small change to `apps/api` or `apps/web`
   - Push to main branch
   - Verify deploy workflows succeed

## Security Best Practices

1. **Use restrictive trust policy in production**
   - Only allow main branch: `repo:fernando-m-vale/superseller-ia:ref:refs/heads/main`
   - Avoid wildcard `*` patterns in production

2. **Principle of least privilege**
   - Grant only necessary permissions to the IAM role
   - Regularly audit role permissions

3. **Monitor role usage**
   - Enable CloudTrail logging for IAM role assumptions
   - Set up alerts for unexpected role usage

4. **Rotate credentials**
   - OIDC tokens are short-lived (15 minutes)
   - No need to rotate like Access Keys

5. **Separate roles for different environments**
   - Use different roles for dev/staging/prod
   - Example: `superseller-github-oidc-dev`, `superseller-github-oidc-prod`

## Common Errors and Solutions

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Trust policy doesn't match workflow | Update trust policy with correct `sub` pattern |
| `Not authorized to perform apprunner:StartDeployment` | Missing App Runner permissions | Attach `apprunner-deploy-policy.json` to role |
| `No OIDC provider found` | OIDC provider not configured | Create OIDC provider in AWS IAM |
| `Role not found` | IAM role doesn't exist | Create IAM role with trust policy |
| `Access Denied` | Missing permissions | Add required permissions to role policy |
| `Invalid identity token` | Workflow missing `id-token: write` | Add permissions block to workflow |
| `Variables not defined` | GitHub Variables not set | Configure variables in GitHub Settings |

## References

- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/latest/dg/what-is-apprunner.html)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
