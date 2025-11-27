locals {
  api_secret_bindings = {
    DATABASE_URL         = "db_sselleria"
    JWT_SECRET           = "jwt_secret"
    ML_APP_ID            = "ml_app_id"
    ML_APP_SECRET        = "ml_app_secret"
    ML_REDIRECT_URI      = "ml_redirect_uri"
    SHOPEE_CLIENT_ID     = "shopee_client_id"
    SHOPEE_CLIENT_SECRET = "shopee_client_secret"
    SHOPEE_REDIRECT_URI  = "shopee_redirect_uri"
  }

  web_secret_bindings = {
    NEXT_PUBLIC_API_URL = "next_public_api_url"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = local.api_log_group
  retention_in_days = 7

  tags = merge(local.common_tags, {
    Application = "api"
  })
}

resource "aws_cloudwatch_log_group" "web" {
  name              = local.web_log_group
  retention_in_days = 7

  tags = merge(local.common_tags, {
    Application = "web"
  })
}

resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "api" {
  family                   = var.api_task_family
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  task_role_arn            = aws_iam_role.ecs_task.arn
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${local.ecr_api_repo_name}:latest"
    essential = true

    portMappings = [{
      containerPort = var.api_container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(var.api_container_port) }
    ]

    secrets = [
      for name, key in local.api_secret_bindings : {
        name      = name
        valueFrom = data.aws_secretsmanager_secret.prod[key].arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = local.api_log_group
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -fsS http://localhost:${var.api_container_port}/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 15
    }
  }])

  tags = merge(local.common_tags, {
    Application = "api"
  })
}

resource "aws_ecs_task_definition" "web" {
  family                   = var.web_task_family
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  task_role_arn            = aws_iam_role.ecs_task.arn
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${local.ecr_web_repo_name}:latest"
    essential = true

    portMappings = [{
      containerPort = var.web_container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(var.web_container_port) },
      { name = "HOSTNAME", value = "0.0.0.0"}
    ]

    secrets = [
      for name, key in local.web_secret_bindings : {
        name      = name
        valueFrom = data.aws_secretsmanager_secret.prod[key].arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = local.web_log_group
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
     command     = ["CMD-SHELL", "curl -fsS http://$HOSTNAME:${var.web_container_port}/health || exit 1"]
     interval    = 30
     timeout     = 5
     retries     = 3
     startPeriod = 60
    }
  
  }])

  tags = merge(local.common_tags, {
    Application = "web"
  })
}

resource "aws_ecs_service" "api" {
  name            = var.api_service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.ecs_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.api_container_port
  }

  depends_on = [
    aws_lb_listener.https,
    aws_lb_listener.http
  ]

  tags = merge(local.common_tags, {
    Application = "api"
  })
}

resource "aws_ecs_service" "web" {
  name            = var.web_service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.ecs_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = var.web_container_port
  }

  depends_on = [
    aws_lb_listener.https,
    aws_lb_listener.http
  ]

  tags = merge(local.common_tags, {
    Application = "web"
  })
}
