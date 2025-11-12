
resource "aws_security_group" "alb" {
  name        = "superseller-prod-alb-sg"
  description = "ALB security group"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
  name_description = "superseller-prod-alb-sg"
  description      = "Security group for Application Load Balancer"
  vpc_id           = var.vpc_id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All egress"
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "superseller-prod-alb-sg"
  })
}

resource "aws_security_group" "ecs" {
  name        = "superseller-prod-ecs-sg"
  description = "ECS services security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Web (3000) from ALB"
    from_port       = 3000
    to_port         = 3000
  name_description = "superseller-prod-ecs-sg"
  description      = "Security group for ECS tasks"
  vpc_id           = var.vpc_id

  ingress {
    description     = "API port from ALB"
    from_port       = var.api_container_port
    to_port         = var.api_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "API (3001) from ALB"
    from_port       = 3001
    to_port         = 3001
    description     = "Web port from ALB"
    from_port       = var.web_container_port
    to_port         = var.web_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All egress"
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "superseller-prod-ecs-sg"
  })
}

resource "aws_security_group" "rds" {
  count = var.enable_rds ? 1 : 0

  name        = "superseller-prod-rds-sg"
  description = "RDS security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from ECS"
  name_description = "superseller-prod-rds-sg"
  description      = "Security group for RDS PostgreSQL"
  vpc_id           = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    description = "All egress"
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "superseller-prod-rds-sg"
  })
}
