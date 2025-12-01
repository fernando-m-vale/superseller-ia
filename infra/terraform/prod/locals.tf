# infra/terraform/prod/locals.tf
# =============================================================================
# Locals - App Runner Infrastructure
# =============================================================================

locals {
  # DNS
  api_fqdn = "${var.api_subdomain}.${var.domain_name}"
  web_fqdn = "${var.web_subdomain}.${var.domain_name}"

  # ECR Repository Names
  ecr_api_repo_name = "superseller/api"
  ecr_web_repo_name = "superseller/web"

  # Common Tags
  common_tags = {
    Project     = "SuperSellerIA"
    Environment = "production"
    ManagedBy   = "Terraform"
  }

  # Secrets ARN Prefix
  secrets_prefix = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/"
}
