
output "vpc_id" {
  description = "VPC ID"
  value       = var.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs used for ALB"
  value       = local.alb_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs used for ECS and RDS"
  value       = local.ecs_subnet_ids
}

output "alb_security_group_id" {
  description = "ALB Security Group ID"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ECS Security Group ID"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "RDS Security Group ID (if enabled)"
  value       = var.enable_rds ? aws_security_group.rds[0].id : null
}

output "ecr_api_repository_url" {
  description = "ECR API repository URL"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  description = "ECR Web repository URL"
  value       = aws_ecr_repository.web.repository_url
}

output "ecs_task_role_arn" {
  description = "ECS Task Role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_execution_role_arn" {
  description = "ECS Execution Role ARN"
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_cluster_id" {
  description = "ECS Cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "ECS Cluster Name"
  value       = aws_ecs_cluster.main.name
}

output "api_service_name" {
  description = "API ECS Service Name"
  value       = aws_ecs_service.api.name
}

output "web_service_name" {
  description = "Web ECS Service Name"
  value       = aws_ecs_service.web.name
}

output "api_task_definition_arn" {
  description = "API Task Definition ARN"
  value       = aws_ecs_task_definition.api.arn
}

output "web_task_definition_arn" {
  description = "Web Task Definition ARN"
  value       = aws_ecs_task_definition.web.arn
}

output "api_task_definition_revision" {
  description = "API Task Definition Revision"
  value       = aws_ecs_task_definition.api.revision
}

output "web_task_definition_revision" {
  description = "Web Task Definition Revision"
  value       = aws_ecs_task_definition.web.revision
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "ALB DNS Name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB Zone ID"
  value       = aws_lb.main.zone_id
}

output "api_target_group_arn" {
  description = "API Target Group ARN"
  value       = aws_lb_target_group.api.arn
}

output "web_target_group_arn" {
  description = "Web Target Group ARN"
  value       = aws_lb_target_group.web.arn
}

output "api_certificate_arn" {
  description = "API ACM Certificate ARN"
  value       = aws_acm_certificate.api.arn
}

output "web_certificate_arn" {
  description = "Web ACM Certificate ARN"
  value       = aws_acm_certificate.web.arn
}

output "api_fqdn" {
  description = "API Fully Qualified Domain Name"
  value       = local.api_fqdn
}

output "web_fqdn" {
  description = "Web Fully Qualified Domain Name"
  value       = local.web_fqdn
}

output "api_url" {
  description = "API URL"
  value       = "https://${local.api_fqdn}"
}

output "web_url" {
  description = "Web URL"
  value       = "https://${local.web_fqdn}"
}

output "rds_endpoint" {
  description = "RDS Endpoint (if enabled)"
  value       = var.enable_rds ? aws_db_instance.main[0].endpoint : null
}

output "rds_database_name" {
  description = "RDS Database Name (if enabled)"
  value       = var.enable_rds ? var.rds_database_name : null
}

output "api_log_group" {
  description = "API CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.api.name
}

output "web_log_group" {
  description = "Web CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.web.name
}
