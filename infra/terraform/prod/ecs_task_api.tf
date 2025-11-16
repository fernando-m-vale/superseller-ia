resource "aws_ecs_task_definition" "api" {
  family                   = "superseller-prod-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_api.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${aws_ecr_repository.api.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 3001
      protocol      = "tcp"
    }]

    environment = [
      {
        name  = "PORT"
        value = "3001"
      },
      {
        name  = "NODE_ENV"
        value = "production"
      },
      {
        name  = "CORS_ORIGIN"
        value = "https://${var.app_subdomain}"
      }
    ]

    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/DB_URL-LncQ4s"
      },
      {
        name      = "DB_URL"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/DB_URL-LncQ4s"
      },
      {
        name      = "DB_SSELLERIA"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/DB_SSELLERIA-WUfCbz"
      },
      {
        name      = "JWT_SECRET"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/JWT_SECRET-m3RyMM"
      },
      {
        name      = "APP_BASE_URL"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/APP_BASE_URL-HUObWJ"
      },
      {
        name      = "CONNECTORS_MODE"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/CONNECTORS_MODE-8kkTFX"
      },
      {
        name      = "CONNECTORS_ENABLED"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/CONNECTORS_ENABLED-VdH6Hv"
      },
      {
        name      = "SHOPEE_CLIENT_ID"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/SHOPEE_CLIENT_ID-HeGSSP"
      },
      {
        name      = "SHOPEE_CLIENT_SECRET"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/SHOPEE_CLIENT_SECRET-TXPlBs"
      },
      {
        name      = "SHOPEE_REDIRECT_URI"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/SHOPEE_REDIRECT_URI-6cCu0H"
      },
      {
        name      = "ML_APP_ID"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/ML_APP_ID-2LEWTa"
      },
      {
        name      = "ML_APP_SECRET"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/ML_APP_SECRET-Centpx"
      },
      {
        name      = "ML_REDIRECT_URI"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/ML_REDIRECT_URI-lrPk9C"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = {
    Name = "superseller-prod-api-task"
  }
}
