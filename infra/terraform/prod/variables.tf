# infra/terraform/prod/variables.tf
# =============================================================================
# Variables - App Runner Infrastructure
# =============================================================================

# -----------------------------------------------------------------------------
# AWS Configuration
# -----------------------------------------------------------------------------
variable "aws_region" {
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

# -----------------------------------------------------------------------------
# Domain Configuration
# -----------------------------------------------------------------------------
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

variable "enable_custom_domains" {
  description = "Enable custom domain association for App Runner services (required for using your own domain with SSL)"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# App Runner - Container Ports
# -----------------------------------------------------------------------------
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

# -----------------------------------------------------------------------------
# App Runner - API Service Configuration
# -----------------------------------------------------------------------------
variable "apprunner_api_cpu" {
  description = "App Runner API service CPU (256, 512, 1024, 2048, 4096)"
  type        = string
  default     = "512"
}

variable "apprunner_api_memory" {
  description = "App Runner API service memory (512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288)"
  type        = string
  default     = "1024"
}

# -----------------------------------------------------------------------------
# App Runner - WEB Service Configuration
# -----------------------------------------------------------------------------
variable "apprunner_web_cpu" {
  description = "App Runner WEB service CPU (256, 512, 1024, 2048, 4096)"
  type        = string
  default     = "512"
}

variable "apprunner_web_memory" {
  description = "App Runner WEB service memory (512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288)"
  type        = string
  default     = "1024"
}

# -----------------------------------------------------------------------------
# RDS Configuration
# -----------------------------------------------------------------------------
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
