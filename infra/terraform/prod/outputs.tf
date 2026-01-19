# infra/terraform/prod/outputs.tf
# =============================================================================
# Outputs - App Runner Infrastructure
# =============================================================================

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "VPC ID"
  value       = var.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = local.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs (used for VPC Connector and RDS)"
  value       = local.private_subnet_ids
}

# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------
output "apprunner_security_group_id" {
  description = "App Runner VPC Connector Security Group ID"
  value       = aws_security_group.apprunner.id
}

output "rds_security_group_id" {
  description = "RDS Security Group ID (if enabled)"
  value       = var.enable_rds ? aws_security_group.rds[0].id : null
}

# -----------------------------------------------------------------------------
# ECR
# -----------------------------------------------------------------------------
output "ecr_api_repository_url" {
  description = "ECR API repository URL"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  description = "ECR Web repository URL"
  value       = aws_ecr_repository.web.repository_url
}

# -----------------------------------------------------------------------------
# App Runner - Services
# -----------------------------------------------------------------------------
output "apprunner_api_service_arn" {
  description = "App Runner API Service ARN"
  value       = aws_apprunner_service.api.arn
}

output "apprunner_api_service_id" {
  description = "App Runner API Service ID"
  value       = aws_apprunner_service.api.service_id
}

output "apprunner_api_service_url" {
  description = "App Runner API Service URL (direct)"
  value       = aws_apprunner_service.api.service_url
}

output "apprunner_web_service_arn" {
  description = "App Runner WEB Service ARN"
  value       = aws_apprunner_service.web.arn
}

output "apprunner_web_service_id" {
  description = "App Runner WEB Service ID"
  value       = aws_apprunner_service.web.service_id
}

output "apprunner_web_service_url" {
  description = "App Runner WEB Service URL (direct)"
  value       = aws_apprunner_service.web.service_url
}

# -----------------------------------------------------------------------------
# App Runner - VPC Connector
# -----------------------------------------------------------------------------
output "apprunner_vpc_connector_arn" {
  description = "App Runner VPC Connector ARN"
  value       = aws_apprunner_vpc_connector.main.arn
}

# -----------------------------------------------------------------------------
# App Runner - IAM Roles
# -----------------------------------------------------------------------------
output "apprunner_ecr_access_role_arn" {
  description = "App Runner ECR Access Role ARN"
  value       = aws_iam_role.apprunner_ecr_access.arn
}

output "apprunner_instance_role_arn" {
  description = "App Runner Instance Role ARN"
  value       = aws_iam_role.apprunner_instance.arn
}

# -----------------------------------------------------------------------------
# DNS / URLs
# -----------------------------------------------------------------------------
output "api_fqdn" {
  description = "API Fully Qualified Domain Name"
  value       = local.api_fqdn
}

output "web_fqdn" {
  description = "Web Fully Qualified Domain Name"
  value       = local.web_fqdn
}

output "api_url" {
  description = "API URL (custom domain or App Runner direct)"
  value       = var.enable_custom_domains ? "https://${local.api_fqdn}" : "https://${aws_apprunner_service.api.service_url}"
}

output "web_url" {
  description = "Web URL (custom domain or App Runner direct)"
  value       = var.enable_custom_domains ? "https://${local.web_fqdn}" : "https://${aws_apprunner_service.web.service_url}"
}

# -----------------------------------------------------------------------------
# Custom Domain Status
# -----------------------------------------------------------------------------
output "api_custom_domain_status" {
  description = "API Custom Domain certificate status"
  value       = var.enable_custom_domains ? aws_apprunner_custom_domain_association.api[0].status : "disabled"
}

output "web_custom_domain_status" {
  description = "WEB Custom Domain certificate status"
  value       = var.enable_custom_domains ? aws_apprunner_custom_domain_association.web[0].status : "disabled"
}

output "api_dns_target" {
  description = "API DNS target for CNAME record"
  value       = var.enable_custom_domains ? aws_apprunner_custom_domain_association.api[0].dns_target : aws_apprunner_service.api.service_url
}

output "web_dns_target" {
  description = "WEB DNS target for CNAME record"
  value       = var.enable_custom_domains ? aws_apprunner_custom_domain_association.web[0].dns_target : aws_apprunner_service.web.service_url
}

# -----------------------------------------------------------------------------
# ACM Certificates (mantidos para custom domains)
# -----------------------------------------------------------------------------
output "api_certificate_arn" {
  description = "API ACM Certificate ARN"
  value       = var.enable_custom_domains ? aws_acm_certificate.api[0].arn : null
}

output "web_certificate_arn" {
  description = "Web ACM Certificate ARN"
  value       = var.enable_custom_domains ? aws_acm_certificate.web[0].arn : null
}

# -----------------------------------------------------------------------------
# NAT Gateway (se habilitado)
# -----------------------------------------------------------------------------
output "nat_gateway_id" {
  description = "NAT Gateway ID (if enabled)"
  value       = var.enable_nat_gateway ? aws_nat_gateway.main[0].id : null
}

output "nat_gateway_public_ip" {
  description = "NAT Gateway Public IP (if enabled)"
  value       = var.enable_nat_gateway ? aws_eip.nat[0].public_ip : null
}

# -----------------------------------------------------------------------------
# RDS (se habilitado)
# -----------------------------------------------------------------------------
output "rds_endpoint" {
  description = "RDS Endpoint (if enabled)"
  value       = var.enable_rds ? aws_db_instance.main[0].endpoint : null
}

output "rds_database_name" {
  description = "RDS Database Name (if enabled)"
  value       = var.enable_rds ? var.rds_database_name : null
}

# -----------------------------------------------------------------------------
# EventBridge Scheduler (se habilitado)
# -----------------------------------------------------------------------------
output "scheduler_daily_metrics_arn" {
  description = "EventBridge Scheduler ARN for daily metrics rebuild (if enabled)"
  value       = var.enable_scheduler ? aws_scheduler_schedule.daily_metrics_rebuild[0].arn : null
}

output "scheduler_api_destination_arn" {
  description = "EventBridge API Destination ARN (if enabled)"
  value       = var.enable_scheduler ? aws_cloudwatch_event_api_destination.superseller_jobs[0].arn : null
}

output "scheduler_connection_arn" {
  description = "EventBridge Connection ARN (if enabled)"
  value       = var.enable_scheduler ? aws_cloudwatch_event_connection.superseller_internal[0].arn : null
}

output "scheduler_execution_role_arn" {
  description = "Scheduler Execution Role ARN (if enabled)"
  value       = var.enable_scheduler ? aws_iam_role.scheduler_execution[0].arn : null
}
