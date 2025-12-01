# =============================================================================
# AWS App Runner - Serviços API e WEB
# =============================================================================
# Substitui ECS Fargate + ALB por uma arquitetura mais simples e econômica
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Connector - Permite App Runner acessar recursos na VPC privada (RDS)
# -----------------------------------------------------------------------------
resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "superseller-prod-vpc-connector"
  subnets            = local.private_subnet_ids
  security_groups    = [aws_security_group.apprunner.id]

  tags = merge(local.common_tags, {
    Name = "superseller-prod-vpc-connector"
  })
}

# -----------------------------------------------------------------------------
# IAM Role para App Runner acessar ECR
# -----------------------------------------------------------------------------
resource "aws_iam_role" "apprunner_ecr_access" {
  name = "superseller-apprunner-ecr-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "build.apprunner.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# -----------------------------------------------------------------------------
# IAM Role para App Runner Instance (runtime) - acesso a secrets
# -----------------------------------------------------------------------------
resource "aws_iam_role" "apprunner_instance" {
  name = "superseller-apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "tasks.apprunner.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "apprunner_secrets" {
  name = "secrets-access"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        "${local.secrets_prefix}*"
      ]
    }]
  })
}

resource "aws_iam_role_policy" "apprunner_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/apprunner/*"
      ]
    }]
  })
}

# -----------------------------------------------------------------------------
# App Runner Service - API (Porta 3001)
# -----------------------------------------------------------------------------
resource "aws_apprunner_service" "api" {
  service_name = "superseller-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_configuration {
        port = tostring(var.api_container_port)

        runtime_environment_variables = {
          NODE_ENV = "production"
          PORT     = tostring(var.api_container_port)
        }

        runtime_environment_secrets = {
          DATABASE_URL         = data.aws_secretsmanager_secret.prod["db_sselleria"].arn
          JWT_SECRET           = data.aws_secretsmanager_secret.prod["jwt_secret"].arn
          ML_APP_ID            = data.aws_secretsmanager_secret.prod["ml_app_id"].arn
          ML_APP_SECRET        = data.aws_secretsmanager_secret.prod["ml_app_secret"].arn
          ML_REDIRECT_URI      = data.aws_secretsmanager_secret.prod["ml_redirect_uri"].arn
          SHOPEE_CLIENT_ID     = data.aws_secretsmanager_secret.prod["shopee_client_id"].arn
          SHOPEE_CLIENT_SECRET = data.aws_secretsmanager_secret.prod["shopee_client_secret"].arn
          SHOPEE_REDIRECT_URI  = data.aws_secretsmanager_secret.prod["shopee_redirect_uri"].arn
        }
      }

      image_identifier      = "${aws_ecr_repository.api.repository_url}:latest"
      image_repository_type = "ECR"
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = var.apprunner_api_cpu
    memory            = var.apprunner_api_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }

    ingress_configuration {
      is_publicly_accessible = true
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.main.arn

  tags = merge(local.common_tags, {
    Name        = "superseller-api"
    Application = "api"
  })
}

# -----------------------------------------------------------------------------
# App Runner Service - WEB (Porta 3000)
# -----------------------------------------------------------------------------
resource "aws_apprunner_service" "web" {
  service_name = "superseller-web"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_configuration {
        port = tostring(var.web_container_port)

        runtime_environment_variables = {
          NODE_ENV = "production"
          PORT     = tostring(var.web_container_port)
          HOSTNAME = "0.0.0.0"
        }

        runtime_environment_secrets = {
          NEXT_PUBLIC_API_URL = data.aws_secretsmanager_secret.prod["next_public_api_url"].arn
        }
      }

      image_identifier      = "${aws_ecr_repository.web.repository_url}:latest"
      image_repository_type = "ECR"
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = var.apprunner_web_cpu
    memory            = var.apprunner_web_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }

    ingress_configuration {
      is_publicly_accessible = true
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.main.arn

  tags = merge(local.common_tags, {
    Name        = "superseller-web"
    Application = "web"
  })
}

# -----------------------------------------------------------------------------
# Auto Scaling Configuration - Configuração econômica
# -----------------------------------------------------------------------------
resource "aws_apprunner_auto_scaling_configuration_version" "main" {
  auto_scaling_configuration_name = "superseller-prod-autoscaling"

  max_concurrency = 100
  max_size        = 2
  min_size        = 1

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Custom Domain - API
# -----------------------------------------------------------------------------
# O App Runner gera automaticamente certificados SSL para domínios customizados.
# Após a criação, registros CNAME de validação serão gerados e precisam ser
# adicionados ao Route53 (feito automaticamente em route53.tf).
# -----------------------------------------------------------------------------
resource "aws_apprunner_custom_domain_association" "api" {
  count = var.enable_custom_domains ? 1 : 0

  domain_name = local.api_fqdn
  service_arn = aws_apprunner_service.api.arn

  # Não criar subdomínio www automaticamente
  enable_www_subdomain = false

  # Aguardar a validação do certificado pode demorar alguns minutos
  # Os registros de validação são criados automaticamente no Route53
}

# -----------------------------------------------------------------------------
# Custom Domain - WEB
# -----------------------------------------------------------------------------
resource "aws_apprunner_custom_domain_association" "web" {
  count = var.enable_custom_domains ? 1 : 0

  domain_name = local.web_fqdn
  service_arn = aws_apprunner_service.web.arn

  enable_www_subdomain = false
}

