# infra/terraform/prod/sg.tf

locals {
  default_tags = {
    Project   = "superseller-ia"
    Env       = "prod"
    Terraform = "true"
  }
}

# ALB: ingress público 80/443
resource "aws_security_group" "alb" {
  name        = "superseller-prod-alb-sg"
  description = "ALB security group"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.default_tags, { Name = "superseller-prod-alb-sg" })
}

# ECS: recebe tráfego do ALB nas portas 3000 (web) e 3001 (api)
resource "aws_security_group" "ecs" {
  name        = "superseller-prod-ecs-sg"
  description = "ECS services security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Web (3000) from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "API (3001) from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.default_tags, { Name = "superseller-prod-ecs-sg" })
}

# RDS: recebe 5432 apenas do ECS (habilite com var.enable_rds = true)
resource "aws_security_group" "rds" {
  count       = var.enable_rds ? 1 : 0
  name        = "superseller-prod-rds-sg"
  description = "RDS security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
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
