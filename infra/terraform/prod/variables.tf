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
# NAT Gateway Configuration
# -----------------------------------------------------------------------------
variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets (required for App Runner to access external APIs). Cost: ~$32/month"
  type        = bool
  default     = true
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

# -----------------------------------------------------------------------------
# EventBridge Scheduler Configuration
# -----------------------------------------------------------------------------
variable "enable_scheduler" {
  description = "Enable EventBridge Scheduler for internal jobs (requires prod/INTERNAL_JOBS_KEY secret)"
  type        = bool
  default     = false
}

variable "scheduler_enabled" {
  description = "Whether the scheduler should be ENABLED or DISABLED after creation"
  type        = bool
  default     = true
}

variable "scheduler_tenant_id" {
  description = "Tenant ID to use for scheduled jobs (required when enable_scheduler=true)"
  type        = string
  default     = ""
}

variable "scheduler_cron_expression" {
  description = "Cron expression for daily metrics rebuild (default: 06:00 UTC = 03:00 BRT)"
  type        = string
  default     = "cron(0 6 * * ? *)"
}

variable "scheduler_timezone" {
  description = "Timezone for scheduler (IANA format)"
  type        = string
  default     = "America/Sao_Paulo"
}

variable "scheduler_retry_attempts" {
  description = "Maximum retry attempts for failed invocations"
  type        = number
  default     = 3
}

variable "scheduler_max_event_age" {
  description = "Maximum age of event in seconds before it's dropped"
  type        = number
  default     = 3600
}

variable "enable_ml_sync_schedule" {
  description = "Enable additional schedule for Mercado Livre sync (runs before metrics rebuild)"
  type        = bool
  default     = false
}

variable "enable_scheduler_alarm" {
  description = "Enable CloudWatch alarm for scheduler failures"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Power Orchestrator Configuration
# -----------------------------------------------------------------------------
variable "rds_instance_identifier" {
  description = "RDS instance identifier for power control"
  type        = string
  default     = "superseller-prod-db"
}
