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
}
