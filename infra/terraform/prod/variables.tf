variable "aws_region" {
  type        = string
  default     = "us-east-2"
  description = "AWS region for all resources"
}

variable "aws_account_id" {
  type        = string
  default     = "234642166969"
  description = "AWS account ID"
}

variable "vpc_id" {
  type        = string
  default     = "vpc-097386e13a22a9c7b"
  description = "VPC ID for the production environment"
}

variable "domain_name" {
  type        = string
  default     = "superselleria.com.br"
  description = "Root domain name"
}

variable "api_subdomain" {
  type        = string
  default     = "api.superselleria.com.br"
  description = "API subdomain"
}

variable "app_subdomain" {
  type        = string
  default     = "app.superselleria.com.br"
  description = "Web app subdomain"
}

variable "enable_rds" {
  type        = bool
  default     = false
  description = "Enable RDS PostgreSQL instance"
}

variable "api_cpu" {
  type        = number
  default     = 256
  description = "CPU units for API task (256 = 0.25 vCPU)"
}

variable "api_memory" {
  type        = number
  default     = 512
  description = "Memory for API task in MB"
}

variable "web_cpu" {
  type        = number
  default     = 256
  description = "CPU units for Web task (256 = 0.25 vCPU)"
}

variable "web_memory" {
  type        = number
  default     = 512
  description = "Memory for Web task in MB"
}

variable "api_desired_count" {
  type        = number
  default     = 1
  description = "Desired number of API tasks"
}

variable "web_desired_count" {
  type        = number
  default     = 1
  description = "Desired number of Web tasks"
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-2"
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
  default     = "234642166969"
}

variable "vpc_id" {
  description = "VPC ID for all resources"
  type        = string
  default     = "vpc-097386e13a22a9c7b"
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "superselleria.com.br"
}

variable "api_subdomain" {
  description = "API subdomain"
  type        = string
  default     = "api"
}

variable "web_subdomain" {
  description = "Web subdomain"
  type        = string
  default     = "app"
}

variable "cluster_name" {
  description = "ECS cluster name"
  type        = string
  default     = "superseller-prod-cluster"
}

variable "api_service_name" {
  description = "API ECS service name"
  type        = string
  default     = "superseller-api-svc"
}

variable "web_service_name" {
  description = "Web ECS service name"
  type        = string
  default     = "superseller-web-svc"
}

variable "api_task_family" {
  description = "API task definition family"
  type        = string
  default     = "superseller-api"
}

variable "web_task_family" {
  description = "Web task definition family"
  type        = string
  default     = "superseller-web"
}

variable "api_container_port" {
  description = "API container port"
  type        = number
  default     = 3001
}

variable "web_container_port" {
  description = "Web container port"
  type        = number
  default     = 3000
}

variable "api_cpu" {
  description = "API task CPU units"
  type        = string
  default     = "512"
}

variable "api_memory" {
  description = "API task memory (MB)"
  type        = string
  default     = "1024"
}

variable "web_cpu" {
  description = "Web task CPU units"
  type        = string
  default     = "512"
}

variable "web_memory" {
  description = "Web task memory (MB)"
  type        = string
  default     = "1024"
}

variable "api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 1
}

variable "web_desired_count" {
  description = "Desired number of Web tasks"
  type        = number
  default     = 1
}

variable "enable_rds" {
  description = "Enable RDS PostgreSQL database"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage (GB)"
  type        = number
  default     = 20
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15"
}

variable "rds_database_name" {
  description = "RDS database name"
  type        = string
  default     = "superseller"
}

variable "rds_username" {
  description = "RDS master username"
  type        = string
  default     = "superseller_admin"
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = false
}
