locals {
  api_fqdn = "${var.api_subdomain}.${var.domain_name}"
  web_fqdn = "${var.web_subdomain}.${var.domain_name}"

  ecr_api_repo_name = "superseller/api"
  ecr_web_repo_name = "superseller/web"

  common_tags = {
    Project     = "SuperSellerIA"
    Environment = "production"
    ManagedBy   = "Terraform"
  }

  api_log_group = "/ecs/superseller-api"
  web_log_group = "/ecs/superseller-web"

  secrets_prefix = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/"
}
