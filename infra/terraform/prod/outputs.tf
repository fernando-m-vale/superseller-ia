output "vpc_id" {
  description = "VPC ID"
  value       = data.aws_vpc.main.id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB Zone ID"
  value       = aws_lb.main.zone_id
}

output "api_url" {
  description = "API URL"
  value       = "https://${var.api_subdomain}"
}

output "app_url" {
  description = "Web App URL"
  value       = "https://${var.app_subdomain}"
}

output "ecs_cluster_name" {
  description = "ECS Cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS Cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "api_service_name" {
  description = "API ECS Service name"
  value       = aws_ecs_service.api.name
}

output "web_service_name" {
  description = "Web ECS Service name"
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

output "ecr_api_repository_url" {
  description = "ECR API Repository URL"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  description = "ECR Web Repository URL"
  value       = aws_ecr_repository.web.repository_url
}

output "api_log_group" {
  description = "API CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.api.name
}

output "web_log_group" {
  description = "Web CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.web.name
}

output "task_execution_role_arn" {
  description = "ECS Task Execution Role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "api_task_role_arn" {
  description = "API Task Role ARN"
  value       = aws_iam_role.ecs_task_api.arn
}

output "web_task_role_arn" {
  description = "Web Task Role ARN"
  value       = aws_iam_role.ecs_task_web.arn
}
