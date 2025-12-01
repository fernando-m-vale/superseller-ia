# infra/terraform/prod/sg.tf
# =============================================================================
# Security Groups - App Runner + RDS
# =============================================================================

locals {
  default_tags = {
    Project   = "superseller-ia"
    Env       = "prod"
    Terraform = "true"
  }
}

# -----------------------------------------------------------------------------
# App Runner VPC Connector Security Group
# -----------------------------------------------------------------------------
# Permite que os serviços App Runner acessem recursos na VPC (RDS)
resource "aws_security_group" "apprunner" {
  name        = "superseller-prod-apprunner-sg"
  description = "Security group for App Runner VPC Connector"
  vpc_id      = var.vpc_id

  # Egress para RDS (PostgreSQL)
  egress {
    description = "PostgreSQL to RDS"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }

  # Egress para internet (APIs externas, etc.)
  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress geral (necessário para DNS, etc.)
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.default_tags, { Name = "superseller-prod-apprunner-sg" })
}

# -----------------------------------------------------------------------------
# RDS Security Group
# -----------------------------------------------------------------------------
# Recebe conexões PostgreSQL (5432) apenas do App Runner VPC Connector
resource "aws_security_group" "rds" {
  count       = var.enable_rds ? 1 : 0
  name        = "superseller-prod-rds-sg"
  description = "RDS security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from App Runner"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.default_tags, { Name = "superseller-prod-rds-sg" })
}
